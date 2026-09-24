/**
 * lib/metrics.ts — Classical self-tracking analytics (Brain2 #137/#138/#140/#275)
 *
 * Pure, dependency-light statistics over arbitrary user-logged value series.
 * Nothing here touches a store, the network, or any LLM — every function takes
 * plain data in and returns plain data out, so it is trivially testable and can
 * power the Metrics analytics views as well as ad-hoc rollups.
 *
 * Capabilities:
 *  - trend       → least-squares linear regression + rolling slope window,
 *  - correlation → Pearson r over two date-aligned series (inner join by date),
 *  - change-points → windowed mean-shift detection (no parametric assumptions),
 *  - context switches → count of transitions in a tagged sequence (e.g. the
 *    TimeGrid slot pens of a day) plus a per-day series for a heatmap,
 *  - diversity → Shannon entropy (bits) of a weight vector,
 *  - inequality → Gini coefficient and Herfindahl–Hirschman concentration,
 *  - rhythm → lag-k autocorrelation, naive periodogram, coefficient of variation,
 *  - survival → share of open items still older than age t.
 *
 * A "series" is an array of `{ date: "YYYY-MM-DD"; value: number }` points. Dates
 * are parsed as LOCAL calendar days (matching the rest of the app) so x-axis day
 * offsets never drift across time zones.
 */
import { parseLocalDate } from "@/lib/date-utils"

export interface SeriesPoint {
  /** Local calendar date key, YYYY-MM-DD. */
  date: string
  value: number
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

// ---- basic statistics -------------------------------------------------------

export function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((s, v) => s + v, 0) / values.length
}

export function variance(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  return values.reduce((s, v) => s + (v - m) * (v - m), 0) / values.length
}

export function stddev(values: number[]): number {
  return Math.sqrt(variance(values))
}

/** Day index (local) for a YYYY-MM-DD or ISO date string; null if unparseable. */
function dayIndex(date: string): number | null {
  const d = parseLocalDate(date)
  if (!d) return null
  const local = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  return Math.round(local.getTime() / MS_PER_DAY)
}

/** Drop unparseable dates and sort a series chronologically (ascending). */
export function normalizeSeries(series: SeriesPoint[]): SeriesPoint[] {
  return series
    .filter((p) => dayIndex(p.date) !== null && Number.isFinite(p.value))
    .slice()
    .sort((a, b) => (dayIndex(a.date)! - dayIndex(b.date)!))
}

// ---- trend (linear regression) ----------------------------------------------

export interface LinearFit {
  /** Units of value per x-unit. */
  slope: number
  intercept: number
  /** Coefficient of determination (0–1); 0 when undefined. */
  r2: number
  n: number
}

/** Ordinary least-squares fit over explicit (x, y) pairs. */
export function linearRegression(xs: number[], ys: number[]): LinearFit {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return { slope: 0, intercept: n === 1 ? ys[0] : 0, r2: 0, n }
  const mx = mean(xs.slice(0, n))
  const my = mean(ys.slice(0, n))
  let sxx = 0
  let sxy = 0
  let syy = 0
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx
    const dy = ys[i] - my
    sxx += dx * dx
    sxy += dx * dy
    syy += dy * dy
  }
  if (sxx === 0) return { slope: 0, intercept: my, r2: 0, n }
  const slope = sxy / sxx
  const intercept = my - slope * mx
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy)
  return { slope, intercept, r2, n }
}

export interface TrendResult extends LinearFit {
  /** "rising" | "falling" | "flat" based on slope vs. an epsilon. */
  direction: "rising" | "falling" | "flat"
  /** Modeled change per day (same as slope, since x is in days). */
  perDay: number
  /** Modeled total change across the observed span. */
  totalChange: number
}

/**
 * Fit a trend line over a value series, using each point's day offset (from the
 * earliest date) as x. This makes the slope a true per-day rate even when the
 * logging cadence is irregular.
 */
export function trend(series: SeriesPoint[], epsilon = 1e-9): TrendResult {
  const norm = normalizeSeries(series)
  if (norm.length < 2) {
    return {
      slope: 0,
      intercept: norm.length === 1 ? norm[0].value : 0,
      r2: 0,
      n: norm.length,
      direction: "flat",
      perDay: 0,
      totalChange: 0,
    }
  }
  const base = dayIndex(norm[0].date)!
  const xs = norm.map((p) => dayIndex(p.date)! - base)
  const ys = norm.map((p) => p.value)
  const fit = linearRegression(xs, ys)
  const span = xs[xs.length - 1] - xs[0]
  const direction = fit.slope > epsilon ? "rising" : fit.slope < -epsilon ? "falling" : "flat"
  return { ...fit, direction, perDay: fit.slope, totalChange: fit.slope * span }
}

