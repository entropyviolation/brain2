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

/* ── Detail view: every period, new or cumulative ───────────────────────── */

export type PointsDetailPeriod = "day" | "week" | "month" | "year" | "all"

/** `new` charts the points earned in each bucket; `cumulative` charts the running all-time total at its end. */
export type PointsSeriesMode = "new" | "cumulative"

export const POINTS_DETAIL_PERIODS: { id: PointsDetailPeriod; key: string; label: string; vs: string }[] = [
  { id: "day", key: "D", label: "Today", vs: "vs yesterday" },
  { id: "week", key: "W", label: "This week", vs: "vs last week" },
  { id: "month", key: "M", label: "This month", vs: "vs last month" },
  { id: "year", key: "Y", label: "This year", vs: "vs last year" },
  { id: "all", key: "ALL", label: "All time", vs: "since the first point" },
]

export interface PointsSeriesBucket {
  label: string
  /** Inclusive local start day key. */
  start: string
  value: number
}

export interface PointsPeriodSeries {
  period: PointsDetailPeriod
  mode: PointsSeriesMode
  buckets: PointsSeriesBucket[]
  /** Last bucket's value. */
  value: number
  /** The bucket before it (new), or the running total before this period began (cumulative). */
  previous: number
  delta: number
  changePct: number | null
  direction: "up" | "down" | "flat"
}

interface Bucket {
  start: Date
  endExclusive: Date
  label: string
}

const YEAR_BUCKETS = 6

function detailBuckets(period: PointsDetailPeriod, today: Date, firstDay: Date | null): Bucket[] {
  const out: Bucket[] = []
  if (period === "day") {
    for (let i = 13; i >= 0; i -= 1) {
      const start = addDays(today, -i)
      out.push({ start, endExclusive: addDays(start, 1), label: format(start, "MMM d") })
    }
  } else if (period === "week") {
    const thisWeek = startOfWeek(today, { weekStartsOn: 1 })
    for (let i = 11; i >= 0; i -= 1) {
      const start = addWeeks(thisWeek, -i)
      out.push({ start, endExclusive: addWeeks(start, 1), label: format(start, "MMM d") })
    }
  } else if (period === "month") {
    const thisMonth = startOfMonth(today)
    for (let i = 11; i >= 0; i -= 1) {
      const start = addMonths(thisMonth, -i)
      out.push({ start, endExclusive: addMonths(start, 1), label: format(start, "MMM yy") })
    }
  } else if (period === "year") {
    for (let i = YEAR_BUCKETS - 1; i >= 0; i -= 1) {
      const start = new Date(today.getFullYear() - i, 0, 1)
      out.push({ start, endExclusive: new Date(today.getFullYear() - i + 1, 0, 1), label: String(start.getFullYear()) })
    }
  } else {
    // All time: from the first ledger day to today, at a grain that keeps the chart readable.
    const first = firstDay && firstDay < today ? firstDay : today
    const spanDays = Math.round((today.getTime() - first.getTime()) / 86_400_000)
    if (spanDays <= 90) {
      for (let d = first; d <= today; d = addDays(d, 1)) {
        out.push({ start: d, endExclusive: addDays(d, 1), label: format(d, "MMM d") })
      }
    } else if (spanDays <= 730) {
      for (let d = startOfWeek(first, { weekStartsOn: 1 }); d <= today; d = addWeeks(d, 1)) {
        out.push({ start: d, endExclusive: addWeeks(d, 1), label: format(d, "MMM d yy") })
      }
    } else {
      for (let d = startOfMonth(first); d <= today; d = addMonths(d, 1)) {
        out.push({ start: d, endExclusive: addMonths(d, 1), label: format(d, "MMM yy") })
      }
    }
  }
  return out
}

/**
 * One period's chart for the Points detail. Week rule is Monday start, same as
 * the ticker. Cumulative is the all-time running total at the end of each bucket
 * (clipped to today), so the last value is the all-time total and the change is
 * what this period added.
 */
export function pointsPeriodSeries(
  entries: readonly TickerEntry[],
  period: PointsDetailPeriod,
  asOf: Date,
  mode: PointsSeriesMode,
): PointsPeriodSeries {
  const byDay = pointsByDay(entries)
  const today = startOfDay(asOf)
  let firstKey: string | null = null
  for (const key of byDay.keys()) if (firstKey === null || key < firstKey) firstKey = key
  const firstDay = firstKey ? startOfDay(new Date(`${firstKey}T00:00:00`)) : null
  const buckets = detailBuckets(period, today, firstDay)

  const tomorrow = addDays(today, 1)
  const values = buckets.map((b) => {
    if (mode === "new") return sumRange(byDay, b.start, b.endExclusive < tomorrow ? b.endExclusive : tomorrow)
    const end = b.endExclusive < tomorrow ? b.endExclusive : tomorrow
    return sumThrough(byDay, addDays(end, -1))
  })

  const last = buckets[buckets.length - 1]!
  // All time in New mode heads with the whole window (every point since the first), not the last bucket.
  const value =
    period === "all" && mode === "new"
      ? round2(values.reduce((a, b) => a + b, 0))
      : round2(values[values.length - 1] ?? 0)
  let previous: number
  if (mode === "new") {
    previous = period === "all" ? 0 : round2(values[values.length - 2] ?? 0)
  } else {
    previous = period === "all" ? 0 : round2(sumThrough(byDay, addDays(last.start, -1)))
  }
  const delta = round2(value - previous)
  const changePct = previous !== 0 ? round2((delta / Math.abs(previous)) * 100) : null
  const direction = delta > 0 ? "up" : delta < 0 ? "down" : "flat"
  return {
    period,
    mode,
    buckets: buckets.map((b, i) => ({ label: b.label, start: dayKey(b.start), value: round2(values[i] ?? 0) })),
    value,
    previous,
    delta,
    changePct,
    direction,
  }
}
