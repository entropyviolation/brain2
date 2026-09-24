/**
 * lib/habit-priority.ts — Habit pin, missed-period auto-weight, sort, grade blend
 *
 * A habit can be **pinned** by the user until they unpin it. Missed periods
 * (a fully empty week for daily habits, an empty prior week/month for those
 * frequencies) add an **auto** weight that compounds: two empty weeks in a
 * row → weight 2. Mute (`priorityMuted`) drops the auto term so an undone
 * habit can be deprioritized by hand. Sort and optional grade / Good-day
 * math read `effectivePriorityWeight`.
 *
 * Grade blend (default floor 50): displayed = floor% × prioritized + rest% × overall.
 * Completing 100% of prioritized habits therefore floors the grade at 50%
 * even if everything else is empty; 100% of everything is still 100%.
 */
import { dailyHabitCompletionRatio } from "./habit-points"
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  getPrecedingMonthStarts,
  getPrecedingWeekStarts,
  getWeekDates,
  getWeekStartDate,
  getWeekString,
} from "./date-utils"
import type { HabitFrequency, TaskCompletion, WeeklyData, WeeklyTask } from "./types"

export const PRIORITY_GRADE_FLOOR = 50
export const MAX_AUTO_PRIORITY = 52

export function habitCellRatio(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  data: WeeklyData,
  date: Date,
): number {
  return dailyHabitCompletionRatio(task, completion, data, date)
}

export function periodHasAnyProgress(
  task: WeeklyTask,
  data: WeeklyData,
  dates: Date[],
  keyFor?: (date: Date) => string,
): boolean {
  for (const date of dates) {
    const key = keyFor ? keyFor(date) : formatLocalDateKey(date)
    if (habitCellRatio(task, data[key]?.[task.id], data, date) > 0) return true
  }
  return false
}

function dailyWeekDates(weekStart: Date): Date[] {
  return getWeekDates(getWeekStartDate(weekStart))
}

/** Consecutive fully empty periods immediately before the current one. */
export function autoPriorityWeight(
  task: WeeklyTask,
  data: WeeklyData,
  asOf: Date,
  frequency: HabitFrequency = task.frequency || "daily",
): number {
  if (task.priorityMuted) return 0

  if (frequency === "weekly") {
    const weeks = getPrecedingWeekStarts(getWeekStartDate(asOf), MAX_AUTO_PRIORITY + 1)
    const prior = weeks.slice(0, -1).reverse()
    let n = 0
    for (const start of prior) {
      const key = getWeekString(start)
      if (habitCellRatio(task, data[key]?.[task.id], data, start) > 0) break
      n++
    }
    return n
  }

  if (frequency === "monthly") {
    const months = getPrecedingMonthStarts(asOf, MAX_AUTO_PRIORITY + 1)
    const prior = months.slice(0, -1).reverse()
    let n = 0
    for (const start of prior) {
      const key = formatLocalMonthKey(start)
      if (habitCellRatio(task, data[key]?.[task.id], data, start) > 0) break
      n++
    }
    return n
  }

  const current = getWeekStartDate(asOf)
  let n = 0
  for (let i = 1; i <= MAX_AUTO_PRIORITY; i++) {
    const start = new Date(current)
    start.setDate(current.getDate() - 7 * i)
    start.setHours(0, 0, 0, 0)
    if (periodHasAnyProgress(task, data, dailyWeekDates(start))) break
    n++
  }
  return n
}

export function effectivePriorityWeight(
  task: WeeklyTask,
  data: WeeklyData,
  asOf: Date,
  frequency: HabitFrequency = task.frequency || "daily",
): number {
  const auto = autoPriorityWeight(task, data, asOf, frequency)
  const pin = task.priorityPinned ? 1 : 0
  return auto + pin
}

export function sortHabitsByPriority<T extends WeeklyTask>(
  tasks: T[],
  data: WeeklyData,
  asOf: Date,
  frequency: HabitFrequency = "daily",
): T[] {
  return [...tasks]
    .map((task, index) => ({ task, index, weight: effectivePriorityWeight(task, data, asOf, frequency) }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((row) => row.task)
}

export function prioritizedHabits<T extends WeeklyTask>(
  tasks: T[],
  data: WeeklyData,
  asOf: Date,
  frequency: HabitFrequency = "daily",
): T[] {
  return tasks.filter((task) => effectivePriorityWeight(task, data, asOf, frequency) > 0)
}

/** `floor` percent of the prioritized score plus the remainder of overall. */
export function blendPriorityScore(
  overall: number,
  priority: number | null,
  enabled: boolean,
  floor: number = PRIORITY_GRADE_FLOOR,
): number {
  if (!enabled || priority === null || !Number.isFinite(priority)) return overall
  const f = Math.min(100, Math.max(0, floor)) / 100
  return f * priority + (1 - f) * overall
}

export function priorityMathLine(overall: number, priority: number, floor: number = PRIORITY_GRADE_FLOOR): string {
  const rest = 100 - floor
  return `${floor}% × ${priority.toFixed(0)}% prioritized + ${rest}% × ${overall.toFixed(0)}% overall`
}
