/**
 * lib/bge-score.ts — Day completion on the Bare minimum / Goal / Exceptional scale
 *
 * Used when To Do's B/G/E mode is on. Bare minimum is worth 70 points, Goal 30.
 * Each is the share of that tier finished. Exceptional is bonus: every finished
 * exceptional task earns what one Goal task earns (30 ÷ goal count), on top, so
 * the score can pass 100. A tier with nothing in it counts as met, so an empty
 * list of Bare minimum does not cost points. With no Goal tasks there is no
 * rate to pay the bonus at, so Exceptional adds nothing.
 */
import type { StepTier } from "@/lib/types"

export const BGE_MIN_WEIGHT = 70
export const BGE_GOAL_WEIGHT = 30

export type BgeEntry = { tier: StepTier; done: boolean }

export type BgeTierCount = { done: number; total: number }

export type BgeScore = {
  /** 0 and up; passes 100 only through Exceptional bonus. */
  points: number
  base: number
  bonus: number
  min: BgeTierCount
  goal: BgeTierCount
  exceptional: BgeTierCount
}

export function bgeScore(entries: readonly BgeEntry[]): BgeScore {
  const count = (tier: StepTier): BgeTierCount => {
    const rows = entries.filter((e) => e.tier === tier)
    return { done: rows.filter((e) => e.done).length, total: rows.length }
  }
  const min = count("min")
  const goal = count("goal")
  const exceptional = count("exceptional")
  const minPoints = min.total > 0 ? (min.done / min.total) * BGE_MIN_WEIGHT : BGE_MIN_WEIGHT
  const goalPoints = goal.total > 0 ? (goal.done / goal.total) * BGE_GOAL_WEIGHT : BGE_GOAL_WEIGHT
  const bonus = goal.total > 0 ? (exceptional.done / goal.total) * BGE_GOAL_WEIGHT : 0
  return { points: minPoints + goalPoints + bonus, base: minPoints + goalPoints, bonus, min, goal, exceptional }
}