export interface RollingSlopePoint {
  date: string
  slope: number
}

/**
 * Slope of the regression line over a trailing window of `window` points,
 * emitted at each point once enough history exists. Useful to see how a metric's
 * momentum changes over time.
 */
export function rollingSlope(series: SeriesPoint[], window = 7): RollingSlopePoint[] {
  const norm = normalizeSeries(series)
  if (window < 2 || norm.length < window) return []
  const base = dayIndex(norm[0].date)!
  const out: RollingSlopePoint[] = []
  for (let i = window - 1; i < norm.length; i++) {
    const slice = norm.slice(i - window + 1, i + 1)
    const xs = slice.map((p) => dayIndex(p.date)! - base)
    const ys = slice.map((p) => p.value)
    out.push({ date: norm[i].date, slope: linearRegression(xs, ys).slope })
  }
  return out
}

// ---- correlation ------------------------------------------------------------

export interface AlignedSeries {
  dates: string[]
  a: number[]
  b: number[]
}

/** Inner-join two series by date key, preserving chronological order. */
export function alignSeries(seriesA: SeriesPoint[], seriesB: SeriesPoint[]): AlignedSeries {
  const mapB = new Map<string, number>()
  for (const p of normalizeSeries(seriesB)) mapB.set(p.date, p.value)
  const dates: string[] = []
  const a: number[] = []
  const b: number[] = []
  for (const p of normalizeSeries(seriesA)) {
    if (mapB.has(p.date)) {
      dates.push(p.date)
      a.push(p.value)
      b.push(mapB.get(p.date)!)
    }
  }
  return { dates, a, b }
}

/** Pearson correlation coefficient for two equal-length numeric arrays. */
export function pearson(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length)
  if (n < 2) return 0
  const ma = mean(a.slice(0, n))
  const mb = mean(b.slice(0, n))
  let sab = 0
  let saa = 0
  let sbb = 0
  for (let i = 0; i < n; i++) {
    const da = a[i] - ma
    const db = b[i] - mb
    sab += da * db
    saa += da * da
    sbb += db * db
  }
  if (saa === 0 || sbb === 0) return 0
  return sab / Math.sqrt(saa * sbb)
}

export interface CorrelationResult {
  /** Pearson r in [-1, 1]. */
  r: number
  /** Number of overlapping (date-aligned) points used. */
  n: number
  /** r², the shared variance fraction. */
  r2: number
  strength: "none" | "weak" | "moderate" | "strong"
  direction: "positive" | "negative" | "none"
  insight: string
}

/** Correlate two metric series by their overlapping dates. */
export function correlate(
  seriesA: SeriesPoint[],
  seriesB: SeriesPoint[],
  labels: { a?: string; b?: string } = {},
): CorrelationResult {
  const aligned = alignSeries(seriesA, seriesB)
  const n = aligned.dates.length
  const r = pearson(aligned.a, aligned.b)
  const abs = Math.abs(r)
  const strength = n < 2 ? "none" : abs < 0.2 ? "weak" : abs < 0.5 ? "moderate" : "strong"
  const direction = n < 2 || abs < 0.2 ? "none" : r > 0 ? "positive" : "negative"
  const la = labels.a ?? "A"
  const lb = labels.b ?? "B"
  let insight: string
  if (n < 2) {
    insight = `Not enough overlapping days yet — log both metrics on the same days to compare.`
  } else if (direction === "none") {
    insight = `No clear relationship between ${la} and ${lb} (r=${r.toFixed(2)}, n=${n}).`
  } else {
    const verb = direction === "positive" ? "rises" : "falls"
    insight = `${strength[0].toUpperCase()}${strength.slice(1)} ${direction} link: when ${la} rises, ${lb} ${verb} (r=${r.toFixed(2)}, n=${n}). Correlation ≠ causation.`
  }
  return { r, n, r2: r * r, strength, direction, insight }
}

// ---- change-point detection -------------------------------------------------

export interface ChangePoint {
  /** Index into the normalized series at which the shift begins. */
  index: number
  date: string
  meanBefore: number
  meanAfter: number
  /** meanAfter - meanBefore. */
  delta: number
  /** Absolute shift magnitude (the detection score). */
  magnitude: number
}

