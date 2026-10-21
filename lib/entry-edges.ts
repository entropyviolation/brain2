/**
 * lib/entry-edges.ts — Block ends: per-end certainty, linked events, the next block, transit fit
 *
 * Pure helpers for the Tracking entry dialog. A block's start and end can each
 * be exact, estimated or unknown; the block-wide `clockCertainty` / `precision`
 * stay as the worse of the two so the grid hatch and Analytics keep working.
 */
import { entriesForDay, isInstant, type TimeEntry, type TrackingClockCertainty } from "@/lib/time-entries"

const RANK: Record<TrackingClockCertainty, number> = { exact: 0, estimated: 1, unknown: 2 }

export const certaintyOf = (entry: Pick<TimeEntry, "startCertainty" | "endCertainty">, edge: "start" | "end"): TrackingClockCertainty =>
  (edge === "start" ? entry.startCertainty : entry.endCertainty) ?? "exact"

export function worseOf(a: TrackingClockCertainty, b: TrackingClockCertainty): TrackingClockCertainty {
  return RANK[a] >= RANK[b] ? a : b
}

/** Fields to store for a pair of end certainties. Exact is omitted. */
export function certaintyPatch(start: TrackingClockCertainty, end: TrackingClockCertainty) {
  const worst = worseOf(start, end)
  return {
    startCertainty: start === "exact" ? undefined : start,
    endCertainty: end === "exact" ? undefined : end,
    clockCertainty: worst === "exact" ? undefined : worst,
    precision: worst === "exact" ? undefined : ("estimated" as const),
  }
}

/** Instant events that day (any view), nearest to `minute` first. */
export function nearbyInstants(entries: TimeEntry[], date: string, minute: number, limit = 6): TimeEntry[] {
  return entries
    .filter((e) => e.date === date && isInstant(e))
    .sort((a, b) => Math.abs(a.startMin - minute) - Math.abs(b.startMin - minute))
    .slice(0, limit)
    .sort((a, b) => a.startMin - b.startMin)
}

export interface NextBlock {
  entry: TimeEntry
  /** Minutes between this block's end and the next one's start (0 = back to back). */
  gap: number
}

/** The next recorded block in the same view that day. */
export function nextBlock(entries: TimeEntry[], entry: Pick<TimeEntry, "id" | "date" | "scopeId" | "endMin">): NextBlock | null {
  const next = entriesForDay(entries, entry.date, entry.scopeId)
    .filter((e) => !isInstant(e) && e.id !== entry.id && e.startMin >= entry.endMin)
    .sort((a, b) => a.startMin - b.startMin)[0]
  return next ? { entry: next, gap: next.startMin - entry.endMin } : null
}

/** Arrival window when the departure is uncertain: ±15 min (estimated) or ±45 (unknown). */
export function arrivalWindow(departMin: number, travelMin: number, certainty: TrackingClockCertainty): [number, number] {
  const slack = certainty === "exact" ? 0 : certainty === "estimated" ? 15 : 45
  const at = departMin + travelMin
  return [at - slack, at + slack]
}

/**
 * Refit transit blocks that hang off `changed` after it moved: one that starts
 * where it ended follows its end, one that ends where it began follows its start.
 * Returns id → patch. Length is `minutes(block)` when known, else its stored `transitMin`.
 */
export function refitTransit(
  entries: TimeEntry[],
  changed: Pick<TimeEntry, "id" | "startMin" | "endMin">,
  minutes: (block: TimeEntry) => number | undefined = () => undefined,
): Record<string, Partial<TimeEntry>> {
  const out: Record<string, Partial<TimeEntry>> = {}
  for (const t of entries) {
    if (t.transitFrom === changed.id) {
      const len = Math.max(1, Math.round(minutes(t) ?? t.transitMin ?? t.endMin - t.startMin))
      const next = entries.find((e) => e.id === t.transitTo)
      const start = changed.endMin
      const cap = next ? next.startMin : 1440
      if (cap <= start) continue
      out[t.id] = { startMin: start, endMin: Math.min(start + len, cap), transitMin: len }
    } else if (t.transitTo === changed.id) {
      const len = Math.max(1, Math.round(t.transitMin ?? t.endMin - t.startMin))
      const prev = entries.find((e) => e.id === t.transitFrom)
      const end = changed.startMin
      const floor = prev ? prev.endMin : 0
      if (end <= floor) continue
      out[t.id] = { startMin: Math.max(floor, end - len), endMin: end }
    }
  }
  return out
}

export type Edge = "start" | "end"
export interface EdgeState {
  min: number
  c: TrackingClockCertainty
}

