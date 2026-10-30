/**
 * tracker/season-model.ts — Season sheet bundle.
 *
 * A closed Season tab returns idle grades and skips the period grade math.
 * The tab value stays `quarterly`.
 */
import {
  calculatePeriodGrade,
  calculatePeriodOutputGrade,
  calculatePeriodTaskPercentage,
  gradeAsOfForVisibleWindow,
  type OutputGradeResult,
  type WeekGradeResult,
} from "@/lib/calculations"
import { exemptionKind, isHabitPeriodExempt, type ExemptionBooks, type ExemptionContext, type ExemptionKind } from "@/lib/habit-exemption"
import { prioritizedHabits } from "@/lib/habit-priority"
import { sortHabits, type HabitSortMode } from "@/lib/habit-sort"
import type { WeeklyData, WeeklyTask } from "@/lib/types"
import { filterHabitsByFrequency, seasonPeriodColumns, type PeriodColumn } from "@/components/Home/Habits/period-habit-list"
import { IDLE_GRADE, IDLE_OUTPUT, IDLE_PERCENTS, openGrade, openOutput } from "@/components/Home/Habits/tracker/sheet-idle"

export type QuarterlyExempt = (task: WeeklyTask, key: string) => boolean
export type QuarterlyKind = (task: WeeklyTask, key: string) => ExemptionKind

export type QuarterlyBundle = {
  quarterlyTasks: WeeklyTask[]
  quarterlyExempt: QuarterlyExempt
  quarterlyKind: QuarterlyKind
  periods: PeriodColumn[]
  periodPercent: Map<string, number>
  shown: WeeklyTask[]
  grade: WeekGradeResult
  output: OutputGradeResult
  prioGrade: number | null
  prioOutput: number | null
}

export function computeSeasonBundle(input: {
  habitTab: string
  tasks: WeeklyTask[]
  quarterlyHabitData: WeeklyData
  habitExemptions: ExemptionBooks
  exemptionCtx: ExemptionContext
  currentQuarter: Date
  currentDate: Date
  gradeTolerance: number
  outputGradeTolerance: number
  habitSortMode: HabitSortMode
  sortDescending: boolean
}): QuarterlyBundle {
  const {
    habitTab,
    tasks,
    quarterlyHabitData,
    habitExemptions,
    exemptionCtx,
    currentQuarter,
    currentDate,
    gradeTolerance,
    outputGradeTolerance,
    habitSortMode,
    sortDescending,
  } = input
  const quarterlyTasks = filterHabitsByFrequency(tasks, "quarterly")
  const quarterlyExempt = (task: WeeklyTask, key: string) =>
    isHabitPeriodExempt(task, key, "quarterly", habitExemptions, exemptionCtx)
  const quarterlyKind = (task: WeeklyTask, key: string) =>
    exemptionKind(task, key, "quarterly", habitExemptions, exemptionCtx)
  if (habitTab !== "quarterly") {
    return {
      quarterlyTasks,
      quarterlyExempt,
      quarterlyKind,
      periods: [],
      periodPercent: IDLE_PERCENTS,
      shown: quarterlyTasks,
      grade: IDLE_GRADE,
      output: IDLE_OUTPUT,
      prioGrade: null,
      prioOutput: null,
    }
  }
  const periods = seasonPeriodColumns(currentQuarter, currentDate)
  const periodPercent = new Map<string, number>()
  for (const task of quarterlyTasks) {
    periodPercent.set(
      task.id,
      calculatePeriodTaskPercentage(task.id, quarterlyTasks, quarterlyHabitData, periods, quarterlyExempt),
    )
  }
  const shown = sortHabits(quarterlyTasks, habitSortMode, {
    data: quarterlyHabitData,
    asOf: currentDate,
    frequency: "quarterly",
    descending: sortDescending,
    completionPercent: (taskId) => periodPercent.get(taskId) ?? 0,
  })
  const last = periods[periods.length - 1]?.date
  const periodEnd = last ? new Date(last.getFullYear(), last.getMonth() + 3, 0) : currentQuarter
  const gradeAsOf = periods.length ? gradeAsOfForVisibleWindow(periods[0].date, periodEnd, currentDate) : currentDate
  const grade = calculatePeriodGrade(
    quarterlyTasks,
    quarterlyHabitData,
    periods,
    gradeAsOf,
    gradeTolerance,
    quarterlyExempt,
  )
  const output = calculatePeriodOutputGrade(
    quarterlyTasks,
    quarterlyHabitData,
    periods,
    gradeAsOf,
    outputGradeTolerance,
    quarterlyExempt,
  )
  const prio = prioritizedHabits(quarterlyTasks, quarterlyHabitData, gradeAsOf, "quarterly")
  return {
    quarterlyTasks,
    quarterlyExempt,
    quarterlyKind,
    periods,
    periodPercent,
    shown,
    grade,
    output,
    prioGrade:
      prio.length > 0
        ? openGrade(
            calculatePeriodGrade(prio, quarterlyHabitData, periods, gradeAsOf, gradeTolerance, quarterlyExempt),
          )
        : null,
    prioOutput:
      prio.length > 0
        ? openOutput(
            calculatePeriodOutputGrade(
              prio,
              quarterlyHabitData,
              periods,
              gradeAsOf,
              outputGradeTolerance,
              quarterlyExempt,
            ),
          )
        : null,
  }
}