export interface ChangePointOptions {
  /** Points compared on each side of a candidate boundary. */
  window?: number
  /**
   * Minimum absolute mean shift to report. Defaults to one standard deviation of
   * the whole series, so a "change point" is a shift larger than the metric's
   * usual noise.
   */
  threshold?: number
  /** Minimum spacing (in points) between reported change points. */
  minSeparation?: number
}

/**
 * Detect level shifts via a sliding mean-shift score. For every interior
 * boundary we compare the mean of the trailing `window` points to the mean of
 * the leading `window` points; boundaries whose absolute difference exceeds the
 * threshold and is a local maximum are reported. Pure and non-parametric.
 */
export function detectChangePoints(series: SeriesPoint[], options: ChangePointOptions = {}): ChangePoint[] {
  const norm = normalizeSeries(series)
  const window = Math.max(1, options.window ?? 3)
  const minSeparation = Math.max(1, options.minSeparation ?? window)
  const n = norm.length
  if (n < window * 2) return []

  const values = norm.map((p) => p.value)
  const threshold = options.threshold ?? stddev(values)

  type Cand = { index: number; before: number; after: number; score: number }
  const cands: Cand[] = []
  for (let i = window; i <= n - window; i++) {
    const before = mean(values.slice(i - window, i))
    const after = mean(values.slice(i, i + window))
    const score = Math.abs(after - before)
    cands.push({ index: i, before, after, score })
  }

  // Keep candidates above threshold that are local maxima of the score.
  const picked: Cand[] = []
  for (let k = 0; k < cands.length; k++) {
    const c = cands[k]
    if (c.score < threshold || c.score === 0) continue
    const prev = cands[k - 1]
    const next = cands[k + 1]
    if (prev && prev.score > c.score) continue
    if (next && next.score > c.score) continue
    if (picked.length && c.index - picked[picked.length - 1].index < minSeparation) {
      // Keep the stronger of the two when too close together.
      if (c.score > picked[picked.length - 1].score) picked[picked.length - 1] = c
      continue
    }
    picked.push(c)
  }

  return picked.map((c) => ({
    index: c.index,
    date: norm[c.index].date,
    meanBefore: c.before,
    meanAfter: c.after,
    delta: c.after - c.before,
    magnitude: c.score,
  }))
}

// ---- context switches -------------------------------------------------------

/**
 * Count transitions in a tagged sequence (e.g. one day's TimeGrid pen ids).
 * Consecutive repeats collapse and empty entries (null/undefined/"") are
 * skipped, so [A,A,B,B,A] → 2 and [A,null,A] → 0 while [A,null,B] → 1.
 */
export function countContextSwitches(sequence: Array<string | null | undefined>): number {
  let switches = 0
  let last: string | null = null
  for (const raw of sequence) {
    const v = raw == null || raw === "" ? null : raw
    if (v === null) continue
    if (last !== null && v !== last) switches++
    last = v
  }
  return switches
}

export interface DaySequence {
  date: string
  sequence: Array<string | null | undefined>
}

export interface ContextSwitchPoint {
  date: string
  switches: number
  /** Distinct non-empty tags seen that day. */
  distinct: number
  /** Number of filled (non-empty) slots that day. */
  active: number
}

/** Per-day context-switch counts, sorted chronologically. */
export function contextSwitchSeries(days: DaySequence[]): ContextSwitchPoint[] {
  return days
    .map((d) => {
      const tags = new Set<string>()
      let active = 0
      for (const raw of d.sequence) {
        const v = raw == null || raw === "" ? null : raw
        if (v === null) continue
        active++
        tags.add(v)
      }
      return { date: d.date, switches: countContextSwitches(d.sequence), distinct: tags.size, active }
    })
    .filter((p) => dayIndex(p.date) !== null)
    .sort((a, b) => dayIndex(a.date)! - dayIndex(b.date)!)
}

/** Convert a context-switch series into a plain value series (for trend/etc.). */
export function contextSwitchValueSeries(points: ContextSwitchPoint[]): SeriesPoint[] {
  return points.map((p) => ({ date: p.date, value: p.switches }))
}

// ---- diversity / inequality / rhythm ----------------------------------------

function sharesOf(weights: number[]): number[] {
  const cleaned = weights.filter((w) => Number.isFinite(w) && w > 0)
  const total = cleaned.reduce((s, w) => s + w, 0)
  if (total <= 0) return []
  return cleaned.map((w) => w / total)
}

/**
 * Shannon entropy in bits: H = −Σ pᵢ log₂ pᵢ after normalizing non-negative
 * weights. Zero when one bucket takes everything; log₂(k) when k buckets are equal.
 */
