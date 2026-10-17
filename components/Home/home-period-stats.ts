/**
 * components/Home/home-period-stats.ts — This week's and this month's to-do and habit counts
 *
 * The week and month columns of Today's Progress. To-dos follow the To Do
 * tab's period rule (`taskScheduledInWeek` / `taskScheduledInMonth`): planned
 * for the period or on a day inside it, done or not. Inbox captures are not a
 * schedule. Habits are the weekly / monthly habits for that period, read from
 * the same ledgers the Plan rail uses, with exemptions skipped. The day column
 * stays on `home-day-stats.ts`.
 */
"use client"

import { useMemo } from "react"
import { format, startOfMonth } from "date-fns"
import { getWeekStartDate, getWeekString, taskScheduledInMonth, taskScheduledInWeek } from "@/lib/date-utils"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { isHabitPeriodExempt } from "@/lib/habit-exemption"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import type { Task, WeeklyTask } from "@/lib/types"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import type { HomeDayCount, HomeDayRemainingItem } from "@/components/Home/home-day-stats"

export type HomePeriod = "week" | "month"

export type HomePeriodStats = {
  todo: HomeDayCount
  habit: HomeDayCount
  remainingTodos: HomeDayRemainingItem[]
  remainingHabits: HomeDayRemainingItem[]
}

type HabitLedger = ReturnType<typeof useHabitsStore.getState>["weeklyHabitData"]
type HabitExemptions = ReturnType<typeof useHabitsStore.getState>["habitExemptions"]

export function countOf(completed: number, total: number): HomeDayCount {
  return {
    total,
    completed,
    remaining: total - completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  }
}

/** Pure: week or month counts for the period that holds `date`. */
export function homePeriodStatsOf(
  period: HomePeriod,
  date: Date,
  tasks: readonly Task[],
  habits: readonly WeeklyTask[],
  weeklyHabitData: HabitLedger,
  monthlyHabitData: HabitLedger,
  habitExemptions: HabitExemptions,
): HomePeriodStats {
  const key = period === "week" ? getWeekString(date) : format(date, "yyyy-MM")
  const inPeriod = period === "week" ? taskScheduledInWeek : taskScheduledInMonth

  const todos = tasks.filter((task) => !task.hiddenFromTodo && task.stage !== "inbox" && inPeriod(task, key))
  const todoDone = todos.filter((task) => task.completed).length

  const frequency = period === "week" ? "weekly" : "monthly"
  const ledger = period === "week" ? weeklyHabitData : monthlyHabitData
  const periodStart = period === "week" ? getWeekStartDate(date) : startOfMonth(date)
  const periodHabits = habits.filter(
    (habit) => habit.frequency === frequency && !isHabitPeriodExempt(habit, key, frequency, habitExemptions),
  )
  const remainingHabits: HomeDayRemainingItem[] = []
  let habitDone = 0
  for (const habit of periodHabits) {
    if (isHabitGoalMet(habit, ledger[key]?.[habit.id], { date: periodStart, weeklyData: ledger })) {
      habitDone++
    } else {
      remainingHabits.push({ id: habit.id, title: habit.name.trim() || "Untitled habit" })
    }
  }

  return {
    todo: countOf(todoDone, todos.length),
    habit: countOf(habitDone, periodHabits.length),
    remainingTodos: todos
      .filter((task) => !task.completed)
      .map((task) => ({ id: task.id, title: itemTitleOrUntitled(task) })),
    remainingHabits,
  }
}

export function useHomePeriodStats(period: HomePeriod, date: Date): HomePeriodStats {
  const tasks = useTaskStore((s) => s.tasks)
  const habits = useHabitsStore((s) => s.tasks)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const dayKey = date.toDateString()
  return useMemo(
    () => homePeriodStatsOf(period, date, tasks, habits, weeklyHabitData, monthlyHabitData, habitExemptions),
    // `date` is read through its calendar day so a new Date for the same day does not recount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [period, dayKey, tasks, habits, weeklyHabitData, monthlyHabitData, habitExemptions],
  )
}
