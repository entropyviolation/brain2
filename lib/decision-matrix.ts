/**
 * lib/decision-matrix.ts — Weighted multi-criteria decision analysis (MCDA)
 *
 * Pure scoring core for the Modules "decision-matrix" view. Rows are options
 * (the things you're choosing between), columns are criteria (each with a weight
 * and a direction). Each criterion's raw values are min–max normalized to [0,1]
 * across the options so heterogeneous units (price, rating, minutes…) are
 * comparable, then combined with normalized weights into a single score per
 * option. Options are ranked highest-first and ties share a rank.
 *
 * Design notes / edge handling:
 *  - benefit criterion → higher raw value is better; cost criterion (`benefit:
 *    false`) → lower raw value is better (it is inverted during normalization).
 *  - Missing values (null/undefined/non-finite) contribute 0 for that criterion
 *    (treated as the worst case) and are excluded from the min/max range.
 *  - When every present value of a criterion is equal, normalization can't
 *    discriminate, so present values normalize to 1 (all equally good) while
 *    missing values stay 0.
 *  - Weights ≤ 0 are ignored (clamped to 0). Weights are renormalized to sum to
 *    1 so the final score is always in [0,1]; if no positive weight exists every
 *    score is 0.
 *
 * Kept side-effect-free + framework-agnostic so it is unit-testable and reusable
 * on a server.
 */

/** A single weighted criterion (a column). */
export interface MatrixCriterion {
  /** Stable id (usually the source attribute id). */
  id: string
  /** Optional display name. */
  label?: string
  /** Relative importance; values ≤ 0 are ignored. */
  weight: number
  /** true (default) = higher is better; false = lower is better (a cost). */
  benefit?: boolean
}

/** A single option (a row), with one raw value per criterion id. */
export interface MatrixOption {
  id: string
  label?: string
  /** Raw value per criterion id; missing/non-numeric entries count as absent. */
  values: Record<string, number | null | undefined>
}

/** A scored + ranked option. */
export interface RankedOption {
  id: string
  label?: string
  /** Final weighted score in [0,1]. */
  score: number
  /** 1-based rank, highest score first; tied scores share a rank. */
  rank: number
  /** True for every option sharing the top rank (when the top score > 0). */
  isWinner: boolean
  /** Per-criterion normalized weighted contribution (sums to `score`). */
  contributions: Record<string, number>
  /** Per-criterion normalized value in [0,1] before weighting. */
  normalized: Record<string, number>
}

const EPSILON = 1e-9

function finiteOrNull(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null
}

/** Effective, renormalized weights (sum to 1; ignores ≤ 0). */
export function normalizeWeights(criteria: MatrixCriterion[]): Record<string, number> {
  const positive = criteria.map((c) => Math.max(0, c.weight || 0))
  const total = positive.reduce((a, b) => a + b, 0)
  const out: Record<string, number> = {}
  criteria.forEach((c, i) => {
    out[c.id] = total > EPSILON ? positive[i] / total : 0
  })
  return out
}

/**
 * Score and rank options against weighted criteria.
 * Returns options sorted by descending score (input order breaks ties).
 */
export function scoreDecisionMatrix(
  options: MatrixOption[],
  criteria: MatrixCriterion[],
): RankedOption[] {
  const weights = normalizeWeights(criteria)

  // Per-criterion min/max over present values (for normalization).
  const ranges: Record<string, { min: number; max: number; hasValues: boolean }> = {}
  for (const c of criteria) {
    let min = Number.POSITIVE_INFINITY
    let max = Number.NEGATIVE_INFINITY
    let hasValues = false
    for (const o of options) {
      const v = finiteOrNull(o.values[c.id])
      if (v === null) continue
      hasValues = true
      if (v < min) min = v
      if (v > max) max = v
    }
    ranges[c.id] = { min, max, hasValues }
  }

  const scored = options.map((o) => {
    const normalized: Record<string, number> = {}
    const contributions: Record<string, number> = {}
    let score = 0
    for (const c of criteria) {
      const raw = finiteOrNull(o.values[c.id])
      const { min, max, hasValues } = ranges[c.id]
      let norm = 0
      if (raw !== null && hasValues) {
        const span = max - min
        if (span <= EPSILON) {
          norm = 1 // all present values equal → all equally good
        } else {
          const ratio = (raw - min) / span
          norm = c.benefit === false ? 1 - ratio : ratio
        }
      }
      normalized[c.id] = norm
      const contribution = norm * (weights[c.id] ?? 0)
      contributions[c.id] = contribution
      score += contribution
    }
    return { id: o.id, label: o.label, score, normalized, contributions }
  })

  // Rank: highest score first, ties share a rank (standard competition ranking).
  const order = scored
    .map((s, i) => ({ s, i }))
    .sort((a, b) => b.s.score - a.s.score || a.i - b.i)

  const topScore = order.length ? order[0].s.score : 0
  const ranked: RankedOption[] = new Array(order.length)
  let lastScore = Number.NaN
  let lastRank = 0
  order.forEach((entry, idx) => {
    const rank = Math.abs(entry.s.score - lastScore) <= EPSILON ? lastRank : idx + 1
    lastScore = entry.s.score
    lastRank = rank
    ranked[entry.i] = {
      ...entry.s,
      rank,
      isWinner: topScore > EPSILON && Math.abs(entry.s.score - topScore) <= EPSILON,
    }
  })

  // Return in ranked (sorted) order for convenient rendering.
  return order.map((entry) => ranked[entry.i])
}
