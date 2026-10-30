/**
 * tracker/weekly-model.ts — Weekly sheet bundle.
 *
 * A closed Weekly tab returns idle grades and skips the period grade math.
 */
import {
  calculatePeriodGrade,
  calculatePeriodOutputGrade,
  calculatePeriodTaskPercentage,
  type OutputGradeResult,
  type WeekGradeResult,
} from "@/lib/calculations"
import { exemptionKind, isHabitPeriodExempt, type ExemptionBooks, type ExemptionContext, type ExemptionKind } from "@/lib/habit-exemption"
import { prioritizedHabits } from "@/lib/habit-priority"
import { sortHabits, type HabitSortMode } from "@/lib/habit-sort"
import type { HabitWeekWindowMode } from "@/lib/habit-week-window"
import type { WeeklyData, WeeklyTask } from "@/lib/types"
import { filterHabitsByFrequency, weekPeriodColumns, type PeriodColumn } from "@/components/Home/Habits/period-habit-list"
import { IDLE_GRADE, IDLE_OUTPUT, IDLE_PERCENTS, openGrade, openOutput } from "@/components/Home/Habits/tracker/sheet-idle"

export type WeeklyExempt = (task: WeeklyTask, key: string) => boolean
export type WeeklyKind = (task: WeeklyTask, key: string) => ExemptionKind

export type WeeklyBundle = {
  weeklyTasks: WeeklyTask[]
  weeklyExempt: WeeklyExempt
  weeklyKind: WeeklyKind
  periods: PeriodColumn[]
  periodPercent: Map<string, number>
  shown: WeeklyTask[]
  grade: WeekGradeResult
  output: OutputGradeResult
  prioGrade: number | null
  prioOutput: number | null
}

export function computeWeeklyBundle(input: {
  habitTab: string
  tasks: WeeklyTask[]
  weeklyHabitData: WeeklyData
  habitExemptions: ExemptionBooks
  exemptionCtx: ExemptionContext
  weekWindowAsOf: Date
  habitWeekWindow: HabitWeekWindowMode
  currentDate: Date
  gradeTolerance: number
  outputGradeTolerance: number
  habitSortMode: HabitSortMode
  sortDescending: boolean
}): WeeklyBundle {
  const {
    habitTab,
    tasks,
    weeklyHabitData,
    habitExemptions,
    exemptionCtx,
    weekWindowAsOf,
    habitWeekWindow,
    currentDate,
    gradeTolerance,
    outputGradeTolerance,
    habitSortMode,
    sortDescending,
  } = input
  const weeklyTasks = filterHabitsByFrequency(tasks, "weekly")
  const weeklyExempt = (task: WeeklyTask, key: string) =>
    isHabitPeriodExempt(task, key, "weekly", habitExemptions, exemptionCtx)
  const weeklyKind = (task: WeeklyTask, key: string) => exemptionKind(task, key, "weekly", habitExemptions, exemptionCtx)
  if (habitTab !== "weekly") {
    return {
      weeklyTasks,
      weeklyExempt,
      weeklyKind,
      periods: [],
      periodPercent: IDLE_PERCENTS,
      shown: weeklyTasks,
      grade: IDLE_GRADE,
      output: IDLE_OUTPUT,
      prioGrade: null,
      prioOutput: null,
    }
  }
  const periods = weekPeriodColumns(weekWindowAsOf, habitWeekWindow)
  const periodPercent = new Map<string, number>()
  for (const task of weeklyTasks) {
    periodPercent.set(
      task.id,
      calculatePeriodTaskPercentage(task.id, weeklyTasks, weeklyHabitData, periods, weeklyExempt),
    )
  }
  const shown = sortHabits(weeklyTasks, habitSortMode, {
    data: weeklyHabitData,
    asOf: currentDate,
    frequency: "weekly",
    descending: sortDescending,
    completionPercent: (taskId) => periodPercent.get(taskId) ?? 0,
  })
  const gradeAsOf = weekWindowAsOf
  const grade = calculatePeriodGrade(weeklyTasks, weeklyHabitData, periods, gradeAsOf, gradeTolerance, weeklyExempt)
  const output = calculatePeriodOutputGrade(
    weeklyTasks,
    weeklyHabitData,
    periods,
    gradeAsOf,
    outputGradeTolerance,
    weeklyExempt,
  )
  const prio = prioritizedHabits(weeklyTasks, weeklyHabitData, gradeAsOf, "weekly")
  return {
    weeklyTasks,
    weeklyExempt,
    weeklyKind,
    periods,
    periodPercent,
    shown,
    grade,
    output,
    prioGrade:
      prio.length > 0
        ? openGrade(calculatePeriodGrade(prio, weeklyHabitData, periods, gradeAsOf, gradeTolerance, weeklyExempt))
        : null,
    prioOutput:
      prio.length > 0
        ? openOutput(
            calculatePeriodOutputGrade(prio, weeklyHabitData, periods, gradeAsOf, outputGradeTolerance, weeklyExempt),
          )
        : null,
  }
}
