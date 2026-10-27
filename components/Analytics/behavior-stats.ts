/**
 * components/Analytics/behavior-stats.ts — Pure math for Behavior views
 *
 * Habits, Streaks, Points and Velocity share these. No stores, no React.
 * Docs: `docs/analytics/behavior-*.md`.
 */

export type DayMark = "met" | "partial" | "missed" | "exempt"

export interface Run {
  start: string
  end: string
  length: number
  /** Still going on the last day of the span (right-censored). */
  open: boolean
}

/**
 * Runs of met days over an ordered day list. Exempt days bridge a run but do
 * not add to its length, the same rule as `streakSkippingExemptDays`.
 */
export function runsOver(days: string[], markOf: (key: string) => DayMark, partialCounts = false): Run[] {
  const runs: Run[] = []
  let cur: Run | null = null
  for (const key of days) {
    const m = markOf(key)
    if (m === "exempt") continue
    const ok = m === "met" || (partialCounts && m === "partial")
    if (ok) {
      if (cur) {
        cur.end = key
        cur.length++
      } else cur = { start: key, end: key, length: 1, open: false }
    } else if (cur) {
      runs.push(cur)
      cur = null
    }
  }
  if (cur) runs.push({ ...cur, open: true })
  return runs
}

/**
 * Discrete survival of runs: for each length k, of runs that reached k days,
 * the share that went on to k + 1. Open runs count as at risk but never as a
 * break (Kaplan–Meier style right-censoring).
 */
export function runContinuation(runs: Run[], maxK = 14): { k: number; atRisk: number; broke: number; goOn: number | null }[] {
  const out: { k: number; atRisk: number; broke: number; goOn: number | null }[] = []
  for (let k = 1; k <= maxK; k++) {
    const atRisk = runs.filter((r) => r.length >= k).length
    if (atRisk === 0) break
    const broke = runs.filter((r) => r.length === k && !r.open).length
    const censored = runs.filter((r) => r.length === k && r.open).length
    const denom = atRisk - censored
    out.push({ k, atRisk, broke, goOn: denom > 0 ? 1 - broke / denom : null })
  }
  return out
}

/** Linear-interpolated quantile, q in [0, 1]. */
export function quantile(values: number[], q: number): number | null {
  if (values.length === 0) return null
  const s = [...values].sort((a, b) => a - b)
  const pos = (s.length - 1) * Math.min(1, Math.max(0, q))
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return s[lo] + (s[hi] - s[lo]) * (pos - lo)
}

/** Share of values ≤ x (empirical CDF). */
export function shareAtMost(values: number[], x: number): number {
  if (values.length === 0) return 0
  return values.filter((v) => v <= x).length / values.length
}

/** Trailing mean over `w` points; the first points use what they have. */
export function rollingMean(values: number[], w: number): number[] {
  const out: number[] = []
  let sum = 0
  for (let i = 0; i < values.length; i++) {
    sum += values[i]
    if (i >= w) sum -= values[i - w]
    out.push(sum / Math.min(i + 1, w))
  }
  return out
}

/** The `n` largest day-over-day rises and falls, biggest first. */
export function biggestMoves(values: number[], n = 3): { rises: { i: number; delta: number }[]; falls: { i: number; delta: number }[] } {
  const deltas = values.slice(1).map((v, j) => ({ i: j + 1, delta: v - values[j] }))
  return {
    rises: deltas.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, n),
    falls: deltas.filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, n),
  }
}

/**
 * Window rate after `days` more days at `rate` (0–1) for `perDay` habit slots.
 * Also the 100% days needed to reach `target` (null if already there or never).
 */
export function projectRate(done: number, required: number, perDay: number, rate: number, days: number, target: number) {
  const add = perDay * days
  const projected = required + add > 0 ? (done + rate * add) / (required + add) : 0
  const now = required > 0 ? done / required : 0
  let perfectDays: number | null = null
  if (target > now && target < 1 && perDay > 0) perfectDays = Math.ceil((target * required - done) / (perDay * (1 - target)))
  return { now, projected, perfectDays }
}

export type Quadrant = "quick-win" | "slow-reward" | "slow-small" | "fast-small"

/** Fast/slow by `x` vs `mx`, big/small by `y` vs `my`. A tie is fast and small. */
export function quadrantOf(x: number, y: number, mx: number, my: number): Quadrant {
  const fast = x <= mx
  const big = y > my
  if (fast && big) return "quick-win"
  if (!fast && big) return "slow-reward"
  if (!fast && !big) return "slow-small"
  return "fast-small"
}
