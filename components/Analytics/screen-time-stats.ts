/**
 * components/Analytics/screen-time-stats.ts — Pure helpers for the Screen Time tab
 *
 * Anchors give an app total a familiar size (Information is Beautiful,
 * "Million Lines of Code"). The hour profile and the overlap split are plain
 * arithmetic on the hour × day grid and unique minutes. No store reads.
 */
import type { HourDayGrid } from "./hour-day"

export type Anchor = { name: string; minutes: number }

/** Familiar durations, smallest first. */
export const ANCHORS: readonly Anchor[] = [
  { name: "a feature film", minutes: 120 },
  { name: "a workday", minutes: 8 * 60 },
  { name: "London → Tokyo flight", minutes: 14 * 60 },
  { name: "reading War and Peace", minutes: 32 * 60 },
  { name: "a 40-hour work week", minutes: 40 * 60 },
  { name: "all of Game of Thrones", minutes: 70 * 60 },
]

/** Anchors that fit on a scale whose top is `max` minutes. Always at least the smallest. */
export function anchorsFor(max: number): Anchor[] {
  const fit = ANCHORS.filter((a) => a.minutes <= max * 1.25)
  return fit.length > 0 ? fit : [ANCHORS[0]!]
}

export type RankRow = { id: string; name: string; minutes: number; color?: string; anchor?: boolean }

/** Data rows and anchor rows in one list, sorted by minutes descending. */
export function rankWithAnchors(rows: readonly RankRow[], anchors: readonly Anchor[]): RankRow[] {
  const merged: RankRow[] = [
    ...rows,
    ...anchors.map((a) => ({ id: `anchor:${a.name}`, name: a.name, minutes: a.minutes, anchor: true })),
  ]
  return merged.sort((a, b) => b.minutes - a.minutes)
}

/** Mean minutes per clock hour over days that have any paint. */
export function hourProfile(grid: HourDayGrid): { mean: number[]; days: number; peakHour: number | null } {
  const sums = Array.from({ length: 24 }, () => 0)
  let days = 0
  for (const row of grid.minutes) {
    if (row.reduce((s, n) => s + n, 0) <= 0) continue
    days++
    row.forEach((n, h) => (sums[h] += n))
  }
  const mean = sums.map((n) => (days ? n / days : 0))
  let peakHour: number | null = null
  mean.forEach((n, h) => {
    if (n > 0 && (peakHour === null || n > mean[peakHour]!)) peakHour = h
  })
  return { mean, days, peakHour }
}

/** Screen-only, both, and Activity-only minutes. Shares are of the union. */
export function overlapSplit(screen: number, activity: number, both: number) {
  const union = Math.max(1, screen + activity - both)
  const screenOnly = Math.max(0, screen - both)
  const activityOnly = Math.max(0, activity - both)
  return {
    screenOnly,
    both,
    activityOnly,
    shares: [screenOnly / union, both / union, activityOnly / union] as const,
  }
}
