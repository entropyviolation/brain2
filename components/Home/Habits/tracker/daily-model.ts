/**
 * tracker/daily-model.ts — Daily sheet bundle.
 *
 * Willpower stones are computed before the closed-tab return. Weekly,
 * monthly, and season panes show those daily stones.
 */
import {
  averageWeekGradeAcrossWeeksWithData,
  calculateTaskPercentage,
  calculateWeekToDateGrade,
  calculateWeekToDateOutputGrade,
  gradeAsOfForVisibleWindow,
  type OutputGradeResult,
  type WeekGradeResult,
} from "@/lib/calculations"
import { exemptionKind, isHabitPeriodExempt, type ExemptionBooks, type ExemptionContext, type ExemptionKind } from "@/lib/habit-exemption"
import { prioritizedHabits } from "@/lib/habit-priority"
import { sortHabits, type HabitSortMode } from "@/lib/habit-sort"
import type { WeeklyData, WeeklyTask } from "@/lib/types"
import { weekWillpowerStones, type WillpowerStone } from "@/lib/willpower-stones"
import { filterHabitsByFrequency } from "@/components/Home/Habits/period-habit-list"
import { IDLE_GRADE, IDLE_OUTPUT, IDLE_PERCENTS, openGrade, openOutput } from "@/components/Home/Habits/tracker/sheet-idle"

export type DailyExempt = (task: WeeklyTask, key: string) => boolean
export type DailyKind = (task: WeeklyTask, key: string) => ExemptionKind

export type DailyBundle = {
  dailyTasks: WeeklyTask[]
  dailyExempt: DailyExempt
  dailyKind: DailyKind
  shown: WeeklyTask[]
  weekPercent: Map<string, number>
  grade: WeekGradeResult
  output: OutputGradeResult
  prioGrade: number | null
  prioOutput: number | null
  weekAverage: number | null
  stones: WillpowerStone[]
}

export function computeDailyBundle(input: {
  habitTab: string
  tasks: WeeklyTask[]
  weeklyData: WeeklyData
  habitExemptions: ExemptionBooks
  exemptionCtx: ExemptionContext
  weekDates: Date[]
  currentDate: Date
  gradeTolerance: number
  outputGradeTolerance: number
  habitSortMode: HabitSortMode
  sortDescending: boolean
}): DailyBundle {
  const {
    habitTab,
    tasks,
    weeklyData,
    habitExemptions,
    exemptionCtx,
    weekDates,
    currentDate,
    gradeTolerance,
    outputGradeTolerance,
    habitSortMode,
    sortDescending,
  } = input
  const dailyTasks = filterHabitsByFrequency(tasks, "daily")
  const dailyExempt = (task: WeeklyTask, key: string) => isHabitPeriodExempt(task, key, "daily", habitExemptions, exemptionCtx)
  const dailyKind = (task: WeeklyTask, key: string) => exemptionKind(task, key, "daily", habitExemptions, exemptionCtx)
  const stones = weekWillpowerStones(dailyTasks, weeklyData, weekDates, dailyExempt)
  if (habitTab !== "daily") {
    return {
      dailyTasks,
      dailyExempt,
      dailyKind,
      shown: dailyTasks,
      weekPercent: IDLE_PERCENTS,
      grade: IDLE_GRADE,
      output: IDLE_OUTPUT,
      prioGrade: null,
      prioOutput: null,
      weekAverage: null,
      stones,
    }
  }
  const weekPercent = new Map<string, number>()
  for (const task of dailyTasks) {
    weekPercent.set(task.id, calculateTaskPercentage(task.id, dailyTasks, weeklyData, weekDates, dailyExempt))
  }
  const shown = sortHabits(dailyTasks, habitSortMode, {
    data: weeklyData,
    asOf: currentDate,
    frequency: "daily",
    descending: sortDescending,
    completionPercent: (taskId) => weekPercent.get(taskId) ?? 0,
  })
  const gradeAsOf =
    weekDates.length > 0
      ? gradeAsOfForVisibleWindow(weekDates[0], weekDates[weekDates.length - 1], currentDate)
      : currentDate
  const grade = calculateWeekToDateGrade(dailyTasks, weeklyData, weekDates, gradeAsOf, gradeTolerance, dailyExempt)
  const weekAverage = averageWeekGradeAcrossWeeksWithData(
    dailyTasks,
    weeklyData,
    gradeAsOf,
    gradeTolerance,
    dailyExempt,
  )
  const output = calculateWeekToDateOutputGrade(
    dailyTasks,
    weeklyData,
    weekDates,
    gradeAsOf,
    outputGradeTolerance,
    dailyExempt,
  )
  const prio = prioritizedHabits(dailyTasks, weeklyData, gradeAsOf, "daily")
  return {
    dailyTasks,
    dailyExempt,
    dailyKind,
    shown,
    weekPercent,
    grade,
    output,
    weekAverage,
    prioGrade:
      prio.length > 0
        ? openGrade(calculateWeekToDateGrade(prio, weeklyData, weekDates, gradeAsOf, gradeTolerance, dailyExempt))
        : null,
    prioOutput:
      prio.length > 0
        ? openOutput(
            calculateWeekToDateOutputGrade(prio, weeklyData, weekDates, gradeAsOf, outputGradeTolerance, dailyExempt),
          )
        : null,
    stones,
  }
}