export function shannonEntropy(weights: number[]): number {
  const p = sharesOf(weights)
  if (p.length === 0) return 0
  let h = 0
  for (const pi of p) {
    if (pi <= 0) continue
    h -= pi * Math.log2(pi)
  }
  return h
}

/** H / log₂(k) so 1 = even mix and 0 = a single pen. Undefined (0) for k < 2. */
export function normalizedEntropy(weights: number[]): number {
  const p = sharesOf(weights)
  if (p.length < 2) return 0
  return shannonEntropy(p) / Math.log2(p.length)
}

/**
 * Gini coefficient of a non-negative allocation. 0 = equal shares, approaching 1
 * when one value takes the mass. Mean-independent; empty/zero → 0.
 */
export function giniCoefficient(values: number[]): number {
  const xs = values.filter((v) => Number.isFinite(v) && v >= 0).sort((a, b) => a - b)
  const n = xs.length
  if (n === 0) return 0
  const total = xs.reduce((s, v) => s + v, 0)
  if (total === 0) return 0
  let acc = 0
  for (let i = 0; i < n; i++) acc += (2 * (i + 1) - n - 1) * xs[i]
  return acc / (n * total)
}

/**
 * Herfindahl–Hirschman index: Σ sᵢ² of normalized shares. 1/k = even, 1 = monopoly.
 */
export function herfindahlIndex(weights: number[]): number {
  const p = sharesOf(weights)
  if (p.length === 0) return 0
  return p.reduce((s, pi) => s + pi * pi, 0)
}

/** Coefficient of variation: σ / |μ|. 0 when the mean is 0 or n < 2. */
export function coefficientOfVariation(values: number[]): number {
  const xs = values.filter((v) => Number.isFinite(v))
  if (xs.length < 2) return 0
  const m = mean(xs)
  if (m === 0) return 0
  return stddev(xs) / Math.abs(m)
}

/**
 * Pearson autocorrelation at lag k: corr(x[0..n-k-1], x[k..n-1]).
 * Returns 0 when fewer than 3 overlapping points remain.
 */
export function autocorrelation(values: number[], lag: number): number {
  if (lag < 1) return 0
  const xs = values.filter((v) => Number.isFinite(v))
  if (xs.length - lag < 3) return 0
  const a = xs.slice(0, xs.length - lag)
  const b = xs.slice(lag)
  return pearson(a, b)
}

export interface PeriodogramBin {
  /** Harmonic index k = 1 .. floor((n-1)/2). */
  k: number
  /** Period in samples (n / k). */
  period: number
  /** |X(k)|² / n — relative power. */
  power: number
}

/**
 * Naive DFT periodogram. For a real series x₀…xₙ₋₁, power at harmonic k is
 * |Σ xₜ exp(−2π i k t / n)|² / n. Peak period is the bin with max power
 * (k ≥ 1). Classical, not a Welch estimate — honest on short vault series.
 */
export function periodogram(values: number[]): PeriodogramBin[] {
  const xs = values.filter((v) => Number.isFinite(v))
  const n = xs.length
  if (n < 4) return []
  const m = mean(xs)
  const centered = xs.map((v) => v - m)
  const bins: PeriodogramBin[] = []
  const kMax = Math.floor((n - 1) / 2)
  for (let k = 1; k <= kMax; k++) {
    let re = 0
    let im = 0
    const omega = (2 * Math.PI * k) / n
    for (let t = 0; t < n; t++) {
      re += centered[t] * Math.cos(omega * t)
      im -= centered[t] * Math.sin(omega * t)
    }
    bins.push({ k, period: n / k, power: (re * re + im * im) / n })
  }
  return bins
}

export function dominantPeriod(values: number[]): PeriodogramBin | null {
  const bins = periodogram(values)
  if (bins.length === 0) return null
  return bins.reduce((best, bin) => (bin.power > best.power ? bin : best))
}

export interface SurvivalPoint {
  age: number
  surviving: number
}

/**
 * Share of a cohort still “alive” at age t: S(t) = #{age ≥ t} / n.
 * For open items, age is days since create (or last touch). Not a fitted
 * Kaplan–Meier with censoring — every item here is still open, so this is
 * the empirical survival of the current stock.
 */
export function survivalCurve(ages: number[]): SurvivalPoint[] {
  const xs = ages.filter((a) => Number.isFinite(a) && a >= 0).sort((a, b) => a - b)
  const n = xs.length
  if (n === 0) return []
  const unique = [...new Set(xs)]
  return unique.map((age) => ({
    age,
    surviving: xs.filter((a) => a >= age).length / n,
  }))
}
