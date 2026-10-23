/**
 * components/Analytics/meta-math.ts — Small classical helpers for the Meta views
 *
 * Pure. Fisher-z intervals for Pearson r, lagged cross-correlation, the
 * autocorrelation function with its white-noise band, rolling means, and
 * metric readings folded to one value per local day. No model.
 * Docs: `docs/analytics/meta-observatory.md`, `meta-correlation.md`, `meta-spectrum.md`.
 */
import { autocorrelation, mean, pearson, stddev, type SeriesPoint } from "@/lib/metrics"
import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import { dateKeyOf } from "./analytics-range"

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}

/** 95% interval for Pearson r by Fisher z. Null when n < 4 (z needs n − 3 > 0). */
export function fisherInterval(r: number, n: number, z = 1.96): { lo: number; hi: number } | null {
  if (!Number.isFinite(r) || n < 4) return null
  const clipped = Math.max(-0.999999, Math.min(0.999999, r))
  const fz = Math.atanh(clipped)
  const se = 1 / Math.sqrt(n - 3)
  return { lo: Math.tanh(fz - z * se), hi: Math.tanh(fz + z * se) }
}

/** True when the 95% interval excludes 0. */
export function intervalClearsZero(r: number, n: number): boolean {
  const ci = fisherInterval(r, n)
  return ci !== null && (ci.lo > 0 || ci.hi < 0)
}

/**
 * Pearson r of a(t) against b(t + lag) on calendar days. lag > 0 asks
 * "does today's A go with B `lag` days later?". Inner join; missing stays out.
 */
export function laggedCorrelation(a: readonly SeriesPoint[], b: readonly SeriesPoint[], lag: number): { r: number; n: number } {
  const bMap = new Map(b.map((p) => [p.date, p.value]))
  const xs: number[] = []
  const ys: number[] = []
  for (const p of a) {
    const d = parseLocalDate(p.date)
    if (!d || !Number.isFinite(p.value)) continue
    const other = bMap.get(formatLocalDateKey(addDays(d, lag)))
    if (other === undefined || !Number.isFinite(other)) continue
    xs.push(p.value)
    ys.push(other)
  }
  return { r: xs.length >= 2 ? pearson(xs, ys) : 0, n: xs.length }
}

/** r(k) for k = 1..maxLag. Bars a correlogram draws. */
export function acf(values: readonly number[], maxLag: number): { k: number; r: number }[] {
  const xs = values.filter((v) => Number.isFinite(v))
  const out: { k: number; r: number }[] = []
  for (let k = 1; k <= maxLag && xs.length - k >= 3; k++) out.push({ k, r: autocorrelation(xs, k) })
  return out
}

/** ±1.96/√n: the band a white-noise series stays inside about 95% of the time. */
export function whiteNoiseBand(n: number): number {
  return n > 0 ? 1.96 / Math.sqrt(n) : 1
}

/** Trailing mean over `window` points (shorter at the start). */
export function rollingMean(values: readonly number[], window: number): number[] {
  const w = Math.max(1, Math.floor(window))
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= w) sum -= values[i - w]
    out.push(sum / Math.min(i + 1, w))
  }
  return out
}

export interface SummaryStats {
  n: number
  mean: number
  sd: number
  min: number
  max: number
  median: number
}

export function summaryStats(values: readonly number[]): SummaryStats | null {
  const xs = values.filter((v) => Number.isFinite(v))
  if (xs.length === 0) return null
  const sorted = xs.slice().sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return {
    n: xs.length,
    mean: mean(xs),
    sd: stddev(xs),
    min: sorted[0],
    max: sorted[sorted.length - 1],
    median: sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2,
  }
}

/**
 * Metric readings carry a timestamp. Fold them to one mean per local day so
 * they can join day-keyed series (habit %, sleep, points). Days outside
 * `keySet` drop.
 */
export function dailyMeans(
  readings: readonly { at: string; value: number | undefined }[],
  keySet: ReadonlySet<string>,
): SeriesPoint[] {
  const sums = new Map<string, { s: number; n: number }>()
  for (const r of readings) {
    if (r.value === undefined || !Number.isFinite(r.value)) continue
    const key = dateKeyOf(r.at)
    if (!key || !keySet.has(key)) continue
    const prev = sums.get(key) ?? { s: 0, n: 0 }
    prev.s += r.value
    prev.n += 1
    sums.set(key, prev)
  }
  return [...sums.entries()]
    .map(([date, { s, n }]) => ({ date, value: s / n }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

/** Least-squares line through (x, y) pairs, for a scatter's fit. */
export function fitLine(xs: readonly number[], ys: readonly number[]): { slope: number; intercept: number } | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return null
  const mx = mean(xs.slice(0, n))
  const my = mean(ys.slice(0, n))
  let sxy = 0
  let sxx = 0
  for (let i = 0; i < n; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my)
    sxx += (xs[i] - mx) ** 2
  }
  if (sxx === 0) return null
  const slope = sxy / sxx
  return { slope, intercept: my - slope * mx }
}

/** Circular-free spread of bedtimes: σ of minutes from midnight. */
export function spreadMinutes(offsets: readonly number[]): number {
  return offsets.length > 1 ? stddev(offsets.filter((v) => Number.isFinite(v))) : 0
}
