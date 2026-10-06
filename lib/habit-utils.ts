/**
 * lib/habit-utils.ts — Shared habit completion helpers
 *
 * TIME/COUNT alias GOAL. `isHabitGoalMet` takes optional `{ date, weeklyData }`
 * so climb (INCREMENTAL) habits resolve the derived target for that day.
 * `completionWithGoalFlag` checks the cell when the numeric goal is met or an
 * auto flag is set (coverage, daily floor, sleep, list, tracked), so a link
 * that is met stays checked when it disagrees with `task.goal`.
 */
import { TaskType, type TaskCompletion, type WeeklyData, type WeeklyTask } from "./types"
import { incrementalDataForTask, incrementalLoggedValue, isIncrementalCompleteOn } from "./incremental-habits"
import { readingsFromCell, trustedOutcome } from "./habit-completion-trust"

/** TIME and COUNT are legacy aliases for GOAL. */
export function isGoalType(type: TaskType): boolean {
  return type === TaskType.GOAL || type === TaskType.TIME || type === TaskType.COUNT
}

export function normalizeTaskType(type: TaskType): TaskType {
  if (type === TaskType.TIME || type === TaskType.COUNT) return TaskType.GOAL
  return type
}

export interface HabitEvalContext {
  date?: Date
  weeklyData?: WeeklyData
}

export function isHabitGoalMet(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  ctx?: HabitEvalContext,
): boolean {
  if (!completion) return false
  if (Array.isArray(task.completionSources) && task.type !== TaskType.INCREMENTAL) {
    const order = task.completionSources
    const outcome = trustedOutcome(order, readingsFromCell(order, completion, task.goal))
    return outcome.met
  }
  switch (task.type) {
    case TaskType.BOOLEAN:
      return !!completion.completed
    case TaskType.TEXT:
      return !!completion.text?.trim()
    case TaskType.GOAL:
    case TaskType.TIME:
    case TaskType.COUNT:
      return task.goal ? (completion.value ?? 0) >= task.goal : false
    case TaskType.INCREMENTAL: {
      if (ctx?.date && ctx.weeklyData) {
        return isIncrementalCompleteOn(task, completion, ctx.weeklyData, ctx.date)
      }
      const data = incrementalDataForTask(task)
      const value = incrementalLoggedValue(completion)
      if (!data || value === undefined) return false
      return data.cadence === "weekly" ? value >= data.startValue : value >= data.startValue + data.increment
    }
    default:
      return false
  }
}

function autoFlagMet(completion: TaskCompletion): boolean {
  return !!(
    completion.coverageCompleted ||
    completion.dailyFloorCompleted ||
    completion.sleepCompleted ||
    completion.listCompleted ||
    completion.trackedCompleted
  )
}

export function completionWithGoalFlag(
  task: WeeklyTask,
  completion: TaskCompletion,
  ctx?: HabitEvalContext,
): TaskCompletion {
  // An ordered source list decides. Or-ing every auto flag would undo that.
  const met = Array.isArray(task.completionSources)
    ? isHabitGoalMet(task, completion, ctx)
    : autoFlagMet(completion) || isHabitGoalMet(task, completion, ctx)
  return met ? { ...completion, completed: true } : { ...completion, completed: false }
}
