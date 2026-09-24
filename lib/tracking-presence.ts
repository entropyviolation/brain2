/**
 * lib/tracking-presence.ts — Current vs last-known Tracking state
 *
 * Home's Tracking now tile: Activity, Location, Mood, Company. A lane is
 * **current** when a block covers now (including Telegram `currently` painted
 * through end of day), or a live Working-on-now / pen-color session owns that
 * scope. Otherwise the most recent interval that already started is **last**.
 * Instants do not count. Update paints `switchScopePen` from now through the
 * rest of the day.
 */

import { formatLocalDateKey } from "@/lib/date-utils"
import { switchScopePen } from "@/lib/ingest/switch-scope"
import { minutesPastMidnight } from "@/lib/ingest/times"
import { isInstant, type TimeEntry } from "@/lib/time-entries"
import { PEN_PALETTE, useTimeTrackingStore, type TrackPen, type TrackScope } from "@/lib/time-tracking-store"

export const PRESENCE_SCOPE_IDS = ["activity", "location", "mood", "company"] as const

export type PresenceScopeId = (typeof PRESENCE_SCOPE_IDS)[number]

export const PRESENCE_SCOPE_LABEL: Record<PresenceScopeId, string> = {
  activity: "Activity",
  location: "Location",
  mood: "Mood",
  company: "Company",
}

export type PresenceKind = "current" | "last" | "empty"

export type PresenceLane = {
  scopeId: PresenceScopeId
  kind: PresenceKind
  name: string
}

export type LivePresenceHint = {
  scopeId: string
  name: string
}

export type PresenceSnapshot = {
  caption: "Now" | "Last"
  activity: PresenceLane
  lanes: PresenceLane[]
  footer: string
}

function penName(scopes: TrackScope[], penId: string, title?: string): string {
  for (const scope of scopes) {
    const pen = scope.pens.find((item) => item.id === penId)
    if (pen) return (title && title.trim()) || pen.name
  }
  return (title && title.trim()) || "—"
}

function covers(entry: TimeEntry, date: string, min: number): boolean {
  if (isInstant(entry) || entry.date !== date) return false
  return entry.startMin <= min && min < entry.endMin
}

function startedBy(entry: TimeEntry, date: string, min: number): boolean {
  if (isInstant(entry)) return false
  if (entry.date < date) return true
  if (entry.date > date) return false
  return entry.startMin <= min
}

function later(a: TimeEntry, b: TimeEntry): TimeEntry {
  if (a.date !== b.date) return a.date > b.date ? a : b
  if (a.endMin !== b.endMin) return a.endMin > b.endMin ? a : b
  return a.startMin >= b.startMin ? a : b
}

export function presenceLaneForScope(
  scopeId: PresenceScopeId,
  input: {
    date: string
    min: number
    entries: TimeEntry[]
    scopes: TrackScope[]
    live?: LivePresenceHint[]
  },
): PresenceLane {
  const live = input.live?.find((item) => item.scopeId === scopeId)
  const mine = input.entries.filter((entry) => entry.scopeId === scopeId)
  const covering = mine.find((entry) => covers(entry, input.date, input.min))
  if (covering) {
    return { scopeId, kind: "current", name: penName(input.scopes, covering.penId, covering.title) }
  }
  if (live?.name) return { scopeId, kind: "current", name: live.name }

  let last: TimeEntry | undefined
  for (const entry of mine) {
    if (!startedBy(entry, input.date, input.min)) continue
    last = last ? later(last, entry) : entry
  }
  if (!last) return { scopeId, kind: "empty", name: "—" }
  return { scopeId, kind: "last", name: penName(input.scopes, last.penId, last.title) }
}

export function trackingPresenceSnapshot(input: {
  date: string
  min: number
  entries: TimeEntry[]
  scopes: TrackScope[]
  live?: LivePresenceHint[]
}): PresenceSnapshot {
  const lanes = PRESENCE_SCOPE_IDS.map((scopeId) => presenceLaneForScope(scopeId, { ...input, scopeId }))
  const activity = lanes.find((lane) => lane.scopeId === "activity") ?? {
    scopeId: "activity" as const,
    kind: "empty" as const,
    name: "—",
  }
  const anyCurrent = lanes.some((lane) => lane.kind === "current")
  const rest = lanes.filter((lane) => lane.scopeId !== "activity")
  const named = rest
    .map((lane) => (lane.kind === "empty" ? null : lane.name))
    .filter((name): name is string => Boolean(name))
  const footer =
    named.length > 0
      ? named.join(" · ")
      : activity.kind === "current"
        ? "now"
        : activity.kind === "last"
          ? "last known"
          : "No tracking yet"
  return {
    caption: anyCurrent ? "Now" : "Last",
    activity,
    lanes,
    footer,
  }
}

export function livePresenceHints(input: {
  workSession?: { title: string; scopeId?: string } | null
  penSession?: { title: string; scopeId: string } | null
}): LivePresenceHint[] {
  const hints: LivePresenceHint[] = []
  if (input.workSession?.title) {
    hints.push({ scopeId: input.workSession.scopeId || "activity", name: input.workSession.title })
  }
  if (input.penSession?.title) {
    hints.push({ scopeId: input.penSession.scopeId, name: input.penSession.title })
  }
  return hints
}

export function ensureScopePen(scopeId: string, name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const store = useTimeTrackingStore.getState()
  const scope = store.scopes.find((item) => item.id === scopeId)
  if (!scope) return null
  const existing = scope.pens.find((pen) => pen.name.trim().toLowerCase() === trimmed.toLowerCase())
  if (existing) return existing.id
  return store.addPen(scope.id, {
    name: trimmed,
    color: PEN_PALETTE[scope.pens.length % PEN_PALETTE.length],
  })
}

export function applyTrackingPresenceUpdate(
  patches: Partial<Record<PresenceScopeId, string>>,
  now = new Date(),
): void {
  const date = formatLocalDateKey(now)
  const min = minutesPastMidnight(now)
  for (const scopeId of PRESENCE_SCOPE_IDS) {
    const raw = patches[scopeId]?.trim()
    if (!raw) continue
    const store = useTimeTrackingStore.getState()
    const scope = store.scopes.find((item) => item.id === scopeId)
    const byId = scope?.pens.find((pen) => pen.id === raw)
    const penId = byId ? byId.id : ensureScopePen(scopeId, raw)
    if (!penId) continue
    switchScopePen(date, scopeId, min, penId)
  }
}

export function pensForPresenceScope(scopes: TrackScope[], scopeId: PresenceScopeId): TrackPen[] {
  return scopes.find((scope) => scope.id === scopeId)?.pens ?? []
}
