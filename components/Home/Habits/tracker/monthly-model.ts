/**
 * tracker/monthly-model.ts — Monthly sheet bundle.
 *
 * A closed Monthly tab returns idle grades and skips the period grade math.
 */
import {
  calculatePeriodGrade,
  calculatePeriodOutputGrade,
  calculatePeriodTaskPercentage,
  type OutputGradeResult,
  type WeekGradeResult,
} from "@/lib/calculations"
import { exemptionKind, isHabitPeriodExempt, type ExemptionBooks, type ExemptionContext, type ExemptionKind } from "@/lib/habit-exemption"
import type { HabitBirthday, HabitMonthWindowMode } from "@/lib/habit-month-window"
import { prioritizedHabits } from "@/lib/habit-priority"
import { sortHabits, type HabitSortMode } from "@/lib/habit-sort"
import type { WeeklyData, WeeklyTask } from "@/lib/types"
import { filterHabitsByFrequency, monthPeriodColumns, type PeriodColumn } from "@/components/Home/Habits/period-habit-list"
import { IDLE_GRADE, IDLE_OUTPUT, IDLE_PERCENTS, openGrade, openOutput } from "@/components/Home/Habits/tracker/sheet-idle"

export type MonthlyExempt = (task: WeeklyTask, key: string) => boolean
export type MonthlyKind = (task: WeeklyTask, key: string) => ExemptionKind

export type MonthlyBundle = {
  monthlyTasks: WeeklyTask[]
  monthlyExempt: MonthlyExempt
  monthlyKind: MonthlyKind
  periods: PeriodColumn[]
  periodPercent: Map<string, number>
  shown: WeeklyTask[]
  grade: WeekGradeResult
  output: OutputGradeResult
  prioGrade: number | null
  prioOutput: number | null
}

export function computeMonthlyBundle(input: {
  habitTab: string
  tasks: WeeklyTask[]
  monthlyHabitData: WeeklyData
  habitExemptions: ExemptionBooks
  exemptionCtx: ExemptionContext
  monthWindowAsOf: Date
  habitMonthWindow: HabitMonthWindowMode
  habitBirthday: HabitBirthday
  currentDate: Date
  gradeTolerance: number
  outputGradeTolerance: number
  habitSortMode: HabitSortMode
  sortDescending: boolean
}): MonthlyBundle {
  const {
    habitTab,
    tasks,
    monthlyHabitData,
    habitExemptions,
    exemptionCtx,
    monthWindowAsOf,
    habitMonthWindow,
    habitBirthday,
    currentDate,
    gradeTolerance,
    outputGradeTolerance,
    habitSortMode,
    sortDescending,
  } = input
  const monthlyTasks = filterHabitsByFrequency(tasks, "monthly")
  const monthlyExempt = (task: WeeklyTask, key: string) =>
    isHabitPeriodExempt(task, key, "monthly", habitExemptions, exemptionCtx)
  const monthlyKind = (task: WeeklyTask, key: string) => exemptionKind(task, key, "monthly", habitExemptions, exemptionCtx)
  if (habitTab !== "monthly") {
    return {
      monthlyTasks,
      monthlyExempt,
      monthlyKind,
      periods: [],
      periodPercent: IDLE_PERCENTS,
      shown: monthlyTasks,
      grade: IDLE_GRADE,
      output: IDLE_OUTPUT,
      prioGrade: null,
      prioOutput: null,
    }
  }
  const periods = monthPeriodColumns(monthWindowAsOf, habitMonthWindow, habitBirthday)
  const periodPercent = new Map<string, number>()
  for (const task of monthlyTasks) {
    periodPercent.set(
      task.id,
      calculatePeriodTaskPercentage(task.id, monthlyTasks, monthlyHabitData, periods, monthlyExempt),
    )
  }
  const shown = sortHabits(monthlyTasks, habitSortMode, {
    data: monthlyHabitData,
    asOf: currentDate,
    frequency: "monthly",
    descending: sortDescending,
    completionPercent: (taskId) => periodPercent.get(taskId) ?? 0,
  })
  const gradeAsOf = monthWindowAsOf
  const grade = calculatePeriodGrade(monthlyTasks, monthlyHabitData, periods, gradeAsOf, gradeTolerance, monthlyExempt)
  const output = calculatePeriodOutputGrade(
    monthlyTasks,
    monthlyHabitData,
    periods,
    gradeAsOf,
    outputGradeTolerance,
    monthlyExempt,
  )
  const prio = prioritizedHabits(monthlyTasks, monthlyHabitData, gradeAsOf, "monthly")
  return {
    monthlyTasks,
    monthlyExempt,
    monthlyKind,
    periods,
    periodPercent,
    shown,
    grade,
    output,
    prioGrade:
      prio.length > 0
        ? openGrade(calculatePeriodGrade(prio, monthlyHabitData, periods, gradeAsOf, gradeTolerance, monthlyExempt))
        : null,
    prioOutput:
      prio.length > 0
        ? openOutput(
            calculatePeriodOutputGrade(
              prio,
              monthlyHabitData,
              periods,
              gradeAsOf,
              outputGradeTolerance,
              monthlyExempt,
            ),
          )
        : null,
  }
}