/** One end of a block (or the time of an instant) with how sure it is. */
export function edgeOf(e: TimeEntry, edge: Edge): EdgeState {
  // An older block with only the block-wide value reads as both ends; once either end is stored, omitted means exact.
  const legacy = e.startCertainty === undefined && e.endCertainty === undefined ? e.clockCertainty : undefined
  if (isInstant(e) || edge === "start") return { min: e.startMin, c: e.startCertainty ?? legacy ?? "exact" }
  return { min: e.endMin, c: e.endCertainty ?? legacy ?? "exact" }
}

export type Resolution = { kind: "keep" } | { kind: "snap"; to: EdgeState } | { kind: "conflict" }

/**
 * Two ends that are meant to be the same moment. The more certain one wins and
 * both take its time. Same certainty but different times is a real conflict.
 */
export function resolveEdge(own: EdgeState, other: EdgeState): Resolution {
  if (own.min === other.min) return RANK[own.c] > RANK[other.c] ? { kind: "snap", to: other } : { kind: "keep" }
  if (RANK[own.c] > RANK[other.c]) return { kind: "snap", to: other }
  if (RANK[own.c] < RANK[other.c]) return { kind: "keep" }
  return { kind: "conflict" }
}

/** Patch that sets one end of `e`, keeping the other end's certainty and an "assumed" stamp. */
export function edgePatch(e: TimeEntry, edge: Edge, st: EdgeState): Partial<TimeEntry> {
  if (isInstant(e)) return { startMin: st.min, endMin: st.min, ...certaintyPatch(st.c, st.c) }
  const was = worseOf(edgeOf(e, "start").c, edgeOf(e, "end").c) !== "exact"
  const p = certaintyPatch(edge === "start" ? st.c : edgeOf(e, "start").c, edge === "end" ? st.c : edgeOf(e, "end").c)
  return { ...(edge === "start" ? { startMin: st.min } : { endMin: st.min }), ...p, precision: p.precision ?? (was ? undefined : e.precision) }
}

/** The block next to an edge in the same view: the one before a start, the one after an end. */
export function neighborBlock(entries: TimeEntry[], entry: TimeEntry, edge: Edge): TimeEntry | null {
  if (isInstant(entry)) return null
  if (edge === "end") return nextBlock(entries, entry)?.entry ?? null
  return (
    entriesForDay(entries, entry.date, entry.scopeId)
      .filter((e) => !isInstant(e) && e.id !== entry.id && e.endMin <= entry.startMin)
      .sort((a, b) => b.endMin - a.endMin)[0] ?? null
  )
}

/**
 * After `savedId` was saved, make whatever it is anchored to agree. The saved
 * block's time leads; where the times already match, both take the more certain
 * label. An instant that moved drags the blocks that name it. Returns id → patch.
 */
export function settleAnchors(entries: TimeEntry[], savedId: string): Record<string, Partial<TimeEntry>> {
  const saved = entries.find((e) => e.id === savedId)
  if (!saved) return {}
  const work = new Map(entries.map((e) => [e.id, e]))
  const out: Record<string, Partial<TimeEntry>> = {}
  const put = (id: string, patch: Partial<TimeEntry>) => {
    out[id] = { ...out[id], ...patch }
    work.set(id, { ...work.get(id)!, ...patch })
  }
  const pairs: [Edge, string, Edge][] = []
  if (isInstant(saved)) {
    for (const e of entries) {
      if (e.startEventId === saved.id) pairs.push(["start", e.id, "start"])
      if (e.endEventId === saved.id) pairs.push(["start", e.id, "end"])
    }
  } else {
    if (saved.startEventId) pairs.push(["start", saved.startEventId, "start"])
    if (saved.startJoinId) pairs.push(["start", saved.startJoinId, "end"])
    if (saved.endEventId) pairs.push(["end", saved.endEventId, "start"])
    if (saved.endJoinId) pairs.push(["end", saved.endJoinId, "start"])
  }
  for (const [se, tid, te] of pairs) {
    const s = work.get(saved.id)!
    const t = work.get(tid)
    if (!t) continue
    const a = edgeOf(s, se)
    const b = edgeOf(t, te)
    if (!isInstant(t)) {
      if (te === "start" && a.min >= t.endMin) continue
      if (te === "end" && a.min <= t.startMin) continue
    }
    const same = a.min === b.min
    const c = RANK[a.c] <= RANK[b.c] ? a.c : b.c
    if (same && c !== a.c) put(saved.id, edgePatch(s, se, { min: a.min, c }))
    if (!same || c !== b.c) put(tid, edgePatch(t, te, { min: a.min, c: same ? c : a.c }))
  }
  return out
}

/** True when `a` is strictly more certain than `b`. */
export const surer = (a: TrackingClockCertainty, b: TrackingClockCertainty) => RANK[a] < RANK[b]
