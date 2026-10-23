/**
 * components/Analytics/accuracy-stats.ts — Pure math for the Accuracy views
 *
 * Plan, Calibration, Cycle, Regret and Goals share these helpers. No store
 * reads. Each function takes plain rows so it can be tested alone.
 */

export type BandVerdict = "under" | "on" | "over"

/** Linear-interpolated quantile of an unsorted list (q in 0..1). */
export function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const pos = (sorted.length - 1) * Math.min(1, Math.max(0, q))
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/**
 * Where an actual lands against its estimate. "on" is |actual/est − 1| ≤ band.
 * "over" means it ran over the estimate (took longer). "under" finished early.
 */
export function bandVerdict(ratio: number, bandPct: number): BandVerdict {
  const band = bandPct / 100
  if (Math.abs(ratio - 1) <= band + 1e-9) return "on"
  return ratio > 1 ? "over" : "under"
}

export interface BarcodeRow<T> {
  group: string
  cells: (T & { verdict: BandVerdict })[]
  on: number
}

/** One row per group, one cell per point in time order, for the estimate barcode. */
export function estimateBarcode<T extends { ratio: number; completedAt: Date | null }>(
  points: T[],
  groupOf: (p: T) => string,
  bandPct: number,
): BarcodeRow<T>[] {
  const groups = new Map<string, (T & { verdict: BandVerdict })[]>()
  const sorted = [...points].sort(
    (a, b) => (a.completedAt?.getTime() ?? 0) - (b.completedAt?.getTime() ?? 0),
  )
  for (const p of sorted) {
    const key = groupOf(p)
    const row = groups.get(key) ?? []
    row.push({ ...p, verdict: bandVerdict(p.ratio, bandPct) })
    groups.set(key, row)
  }
  return [...groups.entries()]
    .map(([group, cells]) => ({ group, cells, on: cells.filter((c) => c.verdict === "on").length }))
    .sort((a, b) => b.cells.length - a.cells.length)
}

export interface BiasStats {
  n: number
  /** exp(mean ln ratio): the typical multiplier, robust to one huge overrun. */
  geoMeanRatio: number
  /** Standard deviation of ln ratio. Spread of the misses. */
  logSd: number
  p50: number
  p80: number
  p90: number
}

export function biasStats(ratios: number[]): BiasStats {
  const valid = ratios.filter((r) => r > 0 && Number.isFinite(r))
  const n = valid.length
  if (n === 0) return { n: 0, geoMeanRatio: 0, logSd: 0, p50: 0, p80: 0, p90: 0 }
  const logs = valid.map(Math.log)
  const mu = logs.reduce((s, v) => s + v, 0) / n
  const variance = n > 1 ? logs.reduce((s, v) => s + (v - mu) ** 2, 0) / (n - 1) : 0
  return {
    n,
    geoMeanRatio: Math.exp(mu),
    logSd: Math.sqrt(variance),
    p50: quantile(valid, 0.5),
    p80: quantile(valid, 0.8),
    p90: quantile(valid, 0.9),
  }
}

export const SIZE_BINS: { label: string; min: number; max: number }[] = [
  { label: "≤15m", min: 0, max: 15 },
  { label: "16–60m", min: 15, max: 60 },
  { label: "1–3h", min: 60, max: 180 },
  { label: ">3h", min: 180, max: Infinity },
]

/** Median ratio by the size of the estimate. Tests the "small over, big under" pattern. */
export function ratioBySize(points: { estimated: number; ratio: number }[]) {
  return SIZE_BINS.map((bin) => {
    const ratios = points.filter((p) => p.estimated > bin.min && p.estimated <= bin.max).map((p) => p.ratio)
    return { label: bin.label, n: ratios.length, median: ratios.length ? quantile(ratios, 0.5) : null }
  })
}

export interface PertRow {
  optimistic: number
  likely: number
  pessimistic: number
  actual: number
}

/** PERT mean (o + 4m + p) / 6 and whether the actual fell inside [o, p]. */
export function pertSummary(rows: PertRow[]) {
  let inside = 0
  let past = 0
  let early = 0
  for (const r of rows) {
    if (r.actual < r.optimistic) early++
    else if (r.actual > r.pessimistic) past++
    else inside++
  }
  return { n: rows.length, inside, past, early }
}

export function pertMean(r: { optimistic: number; likely: number; pessimistic: number }): number {
  return (r.optimistic + 4 * r.likely + r.pessimistic) / 6
}

export interface AgeBand {
  label: string
  min: number
  max: number
}

export const AGE_BANDS: AgeBand[] = [
  { label: "< 1 wk", min: 0, max: 7 },
  { label: "1–4 wk", min: 7, max: 28 },
  { label: "1–3 mo", min: 28, max: 91 },
  { label: "3 mo +", min: 91, max: Infinity },
]

export function ageBandIndex(age: number): number {
  const i = AGE_BANDS.findIndex((b) => age >= b.min && age < b.max)
  return i < 0 ? AGE_BANDS.length - 1 : i
}

/**
 * Share of items done, by how many times they were pushed. Shows whether a
 * push is a delay or a quiet drop.
 */
export function doneRateByPushes(rows: { daysPushed?: number; completed?: boolean }[]) {
  const buckets = [
    { label: "0", min: 0, max: 0 },
    { label: "1–2", min: 1, max: 2 },
    { label: "3–6", min: 3, max: 6 },
    { label: "7+", min: 7, max: Infinity },
  ]
  return buckets.map((b) => {
    const inBucket = rows.filter((r) => {
      const n = r.daysPushed ?? 0
      return n >= b.min && n <= b.max
    })
    const done = inBucket.filter((r) => r.completed).length
    return { label: b.label, n: inBucket.length, done, rate: inBucket.length ? done / inBucket.length : null }
  })
}

export interface GoalPace {
  /** 0..1 of the goal's time span that has passed, or null with no span. */
  elapsed: number | null
  /** 0..1 progress toward target. */
  progress: number
  /** progress − elapsed. Positive is ahead of a straight line. */
  gap: number | null
  daysLeft: number | null
  /** Units per day still needed to land on target by the end. */
  neededPerDay: number | null
}

const DAY_MS = 86_400_000

/** Straight-line pace for a goal with a start and an end. */
export function goalPace(
  goal: { target: number; current: number; createdAt: Date; startDate?: Date; endDate?: Date; deadline?: Date },
  now = new Date(),
): GoalPace {
  const progress = goal.target > 0 ? Math.min(1, Math.max(0, goal.current / goal.target)) : 0
  const start = toTime(goal.startDate) ?? toTime(goal.createdAt)
  const end = toTime(goal.deadline) ?? toTime(goal.endDate)
  if (start === null || end === null || end <= start) {
    return { elapsed: null, progress, gap: null, daysLeft: null, neededPerDay: null }
  }
  const elapsed = Math.min(1, Math.max(0, (now.getTime() - start) / (end - start)))
  const daysLeft = Math.max(0, Math.ceil((end - now.getTime()) / DAY_MS))
  const remaining = Math.max(0, goal.target - goal.current)
  return {
    elapsed,
    progress,
    gap: progress - elapsed,
    daysLeft,
    neededPerDay: daysLeft > 0 ? remaining / daysLeft : null,
  }
}

function toTime(value: Date | string | undefined): number | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

/** Squarified-enough layout: side ∝ √value so area reads as amount. */
export function squareSide(value: number, max: number, maxPx: number): number {
  if (max <= 0 || value <= 0) return 0
  return Math.max(6, Math.sqrt(value / max) * maxPx)
}
