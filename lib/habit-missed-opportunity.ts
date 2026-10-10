/**
 * lib/habit-missed-opportunity.ts — Missed opportunity mark
 *
 * A period the person has decided was definitely not done. It lives on the
 * completion cell as `missedOpportunity`. Absence is not marked. It is not an
 * exemption and it does not clear `completed`. Grade, percent, streak, gem,
 * and point readers stay on `completed` / `isHabitGoalMet` and never read it.
 * `missReason` is an optional string on the same cell. They do not read that either.
 *
 * The hide hatch is separate from that grade. A goal cell whose printed
 * amount has reached the printed goal (30/30) hatches even when trust still
 * calls the cell unmet.
 */
import type { TaskCompletion, WeeklyTask } from "./types"
import { isGoalType } from "./habit-utils"
import { effectiveCoverageLink } from "./habit-completion-source"
import { listPeriodMeasure, type ListPipelinePreviewItem } from "./habit-completion-pipeline"
import { liveHabitStatEvaluation } from "./habit-source-square"
import { bindingReadsGradeScale, roundStatDisplay } from "./habit-stat-pipeline"

export function isMissedOpportunity(cell: Pick<TaskCompletion, "missedOpportunity"> | undefined): boolean {
  return cell?.missedOpportunity === true
}

/**
 * Cell patch for the missed-op wand. A blank reason is an empty string so the
 * store can delete a previous note. Grades do not read either field.
 */
export function missedOpportunityWrite(
  missed: boolean,
  missReason?: string,
): Pick<TaskCompletion, "missedOpportunity" | "missReason"> {
  const text = missed ? (missReason?.trim() ?? "") : ""
  return { missedOpportunity: missed, missReason: text }
}

/** Complete cells and exempt cells cannot take the mark. */
export function missedOpportunityEligible(exempt: boolean, met: boolean): boolean {
  return !exempt && !met
}

/**
 * Number printed in a goal field, and the goal printed after the slash.
 * A sourced amount above the target stays that amount (90 against 70 reads
 * 90/70). The old coverage label cap (`min(actual, threshold)`, which printed
 * 75/75) is abandoned so the overage stays visible. A hand-typed cell keeps
 * the number that was typed. A goal fed by a list prints
 * `listPeriodMeasure` for that period: sent inside the span over the list
 * length, frozen once the period has ended. Non-goals return an empty pair.
 * This is display only — it does not decide grades, and it does not edit the length.
 */
export function printedGoalAmounts(
  task: Pick<WeeklyTask, "type" | "goal" | "name" | "frequency" | "coverageLink" | "listSentLink" | "completionPipelines">,
  completion: Pick<TaskCompletion, "value" | "manualValue" | "handCompleted" | "trackedValue" | "trackedCompleted" | "coverageCompleted" | "habitSumValue" | "taggedTaskCount" | "dailyCompletionAverage" | "keywordLogged" | "sleepCompleted" | "listCompleted" | "dailyFloorCompleted"> | undefined,
  items?: readonly ListPipelinePreviewItem[],
  now: Date = new Date(),
  clock: Date = new Date(),
): { shown?: number; goal?: number } {
  if (!isGoalType(task.type)) return {}
  const handOwns = completion?.manualValue !== undefined || completion?.handCompleted !== undefined
  const otherReading =
    completion?.trackedValue !== undefined ||
    completion?.trackedCompleted !== undefined ||
    completion?.coverageCompleted !== undefined ||
    completion?.habitSumValue !== undefined ||
    completion?.taggedTaskCount !== undefined ||
    completion?.dailyCompletionAverage !== undefined ||
    completion?.keywordLogged === true ||
    completion?.sleepCompleted !== undefined ||
    completion?.listCompleted !== undefined ||
    completion?.dailyFloorCompleted !== undefined
  if (items && task.listSentLink && !handOwns && !otherReading && !effectiveCoverageLink(task)) {
    const period = listPeriodMeasure(task, items, now, clock)
    if (period) return { shown: period.sentInSpan, goal: period.listLength }
  }
  // Occupancy and the other stored sources already keep the real amount on
  // `value`. Do not clamp it to the target. A live grade still wins only when
  // the cell was not typed and is not an occupancy reading.
  if (!handOwns && !effectiveCoverageLink(task) && bindingReadsGradeScale(task)) {
    const live = liveHabitStatEvaluation(task as WeeklyTask)
    if (live && !live.error && live.value != null) {
      return { shown: roundStatDisplay(live.value), goal: task.goal || 0 }
    }
  }
  return { shown: completion?.value, goal: task.goal || 0 }
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
