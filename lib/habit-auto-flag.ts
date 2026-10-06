/**
 * lib/habit-auto-flag.ts — Manual vs auto flags → completed
 *
 * One merge for every habit auto source (sleep, list, tracked, coverage,
 * daily floor). A hand tick (completed with no auto flag) stays when the
 * auto source clears. Returns null when the cell would not change.
 *
 * Flag keys on the stored cell stay exactly the TaskCompletion names; only the
 * flag family being applied is set/deleted (sleep↔list, coverage↔floor, or
 * tracked alone) so unrelated keys are left present/absent as they were.
 */
import type { TaskCompletion } from "./types"

export type HabitAutoFlag =
  | "sleepCompleted"
  | "listCompleted"
  | "trackedCompleted"
  | "coverageCompleted"
  | "dailyFloorCompleted"

/**
 * Merge one auto flag into a completion cell. Optional `value` / `goal` extras
 * (coverage) are written when that family is applied; omitted extras leave
 * those fields alone on sleep/list/tracked paths.
 */
export function applyHabitAutoFlag(
  completion: TaskCompletion | undefined,
  flag: HabitAutoFlag,
  met: boolean,
  extras?: { value?: number; goal?: number },
): TaskCompletion | null {
  const prevMet = !!completion?.[flag]
  if (!met && !completion) return null

  const sleep = flag === "sleepCompleted" ? met : !!completion?.sleepCompleted
  const list = flag === "listCompleted" ? met : !!completion?.listCompleted
  const tracked = flag === "trackedCompleted" ? met : !!completion?.trackedCompleted
  const coverage = flag === "coverageCompleted" ? met : !!completion?.coverageCompleted
  const floor = flag === "dailyFloorCompleted" ? met : !!completion?.dailyFloorCompleted

  const manual =
    !!completion?.completed &&
    !completion?.trackedCompleted &&
    !completion?.sleepCompleted &&
    !completion?.listCompleted &&
    !completion?.coverageCompleted &&
    !completion?.dailyFloorCompleted

  const completed = manual || tracked || sleep || list || coverage || floor

  const nextValue = extras?.value !== undefined ? extras.value : completion?.value
  const nextGoal = extras?.goal !== undefined ? extras.goal : completion?.goal

  // Sleep/list historically only compared met + completed; value/goal are
  // unchanged without extras, so including them matches both call sites.
  const unchanged =
    prevMet === met &&
    !!completion?.completed === completed &&
    completion?.value === nextValue &&
    completion?.goal === nextGoal
  if (unchanged) return null

  const next: TaskCompletion = { ...completion, completed }

  if (flag === "sleepCompleted" || flag === "listCompleted") {
    if (sleep) next.sleepCompleted = true
    else delete next.sleepCompleted
    if (list) next.listCompleted = true
    else delete next.listCompleted
    return next
  }

  if (flag === "coverageCompleted" || flag === "dailyFloorCompleted") {
    if (coverage) next.coverageCompleted = true
    else delete next.coverageCompleted
    if (floor) next.dailyFloorCompleted = true
    else delete next.dailyFloorCompleted
    if (nextValue !== undefined) next.value = nextValue
    if (nextGoal !== undefined) next.goal = nextGoal
    return next
  }

  if (tracked) next.trackedCompleted = true
  else delete next.trackedCompleted
  return next
}
