/**
 * lib/habit-period-write.ts — Period book lookup and cell write for habit syncs
 *
 * Two writers. They are not the same function.
 *
 * `bucketFor`, `periodKeyFor`, and `writePeriod` treat a missing frequency as
 * daily. Daily cells live on `weeklyData`. Weekly, monthly, and season cells
 * live on their own books. Keyword sync and list-sent sync use this writer.
 *
 * `bucketForWeekBook` and `writeWeekBook` send monthly and quarterly habits to
 * those books. Every other frequency, including a missing one, uses the weekly
 * habit book. Daily habit total and daily completion average use this writer.
 */
"use client"

import { formatLocalDateKey, formatLocalMonthKey, getWeekString } from "@/lib/date-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { quarterKey } from "@/lib/seasons"
import type { TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"

type HabitsState = ReturnType<typeof useHabitsStore.getState>

export function bucketFor(task: WeeklyTask, state: HabitsState): WeeklyData {
  const freq = task.frequency || "daily"
  if (freq === "monthly") return state.monthlyHabitData
  if (freq === "quarterly") return state.quarterlyHabitData
  if (freq === "weekly") return state.weeklyHabitData
  return state.weeklyData
}

export function periodKeyFor(task: WeeklyTask, rangeStart: Date): string {
  const freq = task.frequency || "daily"
  if (freq === "weekly") return getWeekString(rangeStart)
  if (freq === "monthly") return formatLocalMonthKey(rangeStart)
  if (freq === "quarterly") return quarterKey(rangeStart)
  return formatLocalDateKey(rangeStart)
}

export function writePeriod(task: WeeklyTask, anchor: Date, next: TaskCompletion): void {
  const habits = useHabitsStore.getState()
  const freq = task.frequency || "daily"
  if (freq === "monthly") habits.updateMonthlyHabitCompletion(task.id, anchor, next)
  else if (freq === "quarterly") habits.updateQuarterlyHabitCompletion(task.id, anchor, next)
  else if (freq === "weekly") habits.updateWeeklyHabitCompletion(task.id, anchor, next)
  else habits.updateCompletion(task.id, anchor, next)
}

export function bucketForWeekBook(task: WeeklyTask, state: HabitsState): WeeklyData {
  if (task.frequency === "monthly") return state.monthlyHabitData
  if (task.frequency === "quarterly") return state.quarterlyHabitData
  return state.weeklyHabitData
}

export function writeWeekBook(task: WeeklyTask, anchor: Date, next: TaskCompletion): void {
  const habits = useHabitsStore.getState()
  if (task.frequency === "monthly") habits.updateMonthlyHabitCompletion(task.id, anchor, next)
  else if (task.frequency === "quarterly") habits.updateQuarterlyHabitCompletion(task.id, anchor, next)
  else habits.updateWeeklyHabitCompletion(task.id, anchor, next)
}
