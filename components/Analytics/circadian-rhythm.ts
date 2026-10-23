/**
 * components/Analytics/circadian-rhythm.ts — Nonparametric rhythm numbers
 *
 * Pure. Van Someren et al. 1999 (Chronobiol Int 16:505), the measures used
 * on actigraphy, run here on painted occupancy (minutes per clock hour):
 *
 * - IS, interdaily stability (0–1): how alike the days are.
 * - IV, intradaily variability (0–2+): how fragmented a day is, hour to hour.
 * - M10 / L5: the busiest 10 and quietest 5 consecutive hours of the mean day.
 * - RA, relative amplitude: (M10 − L5) / (M10 + L5).
 *
 * Only days with paint enter. A blank day is missing, not a flat day.
 */
import type { HourDayGrid } from "./hour-day"

export const RHYTHM_FLOOR_DAYS = 3

export type RhythmStats = {
  days: number
  is: number
  iv: number
  m10: number
  m10Start: number
  l5: number
  l5Start: number
  ra: number
}

function windowMean(profile: readonly number[], start: number, len: number): number {
  let s = 0
  for (let i = 0; i < len; i++) s += profile[(start + i) % 24]!
  return s / len
}

function extremeWindow(profile: readonly number[], len: number, pick: "max" | "min") {
  let best = { start: 0, value: windowMean(profile, 0, len) }
  for (let start = 1; start < 24; start++) {
    const value = windowMean(profile, start, len)
    if (pick === "max" ? value > best.value : value < best.value) best = { start, value }
  }
  return best
}

export function rhythmStats(grid: Pick<HourDayGrid, "minutes">): RhythmStats | null {
  const rows = grid.minutes.filter((row) => row.some((n) => n > 0))
  if (rows.length < RHYTHM_FLOOR_DAYS) return null
  const series = rows.flat()
  const n = series.length
  const mean = series.reduce((a, b) => a + b, 0) / n
  const total = series.reduce((s, x) => s + (x - mean) ** 2, 0)
  if (total === 0) return null
  const profile = Array.from({ length: 24 }, (_, h) => rows.reduce((s, row) => s + row[h]!, 0) / rows.length)
  const between = profile.reduce((s, x) => s + (x - mean) ** 2, 0)
  let diffs = 0
  for (let i = 1; i < n; i++) diffs += (series[i]! - series[i - 1]!) ** 2
  const m10 = extremeWindow(profile, 10, "max")
  const l5 = extremeWindow(profile, 5, "min")
  return {
    days: rows.length,
    is: (n * between) / (24 * total),
    iv: (n * diffs) / ((n - 1) * total),
    m10: m10.value,
    m10Start: m10.start,
    l5: l5.value,
    l5Start: l5.start,
    ra: m10.value + l5.value > 0 ? (m10.value - l5.value) / (m10.value + l5.value) : 0,
  }
}

export type DayFilter = "all" | "weekdays" | "weekend"

export function filterDays(dateKeys: readonly string[], filter: DayFilter): string[] {
  if (filter === "all") return [...dateKeys]
  return dateKeys.filter((key) => {
    const d = new Date(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))).getDay()
    const weekend = d === 0 || d === 6
    return filter === "weekend" ? weekend : !weekend
  })
}
