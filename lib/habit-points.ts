/**
 * lib/habit-points.ts — Daily habit points and week-grade bonuses (pure)
 *
 * Each daily habit is worth `DAILY_HABIT_COMPLETION_POINTS` (50) for a full day,
 * scaled by that day's completion ratio (partial goals/climbs count).
 * Each elapsed day can also earn a grade bonus: 100 if either Week grade or
 * Perfect output is 75%+ (after its curve), 300 if both are; plus 50 if that
 * day's raw column score is above 80%.
 *
 * Spec: §9, §14.
 */
import { TaskType, type TaskCompletion, type WeeklyData, type WeeklyTask } from "./types"
import { incrementalDayPercentage } from "./incremental-habits"

export const DAILY_HABIT_COMPLETION_POINTS = 50
export const GRADE_BONUS_EITHER = 100
export const GRADE_BONUS_BOTH = 300
export const GRADE_BONUS_THRESHOLD = 75
export const RAW_DAY_BONUS = 50
export const RAW_DAY_BONUS_THRESHOLD = 80

export function habitDayPointTaskId(taskId: string, dateKey: string): string {
  return `habit-day:${taskId}:${dateKey}`
}

export function gradeBonusTaskId(dateKey: string): string {
  return `habit-grade-bonus:${dateKey}`
}

export function rawDayBonusTaskId(dateKey: string): string {
  return `habit-raw-day-bonus:${dateKey}`
}

export function isDailyHabit(task: WeeklyTask): boolean {
  return (task.frequency || "daily") === "daily"
}

export function dailyHabitCompletionRatio(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  weeklyData: WeeklyData,
  date: Date,
): number {
  if (!completion) return 0
  switch (task.type) {
    case TaskType.BOOLEAN:
      return completion.completed ? 1 : 0
    case TaskType.TEXT:
      return completion.text?.trim() ? 1 : 0
    case TaskType.GOAL:
    case TaskType.TIME:
    case TaskType.COUNT: {
      if (!task.goal) return 0
      return Math.min(1, Math.max(0, (completion.value ?? 0) / task.goal))
    }
    case TaskType.INCREMENTAL: {
      const pct = incrementalDayPercentage(task, completion, weeklyData, date)
      if (pct === null) return 0
      return Math.min(1, Math.max(0, pct / 100))
    }
    default:
      return 0
  }
}

export function dailyHabitDayPoints(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  weeklyData: WeeklyData,
  date: Date,
): number {
  const raw = dailyHabitCompletionRatio(task, completion, weeklyData, date) * DAILY_HABIT_COMPLETION_POINTS
  return Math.round(raw * 10) / 10
}

/** 300 if both grades are 75%+, else 100 if either is, else 0. */
export function gradeBonusPoints(weekGrade: number, outputGrade: number): number {
  const weekOk = weekGrade >= GRADE_BONUS_THRESHOLD
  const outputOk = outputGrade >= GRADE_BONUS_THRESHOLD
  if (weekOk && outputOk) return GRADE_BONUS_BOTH
  if (weekOk || outputOk) return GRADE_BONUS_EITHER
  return 0
}

export function gradeBonusDescription(points: number): string {
  if (points === GRADE_BONUS_BOTH) return "Grade bonus (both 75%+)"
  if (points === GRADE_BONUS_EITHER) return "Grade bonus (either 75%+)"
  return "Grade bonus"
}

/** +50 when that day's raw column completion is strictly above 80%. */
export function rawDayBonusPoints(rawDayScore: number): number {
  return rawDayScore > RAW_DAY_BONUS_THRESHOLD ? RAW_DAY_BONUS : 0
}

export function rawDayBonusDescription(points: number): string {
  return points > 0 ? "Raw day bonus (above 80%)" : "Raw day bonus"
}
