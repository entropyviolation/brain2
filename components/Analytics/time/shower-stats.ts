/**
 * components/Analytics/time/shower-stats.ts — Shower gaps from count ticks
 *
 * Pure. Days since last shower is as of `today`, not clipped to the range.
 * A gap is calendar days from one tick's date to the next. The open stretch
 * after the last shower is not inside the mean.
 */
import type { CountTick } from "@/lib/count-statuses"
import { parseLocalDate } from "@/lib/date-utils"

export type ShowerGapStats = {
  daysSince: number | null
  showersInWindow: number
  gapCount: number
  averageGapDays: number | null
  longestGapDays: number | null
  hourGapCount: number
  averageGapHours: number | null
}

export function calendarDaysBetween(earlier: string, later: string): number {
  const a = parseLocalDate(earlier)
  const b = parseLocalDate(later)
  if (!a || !b) return 0
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function dayIndex(key: string): number {
  const d = parseLocalDate(key)
  return d ? Math.round(d.getTime() / 86_400_000) : 0
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

export function showerGapStats(
  ticks: readonly CountTick[],
  range: readonly string[],
  today: string,
): ShowerGapStats {
  const sorted = [...ticks].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
  const inRange = new Set(range)
  const latest = sorted[sorted.length - 1]
  const dayGaps: number[] = []
  const hourGaps: number[] = []
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]!
    const next = sorted[i]!
    if (!inRange.has(next.date)) continue
    dayGaps.push(calendarDaysBetween(prev.date, next.date))
    if (prev.clockCertainty === "unknown" || next.clockCertainty === "unknown") continue
    const minutes = dayIndex(next.date) * 1440 + next.startMin - (dayIndex(prev.date) * 1440 + prev.startMin)
    hourGaps.push(minutes / 60)
  }
  return {
    daysSince: latest ? calendarDaysBetween(latest.date, today) : null,
    showersInWindow: ticks.filter((tick) => inRange.has(tick.date)).length,
    gapCount: dayGaps.length,
    averageGapDays: dayGaps.length ? round1(mean(dayGaps)) : null,
    longestGapDays: dayGaps.length ? Math.max(...dayGaps) : null,
    hourGapCount: hourGaps.length,
    averageGapHours: hourGaps.length ? round1(mean(hourGaps)) : null,
  }
}
