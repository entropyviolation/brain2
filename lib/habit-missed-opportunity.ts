/**
 * lib/habit-missed-opportunity.ts — Missed opportunity mark
 *
 * A period the person has decided was definitely not done. It lives on the
 * completion cell as `missedOpportunity`. Absence is not marked. It is not an
 * exemption and it does not clear `completed`. Grade, percent, streak, gem,
 * and point readers stay on `completed` / `isHabitGoalMet` and never read it.
 *
 * The hide hatch is separate from that grade. A goal cell whose printed
 * amount has reached the printed goal (30/30) hatches even when trust still
 * calls the cell unmet.
 */
import type { TaskCompletion, WeeklyTask } from "./types"
import { isGoalType } from "./habit-utils"
import { coverageDisplayAmount, effectiveCoverageLink } from "./habit-completion-source"

export function isMissedOpportunity(cell: Pick<TaskCompletion, "missedOpportunity"> | undefined): boolean {
  return cell?.missedOpportunity === true
}

/** Complete cells and exempt cells cannot take the mark. */
export function missedOpportunityEligible(exempt: boolean, met: boolean): boolean {
  return !exempt && !met
}

/**
 * Number printed in a goal field, and the goal printed after the slash.
 * Coverage cells use the capped label (`min(actual, threshold)`), which is
 * what the sheet shows. Non-goals return an empty pair. This is display
 * only — it does not decide grades.
 */
export function printedGoalAmounts(
  task: Pick<WeeklyTask, "type" | "goal" | "name" | "frequency" | "coverageLink">,
  completion: Pick<TaskCompletion, "value"> | undefined,
): { shown?: number; goal?: number } {
  if (!isGoalType(task.type)) return {}
  const coverage = effectiveCoverageLink(task)
  const shown = coverage
    ? coverageDisplayAmount(completion?.value, coverage.threshold)
    : completion?.value
  return { shown, goal: task.goal || 0 }
}

function printedGoalReached(shown: number | undefined, goal: number | undefined): boolean {
  return typeof shown === "number" && typeof goal === "number" && goal > 0 && shown + 1e-9 >= goal
}

/**
 * Grey diagonal hatch — the same exemption cell class — without changing
 * the record. The exemption wand still paints its own lamps. The missed-op
 * wand greys only cells it cannot mark (`exempt` or grade-`met`). The hide
 * rocker also hatches a goal whose printed amount has reached the printed
 * goal, including 30/30 when trust still says unmet.
 */
export function completionCellShowsHatch(input: {
  exempt: boolean
  met: boolean
  missed: boolean
  exemptionWand: boolean
  missedOpWand: boolean
  hideCompletedAndMissed: boolean
  /** Amount drawn in the goal field. Absent for lamps and notes. */
  shown?: number
  /** Goal drawn after the slash. */
  goal?: number
}): boolean {
  if (input.exemptionWand) return input.exempt
  if (input.missedOpWand) return input.exempt || input.met
  if (input.exempt) return true
  const filled = printedGoalReached(input.shown, input.goal)
  return input.hideCompletedAndMissed && (input.met || input.missed || filled)
}
