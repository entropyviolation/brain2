/**
 * lib/health-report.ts — Rollups for Data → Sources → Health
 *
 * Pure. Reads the daily rows the iPhone import wrote (`HealthDay`), the
 * workouts it painted on Activity, and the sleep minutes of the same mornings.
 * A day Health had nothing for is left out of every mean, never counted as 0.
 * Every comparison names its n; `HEALTH_FLOORS` says when a sentence is held back.
 */
import type { HealthDay } from "@/lib/phone-sync/health"
import { mean, pearson } from "@/lib/metrics"

export const HEALTH_FLOORS = { trend: 14, weekday: 14, link: 7 } as const

export type HealthMetric = "steps" | "distanceM" | "flights" | "activeKcal" | "heartAvg"

export const HEALTH_METRICS: { id: HealthMetric; label: string; unit: string }[] = [
  { id: "steps", label: "Steps", unit: "" },
  { id: "distanceM", label: "Walking + running", unit: " km" },
  { id: "flights", label: "Flights climbed", unit: "" },
  { id: "activeKcal", label: "Active energy", unit: " kcal" },
  { id: "heartAvg", label: "Heart rate (avg)", unit: " bpm" },
]

/** Distance is stored in metres; the page speaks kilometres. */
export function metricValue(day: HealthDay, metric: HealthMetric): number | undefined {
  const v = day[metric]
  if (v === undefined) return undefined
  return metric === "distanceM" ? v / 1000 : v
}

export function healthDaysIn(days: Record<string, HealthDay>, dateKeys: readonly string[]): HealthDay[] {
  const out: HealthDay[] = []
  for (const key of dateKeys) if (days[key]) out.push(days[key])
  return out
}

export function metricSeries(
  days: Record<string, HealthDay>,
  dateKeys: readonly string[],
  metric: HealthMetric,
): { x: string; y: number }[] {
  const out: { x: string; y: number }[] = []
  for (const key of dateKeys) {
    const day = days[key]
    const y = day ? metricValue(day, metric) : undefined
    if (y !== undefined) out.push({ x: key.slice(5), y })
  }
  return out
}

export interface MetricSummary {
  n: number
  mean: number
  median: number
  best?: { date: string; value: number }
}

export function summarize(
  days: Record<string, HealthDay>,
  dateKeys: readonly string[],
  metric: HealthMetric,
): MetricSummary {
  const rows: { date: string; value: number }[] = []
  for (const key of dateKeys) {
    const day = days[key]
    const value = day ? metricValue(day, metric) : undefined
    if (value !== undefined) rows.push({ date: key, value })
  }
  if (rows.length === 0) return { n: 0, mean: 0, median: 0 }
  const sorted = rows.map((r) => r.value).sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
  const best = rows.reduce((a, b) => (b.value > a.value ? b : a))
  return { n: rows.length, mean: mean(rows.map((r) => r.value)), median, best }
}

/** Mean per weekday (Sunday = 0). A weekday with no days is null. */
export function weekdayMeans(
  days: Record<string, HealthDay>,
  dateKeys: readonly string[],
  metric: HealthMetric,
  weekdayOf: (key: string) => number,
): { mean: number | null; n: number }[] {
  const buckets: number[][] = Array.from({ length: 7 }, () => [])
  for (const key of dateKeys) {
    const day = days[key]
    const value = day ? metricValue(day, metric) : undefined
    if (value !== undefined) buckets[weekdayOf(key)].push(value)
  }
  return buckets.map((b) => ({ mean: b.length ? mean(b) : null, n: b.length }))
}

export interface HealthTrend {
  earlierMean: number
  laterMean: number
  earlierN: number
  laterN: number
  /** Later minus earlier, as a share of earlier. */
  change: number
}

/** Later half of the window against the earlier half. Null below the floor. */
export function metricTrend(
  days: Record<string, HealthDay>,
  dateKeys: readonly string[],
  metric: HealthMetric,
): HealthTrend | null {
  const half = Math.floor(dateKeys.length / 2)
  const a = summarize(days, dateKeys.slice(0, half), metric)
  const b = summarize(days, dateKeys.slice(half), metric)
  if (a.n + b.n < HEALTH_FLOORS.trend || a.n < 3 || b.n < 3 || a.mean === 0) return null
  return { earlierMean: a.mean, laterMean: b.mean, earlierN: a.n, laterN: b.n, change: (b.mean - a.mean) / a.mean }
}

export interface WorkoutRow {
  activity: string
  count: number
  minutes: number
}

/** Workouts the import painted, by activity, from the Activity-grid spans. */
export function workoutRows(
  entries: readonly { spanId?: string; title?: string; date: string; startMin: number; endMin: number; generatedBy?: { id?: string } }[],
  dateKeys: ReadonlySet<string>,
): WorkoutRow[] {
  const spans = new Map<string, { activity: string; minutes: number }>()
  for (const e of entries) {
    if (!e.generatedBy?.id?.startsWith("health:") || !dateKeys.has(e.date)) continue
    const id = e.spanId ?? e.generatedBy.id
    const span = spans.get(id) ?? { activity: e.title || "Workout", minutes: 0 }
    span.minutes += Math.max(0, e.endMin - e.startMin)
    spans.set(id, span)
  }
  const by = new Map<string, WorkoutRow>()
  for (const { activity, minutes } of spans.values()) {
    const row = by.get(activity) ?? { activity, count: 0, minutes: 0 }
    row.count++
    row.minutes += minutes
    by.set(activity, row)
  }
  return [...by.values()].sort((a, b) => b.minutes - a.minutes)
}

export interface HealthLink {
  n: number
  r: number
}

/**
 * Pearson r of one health metric against the same mornings' other series,
 * on days both have. Null below the floor. Describes these days only.
 */
export function metricLink(
  days: Record<string, HealthDay>,
  dateKeys: readonly string[],
  metric: HealthMetric,
  other: Record<string, number>,
): HealthLink | null {
  const a: number[] = []
  const b: number[] = []
  for (const key of dateKeys) {
    const day = days[key]
    const v = day ? metricValue(day, metric) : undefined
    const o = other[key]
    if (v !== undefined && o !== undefined) {
      a.push(v)
      b.push(o)
    }
  }
  if (a.length < HEALTH_FLOORS.link) return null
  return { n: a.length, r: pearson(a, b) }
}

/** Active days: the share of days with data whose steps reached `goal`. */
export function shareAtOrAbove(
  days: Record<string, HealthDay>,
  dateKeys: readonly string[],
  goal: number,
): { hit: number; n: number } {
  let hit = 0
  let n = 0
  for (const key of dateKeys) {
    const steps = days[key]?.steps
    if (steps === undefined) continue
    n++
    if (steps >= goal) hit++
  }
  return { hit, n }
}
