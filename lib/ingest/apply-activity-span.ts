/**
 * lib/ingest/apply-activity-span.ts — currently / stopped / switched to
 *
 * Open intervals paint Activity from now through end of day. Stop truncates to
 * now. Switch closes the previous open span, starts the next, and logs a
 * switch instant for Analytics (all labeled from the text pipeline).
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { PEN_PALETTE, useTimeTrackingStore, type TrackPen } from "@/lib/time-tracking-store"
import type { TimeEntry } from "@/lib/time-entries"
import { switchScopePen } from "./switch-scope"
import { minutesPastMidnight, MINUTES_PER_DAY } from "./times"
import { fromTextMessageNote } from "./text-triggers"
import type { ApplyResult } from "./types"

const ACTIVITY = "activity"
const TEXT_LABEL = "from text pipeline"

export function applyCurrently(payload: string, now = new Date()): ApplyResult {
  const name = payload.trim()
  if (!name) {
    return {
      status: "error",
      kind: "currently",
      reply: "Currently what? Example: currently deep work",
    }
  }
  const penId = ensureActivityPen(name)
  const date = formatLocalDateKey(now)
  const nowMin = minutesPastMidnight(now)
  switchScopePen(date, ACTIVITY, nowMin, penId)
  stampTextPipelineOnOpen(date, penId, nowMin, name, now)
  return {
    status: "ok",
    kind: "currently",
    reply: `Currently: ${name}`,
    summary: `Currently → ${name}`,
  }
}

export function applyStoppedActivity(payload: string, now = new Date()): ApplyResult {
  const date = formatLocalDateKey(now)
  const nowMin = minutesPastMidnight(now)
  const query = payload.trim()
  const open = findOpenActivity(date, nowMin, query || undefined)
  if (!open) {
    return {
      status: "error",
      kind: "stopped-activity",
      reply: query
        ? `No open “${query}” activity to stop.`
        : "Nothing open to stop. Example: stopped deep work",
    }
  }
  const pen = penById(open.penId)
  closeOpenEntry(open, nowMin, now)
  const label = pen?.name ?? open.title ?? "activity"
  return {
    status: "ok",
    kind: "stopped-activity",
    reply: `Stopped: ${label}`,
    summary: `Stopped → ${label}`,
  }
}

export function applySwitchedTo(payload: string, now = new Date()): ApplyResult {
  const name = payload.trim()
  if (!name) {
    return {
      status: "error",
      kind: "switched-to",
      reply: "Switched to what? Example: switched to cooking",
    }
  }
  const date = formatLocalDateKey(now)
  const nowMin = minutesPastMidnight(now)
  const previous = findOpenActivity(date, nowMin)
  if (previous) closeOpenEntry(previous, nowMin, now)

  const penId = ensureActivityPen(name)
  switchScopePen(date, ACTIVITY, nowMin, penId)
  stampTextPipelineOnOpen(date, penId, nowMin, name, now)

  // Switch instant for Analytics.
  const switchPen = ensureActivityPen("Switch")
  useTimeTrackingStore.getState().paintMinutes(date, ACTIVITY, nowMin, nowMin, switchPen, undefined, undefined, undefined, {
    kind: "instant",
    title: previous ? `switch → ${name}` : `switch → ${name}`,
    notes: fromTextMessageNote(now, TEXT_LABEL),
  })
  const switchEntry = useTimeTrackingStore
    .getState()
    .entries.filter(
      (e) =>
        e.date === date &&
        e.scopeId === ACTIVITY &&
        e.kind === "instant" &&
        e.startMin === nowMin &&
        e.penId === switchPen,
    )
    .sort((a, b) => b.id.localeCompare(a.id))[0]
  if (switchEntry) {
    useTimeTrackingStore.getState().updateEntry(switchEntry.id, {
      generatedBy: { kind: "text", id: date },
      notes: fromTextMessageNote(now, TEXT_LABEL),
    })
  }

  const from = previous ? penById(previous.penId)?.name ?? "previous" : "idle"
  return {
    status: "ok",
    kind: "switched-to",
    reply: `Switched: ${from} → ${name}`,
    summary: `Switch → ${name}`,
  }
}

function findOpenActivity(date: string, nowMin: number, query?: string): TimeEntry | null {
  const entries = useTimeTrackingStore
    .getState()
    .entries.filter(
      (e) =>
        e.date === date &&
        e.scopeId === ACTIVITY &&
        e.kind !== "instant" &&
        e.startMin <= nowMin &&
        e.endMin > nowMin &&
        // "Open until further notice" spans run to end of day.
        e.endMin >= MINUTES_PER_DAY - 1,
    )
    .sort((a, b) => b.startMin - a.startMin)

  if (!query) return entries[0] ?? null
  const q = query.toLowerCase()
  return (
    entries.find((e) => {
      const pen = penById(e.penId)
      const name = (e.title || pen?.name || "").toLowerCase()
      return name === q || name.includes(q) || q.includes(name)
    }) ?? null
  )
}

function closeOpenEntry(entry: TimeEntry, nowMin: number, now: Date): void {
  const end = Math.max(entry.startMin + 1, Math.min(nowMin, MINUTES_PER_DAY))
  useTimeTrackingStore.getState().updateEntry(entry.id, {
    endMin: end,
    notes: mergeNote(entry.notes, fromTextMessageNote(now, TEXT_LABEL)),
    generatedBy: entry.generatedBy?.kind === "text" ? entry.generatedBy : { kind: "text", id: entry.date },
  })
}

function stampTextPipelineOnOpen(
  date: string,
  penId: string,
  nowMin: number,
  title: string,
  now: Date,
): void {
  const entry = useTimeTrackingStore
    .getState()
    .entries.filter(
      (e) =>
        e.date === date &&
        e.scopeId === ACTIVITY &&
        e.penId === penId &&
        e.kind !== "instant" &&
        e.startMin === Math.min(Math.max(0, Math.floor(nowMin)), MINUTES_PER_DAY - 1),
    )
    .sort((a, b) => b.id.localeCompare(a.id))[0]
  if (!entry) return
  useTimeTrackingStore.getState().updateEntry(entry.id, {
    title,
    notes: mergeNote(entry.notes, fromTextMessageNote(now, TEXT_LABEL)),
    generatedBy: { kind: "text", id: date },
  })
}

function ensureActivityPen(name: string): string {
  const store = useTimeTrackingStore.getState()
  let scope = store.scopes.find((s) => s.id === ACTIVITY)
  if (!scope) {
    store.addScope("Activity")
    scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === ACTIVITY) ?? useTimeTrackingStore.getState().scopes[0]
  }
  if (!scope) throw new Error("No activity scope")
  const existing = scope.pens.find((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())
  if (existing) return existing.id
  return store.addPen(scope.id, {
    name: name.trim(),
    color: PEN_PALETTE[scope.pens.length % PEN_PALETTE.length],
  })
}

function penById(id: string): TrackPen | undefined {
  for (const scope of useTimeTrackingStore.getState().scopes) {
    const pen = scope.pens.find((p) => p.id === id)
    if (pen) return pen
  }
  return undefined
}

function mergeNote(existing: string | undefined, line: string): string {
  const prev = (existing ?? "").trim()
  if (!prev) return line
  if (prev.includes(TEXT_LABEL)) return prev
  return `${prev}\n${line}`
}
