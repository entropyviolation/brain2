/**
 * lib/habit-period-compare.ts — Strictly higher than the previous period
 *
 * A weekly habit can complete from a rule on its Habits stats row: each chosen
 * point against the same point last period. A tie is not higher. The habit is
 * complete when at least `mustBeHigher` points (default 2 of 3) are higher.
 * Pure. It does not read the vault and it does not write a completion cell.
 */

export interface PeriodComparePoint {
  id: string
  label: string
  current: number
  previous: number
}

export interface PeriodComparePair extends PeriodComparePoint {
  /** This period, the previous period, or a tie. */
  winner: "this" | "previous" | "tie"
  /** True only when this period is strictly above the previous one. */
  higher: boolean
}

export interface PeriodCompareResult {
  pairs: PeriodComparePair[]
  higher: number
  mustBeHigher: number
  complete: boolean
}

export function compareHigherThanPrevious(
  points: readonly PeriodComparePoint[],
  mustBeHigher: number,
): PeriodCompareResult {
  const pairs: PeriodComparePair[] = points.map((point) => {
    const higher = point.current > point.previous
    const winner: PeriodComparePair["winner"] =
      point.current > point.previous ? "this" : point.current < point.previous ? "previous" : "tie"
    return { ...point, winner, higher }
  })
  const higher = pairs.filter((pair) => pair.higher).length
  const need = Number.isFinite(mustBeHigher) ? Math.max(0, Math.round(mustBeHigher)) : 0
  return {
    pairs,
    higher,
    mustBeHigher: need,
    complete: need > 0 && higher >= need,
  }
}
