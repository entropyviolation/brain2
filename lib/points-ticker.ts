/**
 * lib/points-ticker.ts — Points as a market ticker
 *
 * Pure reads of the points ledger for the Home Points tile: the value for the
 * chosen period, the previous period's value, the change between them, and a
 * series to chart. Same entries and week rule (Monday start) as
 * `lib/points-store.ts`; nothing here writes.
 *
 * - day:   today vs yesterday; chart is the last 14 days.
 * - week:  this week vs last week; chart is the last 12 weeks.
 * - month: this month vs last month; chart is the last 12 months.
 * - all:   all-time total vs 30 days ago; chart is the running total over 90 days.
 */

import { addDays, addMonths, addWeeks, format, startOfMonth, startOfWeek } from "date-fns"

export type TickerPeriod = "day" | "week" | "month" | "all"

export const TICKER_PERIODS: { id: TickerPeriod; key: string; label: string; vs: string }[] = [
  { id: "day", key: "D", label: "Today", vs: "vs yesterday" },
  { id: "week", key: "W", label: "This week", vs: "vs last week" },
  { id: "month", key: "M", label: "This month", vs: "vs last month" },
  { id: "all", key: "ALL", label: "All time", vs: "vs 30 days ago" },
]

export interface TickerEntry {
  date: string // YYYY-MM-DD
  points: number
}

export interface PointsTicker {
  period: TickerPeriod
  value: number
  previous: number
  delta: number
  /** Percent change from `previous`; null when there is nothing to compare against. */
  changePct: number | null
  direction: "up" | "down" | "flat"
  series: number[]
}

const ALL_WINDOW_DAYS = 90
const ALL_COMPARE_DAYS = 30

function dayKey(d: Date): string {
  return format(d, "yyyy-MM-dd")
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

/** Sum of points per local day key. */
export function pointsByDay(entries: readonly TickerEntry[]): Map<string, number> {
  const byDay = new Map<string, number>()
  for (const e of entries) {
    if (!Number.isFinite(e.points)) continue
    byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.points)
  }
  return byDay
}

function sumRange(byDay: Map<string, number>, start: Date, endExclusive: Date): number {
  let total = 0
  for (let d = start; d < endExclusive; d = addDays(d, 1)) total += byDay.get(dayKey(d)) ?? 0
  return total
}

function sumThrough(byDay: Map<string, number>, through: Date): number {
  const limit = dayKey(through)
  let total = 0
  for (const [key, pts] of byDay) if (key <= limit) total += pts
  return total
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function pointsTicker(entries: readonly TickerEntry[], period: TickerPeriod, asOf: Date): PointsTicker {
  const byDay = pointsByDay(entries)
  const today = startOfDay(asOf)
  let value = 0
  let previous = 0
  const series: number[] = []

  if (period === "day") {
    for (let i = 13; i >= 0; i -= 1) series.push(byDay.get(dayKey(addDays(today, -i))) ?? 0)
    value = series[series.length - 1]!
    previous = series[series.length - 2]!
  } else if (period === "week") {
    const thisWeek = startOfWeek(today, { weekStartsOn: 1 })
    for (let i = 11; i >= 0; i -= 1) {
      const start = addWeeks(thisWeek, -i)
      series.push(sumRange(byDay, start, addWeeks(start, 1)))
    }
    value = series[series.length - 1]!
    previous = series[series.length - 2]!
  } else if (period === "month") {
    const thisMonth = startOfMonth(today)
    for (let i = 11; i >= 0; i -= 1) {
      const start = addMonths(thisMonth, -i)
      series.push(sumRange(byDay, start, addMonths(start, 1)))
    }
    value = series[series.length - 1]!
    previous = series[series.length - 2]!
  } else {
    const windowStart = addDays(today, -(ALL_WINDOW_DAYS - 1))
    let running = sumThrough(byDay, addDays(windowStart, -1))
    for (let d = windowStart; d <= today; d = addDays(d, 1)) {
      running += byDay.get(dayKey(d)) ?? 0
      series.push(running)
    }
    value = series[series.length - 1]!
    previous = series[series.length - 1 - ALL_COMPARE_DAYS] ?? 0
  }

  value = round2(value)
  previous = round2(previous)
  const delta = round2(value - previous)
  const changePct = previous !== 0 ? round2((delta / Math.abs(previous)) * 100) : null
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  return { period, value, previous, delta, changePct, direction, series: series.map(round2) }
}

/** "+12.5%", "−4%", "new", or "0%". */
export function formatTickerChange(t: Pick<PointsTicker, "changePct" | "direction">): string {
  if (t.changePct === null) return t.direction === "flat" ? "0%" : "new"
  const abs = Math.abs(t.changePct)
  const shown = abs >= 100 ? Math.round(abs).toLocaleString() : abs.toLocaleString(undefined, { maximumFractionDigits: 1 })
  if (t.direction === "flat") return "0%"
  return `${t.direction === "up" ? "+" : "−"}${shown}%`
}

export function formatTickerPoints(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export function formatTickerDelta(delta: number): string {
  if (delta === 0) return "±0"
  return `${delta > 0 ? "+" : "−"}${formatTickerPoints(Math.abs(delta))}`
}
