/**
 * tracker/good-period-model.ts — Good day and good period summaries.
 *
 * Called from `useMemo` on the desktop page. `goodDayAsOf` is the wall clock,
 * not the Home plan cursor. A closed tab returns the idle summary or null.
 */
import {
  goodDaySummary,
  goodPeriodSummary,
  rawDayCompletionPercent,
  type GoodDaySummary,
  type GoodPeriodSummary,
} from "@/lib/habit-accomplishment"
import { blendPriorityScore, prioritizedHabits } from "@/lib/habit-priority"
import type { WeeklyData, WeeklyTask } from "@/lib/types"
import { IDLE_GOOD_DAYS } from "@/components/Home/Habits/tracker/sheet-idle"
import type { DailyExempt } from "@/components/Home/Habits/tracker/daily-model"

export function computeGoodDays(input: {
  habitTab: string
  dailyTasks: WeeklyTask[]
  weeklyData: WeeklyData
  goodDayAsOf: Date
  accomplishmentThreshold: number
  accomplishmentBonus: number
  goodDaysUsePriority: boolean
  dailyExempt: DailyExempt
}): GoodDaySummary {
  const {
    habitTab,
    dailyTasks,
    weeklyData,
    goodDayAsOf,
    accomplishmentThreshold,
    accomplishmentBonus,
    goodDaysUsePriority,
    dailyExempt,
  } = input
  if (habitTab !== "daily") return IDLE_GOOD_DAYS
  return goodDaySummary(
    dailyTasks,
    weeklyData,
    goodDayAsOf,
    accomplishmentThreshold,
    accomplishmentBonus,
    goodDaysUsePriority
      ? (date, overall) => {
          const prio = prioritizedHabits(dailyTasks, weeklyData, date, "daily")
          const prioRaw =
            prio.length > 0 ? rawDayCompletionPercent(prio, weeklyData, date, dailyExempt) : null
          return blendPriorityScore(overall, prioRaw, true)
        }
      : undefined,
    dailyExempt,
  )
}

export function computeTodayPrioRaw(input: {
  habitTab: string
  dailyTasks: WeeklyTask[]
  weeklyData: WeeklyData
  goodDayAsOf: Date
  dailyExempt: DailyExempt
}): number | null {
  const { habitTab, dailyTasks, weeklyData, goodDayAsOf, dailyExempt } = input
  if (habitTab !== "daily") return null
  const todayPrioHabits = prioritizedHabits(dailyTasks, weeklyData, goodDayAsOf, "daily")
  return todayPrioHabits.length > 0
    ? rawDayCompletionPercent(todayPrioHabits, weeklyData, goodDayAsOf, dailyExempt)
    : null
}

export function computeGoodPeriod(input: {
  habitTab: string
  dailyTasks: WeeklyTask[]
  weeklyData: WeeklyData
  goodDayAsOf: Date
  accomplishmentThreshold: number
  accomplishmentBonus: number
  dailyExempt: DailyExempt
}): GoodPeriodSummary | null {
  const {
    habitTab,
    dailyTasks,
    weeklyData,
    goodDayAsOf,
    accomplishmentThreshold,
    accomplishmentBonus,
    dailyExempt,
  } = input
  if (habitTab !== "weekly" && habitTab !== "monthly" && habitTab !== "quarterly") return null
  const unit = habitTab === "weekly" ? "week" : habitTab === "monthly" ? "month" : "season"
  return goodPeriodSummary(
    dailyTasks,
    weeklyData,
    goodDayAsOf,
    unit,
    accomplishmentThreshold,
    accomplishmentBonus,
    dailyExempt,
  )
}
