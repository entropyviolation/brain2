/**
 * lib/calibration.ts — Estimate-vs-actual calibration (Brain2 #26/#29)
 *
 * Pure helpers that turn completed tasks into estimation-accuracy insights:
 *  - per-task calibration points (estimated vs actual, ratio, signed error %),
 *  - an aggregate summary (median/mean ratio, bias %, under/over/accurate rates)
 *    with a plain-language insight string,
 *  - a ratio-bucket distribution for a histogram,
 *  - a per-period (day/week/month) trend of median ratio.
 *
 * Definitions
 *  - ratio    = actual / estimated      (1 = perfect; >1 = took longer)
 *  - errorPct = (actual - estimated) / estimated * 100
 *      positive ⇒ UNDER-estimated (reality exceeded the plan)
 *      negative ⇒ OVER-estimated  (finished faster than planned)
 *  - "accurate" = within ±ACCURATE_BAND_PCT of the estimate.
 *
 * Only completed tasks with a positive estimatedDuration and a positive
 * actualDuration are considered (others can't be calibrated).
 */
import type { Task } from "@/lib/types"
import { getWeekString, formatLocalDateKey } from "@/lib/date-utils"

/** A task counts as "accurate" when |errorPct| ≤ this band. */
export const ACCURATE_BAND_PCT = 10

export type CalibrationPeriod = "day" | "week" | "month"

export interface CalibrationPoint {
  taskId: string
  description: string
  estimated: number
  actual: number
  ratio: number
  errorPct: number
  completedAt: Date | null
}

export interface CalibrationSummary {
  count: number
  meanRatio: number
  medianRatio: number
  meanBiasPct: number
  medianBiasPct: number
  /** Fraction (0-1) of tasks that took longer than estimated. */
  underestimateRate: number
  /** Fraction (0-1) of tasks finished faster than estimated. */
  overestimateRate: number
  /** Fraction (0-1) of tasks within ±ACCURATE_BAND_PCT. */
  accurateRate: number
  insight: string
}

export interface RatioBucket {
  label: string
  /** Inclusive lower bound of actual/estimated ratio. */
  min: number
  /** Exclusive upper bound (Infinity for the last bucket). */
  max: number
  count: number
}

export interface CalibrationTrendPoint {
  periodKey: string
  count: number
  medianRatio: number
  medianBiasPct: number
}

function completedDate(task: Task): Date | null {
  if (task.completedDate) {
    const d = task.completedDate instanceof Date ? task.completedDate : new Date(task.completedDate)
    if (!isNaN(d.getTime())) return d
  }
  const review = task.completionReview?.completedAt
  if (review) {
    const d = review instanceof Date ? review : new Date(review)
    if (!isNaN(d.getTime())) return d
  }
  // Fall back to the most recent logged chunk date if available.
  const chunks = task.completedChunks
  if (chunks && chunks.length > 0) {
    const last = chunks[chunks.length - 1].date
    const d = last instanceof Date ? last : new Date(last)
    if (!isNaN(d.getTime())) return d
  }
  return null
}

/** Build calibration points from completed, estimable tasks. */
export function getCalibrationPoints(tasks: Task[]): CalibrationPoint[] {
  const points: CalibrationPoint[] = []
  for (const task of tasks) {
    if (!task.completed) continue
    const estimated = task.estimatedDuration ?? 0
    const actual = task.actualDuration ?? 0
    if (estimated <= 0 || actual <= 0) continue
    points.push({
      taskId: task.id,
      description: task.description || task.title || "Untitled",
      estimated,
      actual,
      ratio: actual / estimated,
      errorPct: ((actual - estimated) / estimated) * 100,
      completedAt: completedDate(task),
    })
  }
  return points
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function summarizeCalibration(points: CalibrationPoint[]): CalibrationSummary {
  const count = points.length
  if (count === 0) {
    return {
      count: 0,
      meanRatio: 0,
      medianRatio: 0,
      meanBiasPct: 0,
      medianBiasPct: 0,
      underestimateRate: 0,
      overestimateRate: 0,
      accurateRate: 0,
      insight: "Complete some tasks with both an estimate and an actual time to see your calibration.",
    }
  }

  const ratios = points.map((p) => p.ratio)
  const biases = points.map((p) => p.errorPct)
  const medianBiasPct = median(biases)
  const underestimateRate = points.filter((p) => p.errorPct > ACCURATE_BAND_PCT).length / count
  const overestimateRate = points.filter((p) => p.errorPct < -ACCURATE_BAND_PCT).length / count
  const accurateRate = points.filter((p) => Math.abs(p.errorPct) <= ACCURATE_BAND_PCT).length / count

  const magnitude = Math.round(Math.abs(medianBiasPct))
  let insight: string
  if (Math.abs(medianBiasPct) <= ACCURATE_BAND_PCT) {
    insight = `Well calibrated — your estimates are typically within ${ACCURATE_BAND_PCT}% of reality.`
  } else if (medianBiasPct > 0) {
    insight = `You typically underestimate by ${magnitude}% — tasks take longer than you plan.`
  } else {
    insight = `You typically overestimate by ${magnitude}% — tasks finish faster than you plan.`
  }

  return {
    count,
    meanRatio: mean(ratios),
    medianRatio: median(ratios),
    meanBiasPct: mean(biases),
    medianBiasPct,
    underestimateRate,
    overestimateRate,
    accurateRate,
    insight,
  }
}

const BUCKET_DEFS: { label: string; min: number; max: number }[] = [
  { label: "≤0.5× (way over)", min: 0, max: 0.5 },
  { label: "0.5–0.8× (over)", min: 0.5, max: 0.8 },
  { label: "0.8–1.2× (accurate)", min: 0.8, max: 1.2 },
  { label: "1.2–2× (under)", min: 1.2, max: 2 },
  { label: ">2× (way under)", min: 2, max: Infinity },
]

export function ratioDistribution(points: CalibrationPoint[]): RatioBucket[] {
  return BUCKET_DEFS.map((def) => ({
    ...def,
    count: points.filter((p) => p.ratio >= def.min && p.ratio < def.max).length,
  }))
}

function periodKeyFor(date: Date, period: CalibrationPeriod): string {
  switch (period) {
    case "day":
      return formatLocalDateKey(date)
    case "week":
      return getWeekString(date)
    case "month":
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
  }
}

/**
 * Median ratio + bias per period, ordered chronologically. Points without a
 * resolvable completion date are skipped (can't be placed on the timeline).
 */
export function calibrationTrend(
  points: CalibrationPoint[],
  period: CalibrationPeriod = "week",
): CalibrationTrendPoint[] {
  const groups = new Map<string, CalibrationPoint[]>()
  for (const p of points) {
    if (!p.completedAt) continue
    const key = periodKeyFor(p.completedAt, period)
    const list = groups.get(key) ?? []
    list.push(p)
    groups.set(key, list)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([periodKey, list]) => ({
      periodKey,
      count: list.length,
      medianRatio: median(list.map((p) => p.ratio)),
      medianBiasPct: median(list.map((p) => p.errorPct)),
    }))
}
