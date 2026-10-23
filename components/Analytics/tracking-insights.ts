/**
 * components/Analytics/tracking-insights.ts — Math for the added Tracking plates
 *
 * Sized squares, pace, mirror split, block-length threshold, day edges.
 * Docs: `docs/analytics/time-tracking.md`.
 *
 * Pure: no store.
 */
import type { PeriodDeltaRow } from "./period-delta"

export const DAY_MINUTES = 1440

type Slice = { id: string; name: string; color: string; minutes: number }

export type SizedSquare = Slice & {
  /** Minutes shown: per day or the whole window. */
  shown: number
  /** Shown minutes in days (1 = one 24h day, the anchor square). */
  days: number
}

/** Squares by area. Per-day mode divides by the window's days. Zero-minute pens drop. */
export function sizedSquares(slices: readonly Slice[], dayCount: number, mode: "day" | "window"): SizedSquare[] {
  const divisor = mode === "day" ? Math.max(1, dayCount) : 1
  return slices
    .filter((s) => s.minutes > 0)
    .map((s) => {
      const shown = s.minutes / divisor
      return { ...s, shown, days: shown / DAY_MINUTES }
    })
    .sort((a, b) => b.shown - a.shown)
}

/** Side of a square whose area is `days` anchor squares of side `anchorPx`. */
export function squareSide(days: number, anchorPx: number): number {
  return Math.sqrt(Math.max(0, days)) * anchorPx
}

export type Pace = {
  perDay: number
  perWeek: number
  perYear: number
  /** Whole 24h days per year. */
  yearDays: number
  /** Share of waking minutes, 0–1. */
  awakeShare: number
  /** Minutes over the horizon. */
  horizonMinutes: number
  /** Waking years over the horizon (horizonMinutes / awake minutes per year). */
  horizonAwakeYears: number
}

/** Rate clock: a window total as per day / week / year, and over a horizon in years. */
export function paceOf(minutes: number, dayCount: number, awakeHours: number, horizonYears: number): Pace {
  const perDay = dayCount > 0 ? minutes / dayCount : 0
  const awakePerDay = Math.max(1, awakeHours) * 60
  const perYear = perDay * 365.25
  const horizonMinutes = perYear * Math.max(0, horizonYears)
  return {
    perDay,
    perWeek: perDay * 7,
    perYear,
    yearDays: perYear / DAY_MINUTES,
    awakeShare: Math.min(1, perDay / awakePerDay),
    horizonMinutes,
    horizonAwakeYears: horizonMinutes / (awakePerDay * 365.25),
  }
}

export type MirrorSort = "delta" | "now" | "before" | "name"

/** Rows for the mirror split: filter by name, sort, keep the top `limit`. */
export function mirrorRows(
  rows: readonly PeriodDeltaRow[],
  { sort, limit, query }: { sort: MirrorSort; limit: number; query: string },
): PeriodDeltaRow[] {
  const q = query.trim().toLowerCase()
  const kept = q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : [...rows]
  kept.sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name)
    if (sort === "now") return b.currentMinutes - a.currentMinutes
    if (sort === "before") return b.previousMinutes - a.previousMinutes
    return Math.abs(b.deltaMinutes) - Math.abs(a.deltaMinutes)
  })
  return kept.slice(0, Math.max(1, limit))
}

function quantile(sorted: readonly number[], q: number): number {
  if (sorted.length === 0) return 0
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export type LengthStats = {
  n: number
  total: number
  mean: number
  median: number
  p90: number
  max: number
  /** Blocks at or over the threshold. */
  longCount: number
  longMinutes: number
  /** Share of blocks at or over the threshold, 0–1. */
  longBlockShare: number
  /** Share of minutes that sit in those blocks, 0–1. */
  longMinuteShare: number
}

/** Block-length summary plus a threshold cut ("blocks of at least X min"). */
export function lengthStats(lengths: readonly number[], threshold: number): LengthStats {
  const sorted = lengths.filter((v) => v > 0).sort((a, b) => a - b)
  const total = sorted.reduce((sum, v) => sum + v, 0)
  const long = sorted.filter((v) => v >= threshold)
  const longMinutes = long.reduce((sum, v) => sum + v, 0)
  return {
    n: sorted.length,
    total,
    mean: sorted.length ? total / sorted.length : 0,
    median: quantile(sorted, 0.5),
    p90: quantile(sorted, 0.9),
    max: sorted[sorted.length - 1] ?? 0,
    longCount: long.length,
    longMinutes,
    longBlockShare: sorted.length ? long.length / sorted.length : 0,
    longMinuteShare: total ? longMinutes / total : 0,
  }
}

export type DayEdges = {
  days: number
  medianFirst: number | null
  medianLast: number | null
  medianSpan: number | null
  earliestFirst: number | null
  latestLast: number | null
}

/** First start and last end of lasting blocks on each day with data, then medians. */
export function dayEdges(
  entries: readonly { date: string; startMin: number; endMin: number; kind?: string }[],
  dateKeys: readonly string[],
): DayEdges {
  const wanted = new Set(dateKeys)
  const byDay = new Map<string, { first: number; last: number }>()
  for (const e of entries) {
    if (e.kind === "instant" || !wanted.has(e.date) || e.endMin <= e.startMin) continue
    const start = Math.max(0, e.startMin)
    const end = Math.min(DAY_MINUTES, e.endMin)
    const day = byDay.get(e.date)
    if (!day) byDay.set(e.date, { first: start, last: end })
    else {
      day.first = Math.min(day.first, start)
      day.last = Math.max(day.last, end)
    }
  }
  const days = [...byDay.values()]
  if (days.length === 0) {
    return { days: 0, medianFirst: null, medianLast: null, medianSpan: null, earliestFirst: null, latestLast: null }
  }
  const firsts = days.map((d) => d.first).sort((a, b) => a - b)
  const lasts = days.map((d) => d.last).sort((a, b) => a - b)
  const spans = days.map((d) => d.last - d.first).sort((a, b) => a - b)
  return {
    days: days.length,
    medianFirst: quantile(firsts, 0.5),
    medianLast: quantile(lasts, 0.5),
    medianSpan: quantile(spans, 0.5),
    earliestFirst: firsts[0],
    latestLast: lasts[lasts.length - 1],
  }
}
