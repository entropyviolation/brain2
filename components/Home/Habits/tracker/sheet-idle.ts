/**
 * tracker/sheet-idle.ts — Shared placeholders for a closed Habits tab.
 *
 * One module-level map and one empty id list. A fresh array or map on each
 * call would change the morning-review fallback and the idle percent identity.
 */
import type { GoodDaySummary } from "@/lib/habit-accomplishment"
import type { OutputGradeResult, WeekGradeResult } from "@/lib/calculations"

export const EMPTY_HABIT_PRIORITY_IDS: string[] = []

export function openGrade(result: WeekGradeResult): number | null {
  if (result.days.length > 0 && result.days.every((day) => day.vacant)) return null
  return result.grade
}

export function openOutput(result: OutputGradeResult): number | null {
  if (result.daysIncluded > 0 && result.habits.length === 0) return null
  return result.grade
}

/** Placeholder while that frequency's tab is closed. Tubes read the live memo once the tab opens. */
export const IDLE_GRADE: WeekGradeResult = {
  grade: 0,
  rawGrade: 0,
  daysIncluded: 0,
  days: [],
  tolerance: 100,
  curveBonus: 0,
}

export const IDLE_OUTPUT: OutputGradeResult = {
  grade: 0,
  rawGrade: 0,
  daysIncluded: 0,
  habits: [],
  tolerance: 100,
  curveBonus: 0,
}

export const IDLE_PERCENTS = new Map<string, number>()

export const IDLE_GOOD_DAYS: GoodDaySummary = {
  threshold: 80,
  bonus: 50,
  streak: 0,
  longestStreak: 0,
  last30Count: 0,
  last30: [],
  todayRaw: 0,
  todayCompletionRaw: 0,
  todayGood: false,
  prior7Average: 0,
  prior30Average: 0,
  prior7VsToday: "same",
  prior30VsToday: "same",
  yesterdayCompletionRaw: 0,
  yesterdayVsToday: "same",
  weeks: {
    thisWeek: 0,
    lastWeek: 0,
    thisYear: 0,
    allTime: 0,
    lastWeekVs: "same",
    thisYearVs: "same",
    allTimeVs: "same",
  },
}
