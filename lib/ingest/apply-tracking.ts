/**
 * lib/ingest/apply-tracking.ts — Location, activity, mood, sleep, working now
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { isOperation } from "@/lib/operations"
import {
  startWorkingOnOperation,
  stopWorkingOnOperation,
} from "@/lib/operation-work-session"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { useSleepStore } from "@/lib/sleep-store"
import { syncSleepNight } from "@/lib/sleep-sync"
import { syncTrackedHabits } from "@/lib/habit-tracking-sync"
import { PEN_PALETTE, useTimeTrackingStore, type TrackPen } from "@/lib/time-tracking-store"
import { useTaskStore } from "@/lib/task-store"
import { resolveName, splitNameAndRest, type Named } from "./name-resolve"
import { paintActivityWindow, switchScopePen } from "./switch-scope"
import {
  addLocalDays,
  minutesPastMidnight,
  parseSleepRange,
  parseTrackWindow,
  sleepMorningKey,
} from "./times"
import type { ApplyResult, PendingClarifyKind } from "./types"
import { itemTitleOrUntitled } from "@/lib/item-utils"

function formatClock(min: number): string {
  const wrapped = ((Math.floor(min) % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  const am = h < 12
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`
}

function pensInScope(scopeId: string): TrackPen[] {
  const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === scopeId)
  return scope?.pens ?? []
}

function namedPens(scopeId: string): Named[] {
  return pensInScope(scopeId).map((p) => ({ id: p.id, name: p.name }))
}

function createPen(scopeId: string, name: string): string {
  const existing = pensInScope(scopeId).length
  return useTimeTrackingStore.getState().addPen(scopeId, {
    name,
    color: PEN_PALETTE[existing % PEN_PALETTE.length],
  })
}

function clarifyPen(
  kind: PendingClarifyKind,
  scopeId: string,
  query: string,
  remainder: string,
  now: Date,
  extraLines: string[] = [],
): ApplyResult {
  const resolved = resolveName(query, namedPens(scopeId))
  if (resolved.status === "match") {
    return applyResolvedPen(kind, scopeId, resolved.candidate.id, remainder, now)
  }
  const candidates = resolved.status === "ambiguous" ? resolved.candidates : namedPens(scopeId).map((p) => ({
    id: p.id,
    name: p.name,
    score: 0,
  })).slice(0, 6)
  const list = candidates.map((c, i) => `${i + 1}. ${c.name}`).join("\n")
  const createHint = query ? `\nOr reply new to create “${query}”.` : ""
  const extra = extraLines.length ? `\n${extraLines.join("\n")}` : ""
  return {
    status: "needs_clarify",
    kind: kind === "start" ? "start" : kind === "mood" ? "mood" : kind === "track" ? "track" : "location",
    reply: (query ? `Which ${scopeId} for “${query}”?` : `Which ${scopeId}?`) + `\n${list}${createHint}${extra}`,
    pending: {
      kind,
      query,
      candidates,
      createName: query || undefined,
      remainder,
      scopeId,
      createdAt: now.toISOString(),
    },
  }
}

function applyResolvedPen(
  kind: PendingClarifyKind,
  scopeId: string,
  penId: string,
  remainder: string,
  now: Date,
): ApplyResult {
  const pen = pensInScope(scopeId).find((p) => p.id === penId)
  const name = pen?.name ?? "pen"
  const date = formatLocalDateKey(now)
  const nowMin = minutesPastMidnight(now)

  if (kind === "track") {
    const window = parseTrackWindow(remainder, now)
    if (window?.previousDay) {
      const prev = formatLocalDateKey(addLocalDays(now, -1))
      paintActivityWindow(prev, window.startMin, window.endMin, penId)
      if (nowMin > 0) paintActivityWindow(date, 0, nowMin || 1, penId)
    } else if (window) {
      paintActivityWindow(date, window.startMin, window.endMin, penId)
    } else {
      switchScopePen(date, "activity", nowMin, penId)
    }
    syncTrackedHabits()
    const when = window
      ? `${formatClock(window.startMin)}–${formatClock(window.previousDay ? nowMin : window.endMin)}`
      : `from ${formatClock(nowMin)}`
    return {
      status: "ok",
      kind: "track",
      reply: `Activity: ${name} ${when}`,
      summary: `Tracked ${name}`,
    }
  }

  switchScopePen(date, scopeId, nowMin, penId)
  syncTrackedHabits()
  const label = kind === "mood" ? "Mood" : kind === "start" ? "Activity" : "Location"
  return {
    status: "ok",
    kind: kind === "mood" ? "mood" : kind === "start" ? "start" : "location",
    reply: `${label}: ${name} from ${formatClock(nowMin)}`,
    summary: `${label} → ${name}`,
  }
}

export function applyLocation(payload: string, now = new Date()): ApplyResult {
  const query = payload.trim()
  if (!query) return { status: "error", kind: "location", reply: "Where? Example: at: home" }
  return clarifyOrApply("location", "location", query, "", now)
}

export function applyMood(payload: string, now = new Date()): ApplyResult {
  const query = payload.trim()
  if (!query) return { status: "error", kind: "mood", reply: "Which mood? Example: mood: good" }
  return clarifyOrApply("mood", "mood", query, "", now)
}

export function applyTrack(payload: string, now = new Date()): ApplyResult {
  const rest = payload.trim()
  if (!rest) return { status: "error", kind: "track", reply: "What to track? Example: track: exercise 30m" }
  const { query, rest: remainder } = splitNameAndRest(rest, namedPens("activity"))
  return clarifyOrApply("track", "activity", query || rest, remainder, now)
}

function clarifyOrApply(
  kind: PendingClarifyKind,
  scopeId: string,
  query: string,
  remainder: string,
  now: Date,
): ApplyResult {
  const resolved = resolveName(query, namedPens(scopeId))
  if (resolved.status === "match") {
    return applyResolvedPen(kind, scopeId, resolved.candidate.id, remainder, now)
  }
  return clarifyPen(kind, scopeId, query, remainder, now)
}

export function applySleep(payload: string, now = new Date()): ApplyResult {
  const range = parseSleepRange(payload)
  if (!range) {
    return { status: "error", kind: "sleep", reply: "Sleep needs a range, e.g. sleep: 11:30-7:00" }
  }
  const morning = sleepMorningKey(now)
  const date = formatLocalDateKey(morning)
  const sleep = useSleepStore.getState()
  sleep.setBedtime(date, range.sleptMin, "estimated")
  sleep.setWakeTime(date, range.wokeMin, "estimated")
  syncSleepNight(date, now)
  return {
    status: "ok",
    kind: "sleep",
    reply: `Sleep ${formatClock(range.sleptMin)}–${formatClock(range.wokeMin)} (${date})`,
    summary: `Sleep logged for ${date}`,
  }
}

export function applyStart(payload: string, now = new Date()): ApplyResult {
  const query = payload.trim()
  if (!query) {
    return { status: "error", kind: "start", reply: "Start what? Example: start: write paper" }
  }

  const operations = useTaskStore
    .getState()
    .tasks.filter(isOperation)
    .map((t) => ({ id: t.id, name: itemTitleOrUntitled(t, "operation") }))
  const op = resolveName(query, operations)
  if (op.status === "match") {
    const session = startWorkingOnOperation(op.candidate.id, now)
    if (!session) {
      return { status: "error", kind: "start", reply: `Could not start “${op.candidate.name}”.` }
    }
    return {
      status: "ok",
      kind: "start",
      reply: `Working on ${op.candidate.name}`,
      summary: `Started ${op.candidate.name}`,
      itemIds: [op.candidate.id],
    }
  }

  const activity = resolveName(query, namedPens("activity"))
  if (activity.status === "match") {
    return applyResolvedPen("start", "activity", activity.candidate.id, "", now)
  }

  const extras: string[] = []
  if (op.status === "ambiguous") {
    extras.push("Operations: " + op.candidates.map((c) => c.name).join(", "))
  }
  return clarifyPen("start", "activity", query, "", now, extras)
}

export function applyStop(now = new Date()): ApplyResult {
  const current = useWorkSessionStore.getState().session
  if (current) {
    stopWorkingOnOperation(now)
    return {
      status: "ok",
      kind: "stop",
      reply: `Stopped working on ${current.title}`,
      summary: `Stopped ${current.title}`,
    }
  }
  return {
    status: "ok",
    kind: "stop",
    reply: "Nothing was running.",
    summary: "Stop with no live session",
  }
}

export function createAndApplyPen(
  kind: PendingClarifyKind,
  scopeId: string,
  name: string,
  remainder: string,
  now: Date,
): ApplyResult {
  const id = createPen(scopeId, name)
  if (!id) return { status: "error", kind: "location", reply: "Could not create that pen." }
  return applyResolvedPen(kind, scopeId, id, remainder, now)
}

export function applyPenById(
  kind: PendingClarifyKind,
  scopeId: string,
  penId: string,
  remainder: string,
  now: Date,
): ApplyResult {
  return applyResolvedPen(kind, scopeId, penId, remainder, now)
}
