/**
 * lib/instagram-sessions.ts — Instagram "Time active" sessions as iPhone Screen Time blocks
 *
 * Data → Sources → Instagram → Time active splits every logged action into
 * sessions (`time_active` in `analyze.py`). `summary.time_active.sessions_recent`
 * lists the ones inside the view-log window as `[startEpoch, endEpoch, actions]`.
 * Each becomes an interval on iPhone Screen Time, on the `Instagram` app pen,
 * with the note `derived from instagram data`. Estimated (hatched): the session
 * is a gap-based guess, not a clock the phone reported.
 *
 * Older years only log actions, so they read as one-minute floors and would fill
 * the ~5 MB localStorage Tracking lives in. Only the recent window is painted.
 * Rows carry a per-session phone-sync stamp (`instagram:<startEpoch>`), so the
 * vault guard never mistakes a stale snapshot for a deletion. Pure except
 * `applyInstagramSessions`. Chrome history runs share `localMidnightSlices`.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { ensureIphoneAppPen } from "@/lib/ingest/apply-phone-screen"
import type { TimeEntry } from "@/lib/time-entries"
import { findIphoneScreenTimeScope, useTimeTrackingStore } from "@/lib/time-tracking-store"

export const INSTAGRAM_SESSION_NOTE = "derived from instagram data"
export const INSTAGRAM_APP_NAME = "Instagram"
const MINUTES_PER_DAY = 1440
const MAX_MIDNIGHT_SLICES = 400

/**
 * Cut a span at local midnights. A slice closes when `endMs` is at or before
 * the next local midnight. A leftover second or millisecond rounds that end
 * minute up. Each slice is at least one minute. Stops at 400 slices.
 */
export function localMidnightSlices(
  startMs: number,
  endMs: number,
): { date: string; startMin: number; endMin: number }[] {
  const first = new Date(startMs)
  let dayStart = new Date(first.getFullYear(), first.getMonth(), first.getDate())
  let startMin = first.getHours() * 60 + first.getMinutes()
  const out: { date: string; startMin: number; endMin: number }[] = []
  for (let part = 0; part < MAX_MIDNIGHT_SLICES; part++) {
    const nextDay = new Date(dayStart.getFullYear(), dayStart.getMonth(), dayStart.getDate() + 1)
    const last = endMs <= nextDay.getTime()
    let endMin = MINUTES_PER_DAY
    if (last) {
      const d = new Date(endMs)
      endMin = d.getHours() * 60 + d.getMinutes() + (d.getSeconds() || d.getMilliseconds() ? 1 : 0)
    }
    endMin = Math.min(MINUTES_PER_DAY, Math.max(startMin + 1, endMin))
    out.push({ date: formatLocalDateKey(dayStart), startMin, endMin })
    if (last) break
    dayStart = nextDay
    startMin = 0
  }
  return out
}

export interface InstagramSession {
  /** Unix seconds of the first action. */
  start: number
  /** Unix seconds of the last action. The block runs one minute past it. */
  end: number
  actions: number
}

/** `summary.time_active.sessions_recent`, or `[]` when the summary lacks it (a build from before this existed). */
export function readInstagramSessions(summary: unknown): InstagramSession[] {
  const rows = (summary as { time_active?: { sessions_recent?: unknown } } | null)?.time_active?.sessions_recent
  if (!Array.isArray(rows)) return []
  const out: InstagramSession[] = []
  for (const row of rows) {
    if (!Array.isArray(row)) continue
    const [start, end, actions] = row as unknown[]
    if (typeof start !== "number" || typeof end !== "number" || !Number.isFinite(start) || end < start) continue
    out.push({ start, end, actions: typeof actions === "number" ? actions : 1 })
  }
  return out
}

export function instagramSessionStamp(start: number): NonNullable<TimeEntry["generatedBy"]> {
  return { kind: "phone-sync", id: `instagram:${start}` }
}

function sessionId(start: number, part: number): string {
  const base = `ig-session-${start}`
  return part ? `${base}-${part}` : base
}

/**
 * One session as entries, sliced at local midnight (slices share a `spanId`).
 * The block runs from the first action's minute to a minute past the last,
 * matching the report's "minutes = (last − first)/60 + 1".
 */
export function sessionEntries(session: InstagramSession, scopeId: string, penId: string): TimeEntry[] {
  const startMs = session.start * 1000
  const endMs = (session.end + 60) * 1000
  const stamp = instagramSessionStamp(session.start)
  const spanId = `ig-span-${session.start}`
  const out: TimeEntry[] = localMidnightSlices(startMs, endMs).map((slice, part) => ({
    id: sessionId(session.start, part),
    date: slice.date,
    scopeId,
    penId,
    startMin: slice.startMin,
    endMin: slice.endMin,
    notes: INSTAGRAM_SESSION_NOTE,
    precision: "estimated",
    clockCertainty: "estimated",
    generatedBy: stamp,
  }))
  if (out.length > 1) for (const entry of out) entry.spanId = spanId
  return out
}

export interface MergeSessionsResult {
  entries: TimeEntry[]
  added: number
  updated: number
  skipped: number
}

/**
 * Add sessions that are not there yet. A session already painted by this sync is
 * stretched when a newer export ends it later, unless the block was edited
 * (its notes or pen changed) — then the edit wins. Deleted ids are never added back.
 */
export function mergeSessionEntries(
  existing: readonly TimeEntry[],
  removedIds: readonly string[],
  incoming: readonly TimeEntry[],
): MergeSessionsResult {
  const removed = new Set(removedIds)
  const byId = new Map(existing.map((entry) => [entry.id, entry]))
  const replace = new Map<string, TimeEntry>()
  const fresh: TimeEntry[] = []
  let skipped = 0
  for (const entry of incoming) {
    if (removed.has(entry.id)) {
      skipped++
      continue
    }
    const have = byId.get(entry.id)
    if (!have) {
      fresh.push(entry)
      continue
    }
    const untouched = have.notes === entry.notes && have.penId === entry.penId && have.date === entry.date
    if (untouched && (have.startMin !== entry.startMin || have.endMin !== entry.endMin)) {
      replace.set(entry.id, { ...have, startMin: entry.startMin, endMin: entry.endMin })
    } else {
      skipped++
    }
  }
  if (!fresh.length && !replace.size) return { entries: [...existing], added: 0, updated: 0, skipped }
  return {
    entries: [...existing.map((entry) => replace.get(entry.id) ?? entry), ...fresh],
    added: fresh.length,
    updated: replace.size,
    skipped,
  }
}

export interface ApplyInstagramSessionsResult {
  sessions: number
  added: number
  updated: number
}

/** Paint the sessions onto iPhone Screen Time → Instagram. Safe to repeat. */
export function applyInstagramSessions(sessions: readonly InstagramSession[]): ApplyInstagramSessionsResult {
  if (!sessions.length) return { sessions: 0, added: 0, updated: 0 }
  const penId = ensureIphoneAppPen(INSTAGRAM_APP_NAME)
  const state = useTimeTrackingStore.getState()
  const scope = findIphoneScreenTimeScope(state.scopes)
  if (!scope) return { sessions: sessions.length, added: 0, updated: 0 }
  const incoming = sessions.flatMap((session) => sessionEntries(session, scope.id, penId))
  const merged = mergeSessionEntries(state.entries, state.removedEntryIds ?? [], incoming)
  if (merged.added || merged.updated) useTimeTrackingStore.setState({ entries: merged.entries })
  return { sessions: sessions.length, added: merged.added, updated: merged.updated }
}
