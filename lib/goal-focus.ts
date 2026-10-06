/**
 * lib/goal-focus.ts — Tomorrow's goal focus and how it meets other multipliers
 *
 * A night ritual can name goals to focus on the next day. A task serves that
 * focus when it contributes to one of those goals, or to an objective one of
 * those goals serves.
 *
 * Point composition (one multiplier, never a product of two boosts):
 * - Beat-the-clock stays inside the base (`resolveCompletionPoints`). Focus
 *   does not touch it.
 * - Objective stacking (`taskObjectiveMultiplier`) is the other boost: 1 when
 *   the task serves no objective, otherwise the product of each objective's
 *   effective multiplier (default 1.5×, or that period's priority value).
 * - If the task is not in the focus set, only the objective multiplier applies.
 * - If it is focused and the objective multiplier is 1 (no objective boost),
 *   the goal-focus multiplier applies (default 1.5×).
 * - If both would boost the same completion, keep the larger and do not
 *   multiply them. A task already at 2× from a prioritized objective does not
 *   also take 1.5× focus.
 *
 * Selection: friend suggestions multiply that task's score by the same focus
 * multiplier, so a focused task is more likely to be picked. The score boost
 * is the selection side of the same number; it is not a second points grant.
 */
import type { Goal, Task } from "@/lib/types"

export const DEFAULT_GOAL_FOCUS_MULTIPLIER = 1.5

export function clampFocusMultiplier(value: number): number {
  if (!Number.isFinite(value) || value < 1) return 1
  return Math.round(value * 100) / 100
}

export function taskServesFocusGoals(
  task: Pick<Task, "contributesToGoalIds" | "contributesToObjectiveIds">,
  goals: Pick<Goal, "id" | "objectiveIds">[],
  focusGoalIds: readonly string[],
): boolean {
  if (focusGoalIds.length === 0) return false
  const focus = new Set(focusGoalIds)
  if (task.contributesToGoalIds?.some((id) => focus.has(id))) return true
  const objectiveIds = new Set(
    goals.filter((goal) => focus.has(goal.id)).flatMap((goal) => goal.objectiveIds ?? []),
  )
  return !!task.contributesToObjectiveIds?.some((id) => objectiveIds.has(id))
}

/**
 * The single multiplier applied on top of base points.
 * `objectiveMultiplier` is already the stacked objective factor (1 = none).
 */
export function composePointMultiplier(
  objectiveMultiplier: number,
  focusMultiplier: number,
  focused: boolean,
): number {
  const objective = Number.isFinite(objectiveMultiplier) && objectiveMultiplier > 0 ? objectiveMultiplier : 1
  const focus = clampFocusMultiplier(focusMultiplier)
  if (!focused || focus <= 1) return objective
  if (objective <= 1) return focus
  return Math.max(objective, focus)
}

/** Friend-pick weight. Unfocused tasks stay at 1 so existing scores are unchanged. */
export function focusSelectionWeight(focused: boolean, focusMultiplier: number): number {
  if (!focused) return 1
  return clampFocusMultiplier(focusMultiplier)
}
