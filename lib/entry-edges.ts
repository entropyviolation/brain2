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
