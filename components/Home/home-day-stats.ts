/**
 * components/Home/home-day-stats.ts — Today's to-do and habit counts
 *
 * Shared by Today's Progress, the screen pet, and the Day lamp so the three
 * tiles describe the same day. The same tasks, habit tasks, daily completions,
 * exemptions, and day key reuse one result object. Climb habits use
 * `isHabitGoalMet`. Remaining lists feed the Progress detail disclosure.
 * Habit rows use `WeeklyTask.name` — habits do not carry `title`.
 */
"use client"

import { filterHabitsByFrequency } from "@/components/Home/Habits/period-habit-list"
import { formatLocalDateKey, taskScheduledOnDay } from "@/lib/date-utils"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { isHabitPeriodExempt } from "@/lib/habit-exemption"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { homeDayTodoTasks } from "@/lib/item-slices"
import type { ItemRecord } from "@/lib/types"

export type HomeDayCount = {
  total: number
  completed: number
  remaining: number
  percent: number
}

export type HomeDayRemainingItem = { id: string; title: string }

export type HomeDayStats = {
  todo: HomeDayCount
  habit: HomeDayCount
  remainingTodos: HomeDayRemainingItem[]
  remainingHabits: HomeDayRemainingItem[]
}

type HabitTasks = ReturnType<typeof useHabitsStore.getState>["tasks"]
type WeeklyData = ReturnType<typeof useHabitsStore.getState>["weeklyData"]
type HabitExemptions = ReturnType<typeof useHabitsStore.getState>["habitExemptions"]

let cachedTasks: ItemRecord[] | null = null
let cachedHabitTasks: HabitTasks | null = null
let cachedWeeklyData: WeeklyData | null = null
let cachedExemptions: HabitExemptions | null = null
let cachedDayKey: string | null = null
let cachedStats: HomeDayStats | null = null

function homeDayStatsOf(
  tasks: ItemRecord[],
  habitTasks: HabitTasks,
  weeklyData: WeeklyData,
  habitExemptions: HabitExemptions,
  dayKey: string,
  currentDate: Date,
): HomeDayStats {
  if (
    cachedStats &&
    cachedTasks === tasks &&
    cachedHabitTasks === habitTasks &&
    cachedWeeklyData === weeklyData &&
    cachedExemptions === habitExemptions &&
    cachedDayKey === dayKey
  ) {
    return cachedStats
  }

  const todayTodos = tasks.filter((task) => !task.hiddenFromTodo && taskScheduledOnDay(task, currentDate))
  const todoCompleted = todayTodos.filter((task) => task.completed).length
  const todoTotal = todayTodos.length
  const remainingTodos = todayTodos
    .filter((task) => !task.completed)
    .map((task) => ({ id: task.id, title: itemTitleOrUntitled(task) }))

  const dailyHabits = filterHabitsByFrequency(habitTasks, "daily").filter(
    (habit) => !isHabitPeriodExempt(habit, dayKey, "daily", habitExemptions),
  )
  const dayData = weeklyData[dayKey] ?? {}
  let habitCompleted = 0
  const remainingHabits: HomeDayRemainingItem[] = []
  for (const habit of dailyHabits) {
    if (isHabitGoalMet(habit, dayData[habit.id], { date: currentDate, weeklyData })) {
      habitCompleted++
    } else {
      remainingHabits.push({ id: habit.id, title: habit.name.trim() || "Untitled habit" })
    }
  }
  const habitTotal = dailyHabits.length
  const stats: HomeDayStats = {
    todo: {
      total: todoTotal,
      completed: todoCompleted,
      remaining: todoTotal - todoCompleted,
      percent: todoTotal > 0 ? Math.round((todoCompleted / todoTotal) * 100) : 0,
    },
    habit: {
      total: habitTotal,
      completed: habitCompleted,
      remaining: habitTotal - habitCompleted,
      percent: habitTotal > 0 ? Math.round((habitCompleted / habitTotal) * 100) : 0,
    },
    remainingTodos,
    remainingHabits,
  }
  cachedTasks = tasks
  cachedHabitTasks = habitTasks
  cachedWeeklyData = weeklyData
  cachedExemptions = habitExemptions
  cachedDayKey = dayKey
  cachedStats = stats
  return stats
}

export function useHomeDayStats(currentDate: Date): HomeDayStats {
  const tasks = useTaskStore((s) => homeDayTodoTasks(s.tasks, currentDate))
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const dayKey = formatLocalDateKey(currentDate)
  return homeDayStatsOf(tasks, habitTasks, weeklyData, habitExemptions, dayKey, currentDate)
}
