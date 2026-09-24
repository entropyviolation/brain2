/**
 * components/Home/home-day-stats.ts — Today's to-do and habit counts
 *
 * Shared by Today's Progress, the screen pet, and the Day lamp so the three
 * tiles describe the same day. Climb habits use `isHabitGoalMet`.
 */
"use client"

import { useMemo } from "react"
import { filterHabitsByFrequency } from "@/components/Home/Habits/period-habit-list"
import { formatLocalDateKey, taskScheduledOnDay } from "@/lib/date-utils"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { isHabitPeriodExempt } from "@/lib/habit-exemption"
import { useHabitsStore } from "@/lib/habits-store"
import { useExemptionContext } from "@/lib/sleep-store"
import { useTaskStore } from "@/lib/task-store"

export type HomeDayCount = {
  total: number
  completed: number
  remaining: number
  percent: number
}

export function useHomeDayStats(currentDate: Date): { todo: HomeDayCount; habit: HomeDayCount } {
  const tasks = useTaskStore((s) => s.tasks)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const exemptionCtx = useExemptionContext()
  const dayKey = formatLocalDateKey(currentDate)

  return useMemo(() => {
    const todayTodos = tasks.filter((task) => !task.hiddenFromTodo && taskScheduledOnDay(task, currentDate))
    const todoCompleted = todayTodos.filter((task) => task.completed).length
    const todoTotal = todayTodos.length
    const dailyHabits = filterHabitsByFrequency(habitTasks, "daily").filter(
      (habit) => !isHabitPeriodExempt(habit, dayKey, "daily", habitExemptions),
    )
    const dayData = weeklyData[dayKey] ?? {}
    let habitCompleted = 0
    for (const habit of dailyHabits) {
      if (isHabitGoalMet(habit, dayData[habit.id], { date: currentDate, weeklyData })) habitCompleted++
    }
    const habitTotal = dailyHabits.length
    return {
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
    }
  }, [tasks, habitTasks, weeklyData, habitExemptions, exemptionCtx, dayKey, currentDate])
}
