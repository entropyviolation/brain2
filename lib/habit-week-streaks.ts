/**
 * lib/habit-week-streaks.ts — 4+ day weeks for daily habits
 *
 * A "week streak" is consecutive Monday–Sunday weeks in which the habit was
 * completed on at least `WEEKLY_INCREMENT_MIN_DAYS` (4) days. Independent of
 * climb cadence / weekly-increment bumps; used only for on-grid chips.
 */
import { WEEKLY_INCREMENT_MIN_DAYS } from "@/lib/incremental-habits"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { formatLocalDateKey, getWeekDates, getWeekStartDate, parseLocalDate } from "@/lib/date-utils"
import { computeStreak } from "@/lib/streaks"
import type { WeeklyData, WeeklyTask } from "@/lib/types"

export { WEEKLY_INCREMENT_MIN_DAYS }

export function countHabitDaysMetInWeek(
  task: WeeklyTask,
  weeklyData: WeeklyData,
  weekStart: Date,
  isExemptDay?: (dateKey: string) => boolean,
): number {
  const days = getWeekDates(weekStart)
  let n = 0
  for (const date of days) {
    const key = formatLocalDateKey(date)
    if (isExemptDay?.(key)) continue
    if (isHabitGoalMet(task, weeklyData[key]?.[task.id], { date, weeklyData })) n++
  }
  return n
}

/** Mondays of weeks where this habit was done on ≥4 days. */
export function fourPlusWeekMondayKeys(
  task: WeeklyTask,
  weeklyData: WeeklyData,
  isExemptDay?: (dateKey: string) => boolean,
): string[] {
  const mondays = new Set<string>()
  for (const dateKey of Object.keys(weeklyData)) {
    const date = parseLocalDate(dateKey)
    if (!date) continue
    mondays.add(formatLocalDateKey(getWeekStartDate(date)))
  }
  const hits: string[] = []
  for (const mondayKey of mondays) {
    const monday = parseLocalDate(mondayKey)
    if (!monday) continue
    if (countHabitDaysMetInWeek(task, weeklyData, monday, isExemptDay) >= WEEKLY_INCREMENT_MIN_DAYS) {
      hits.push(mondayKey)
    }
  }
  return hits.sort()
}

export interface HabitWeekStreakSummary {
  thisWeekDays: number
  thisWeekHit: boolean
  current: number
  longest: number
}

export function habitWeekStreakSummary(
  task: WeeklyTask,
  weeklyData: WeeklyData,
  weekStart: Date,
  asOf: Date = new Date(),
  isExemptDay?: (dateKey: string) => boolean,
): HabitWeekStreakSummary {
  const thisWeekDays = countHabitDaysMetInWeek(task, weeklyData, weekStart, isExemptDay)
  const thisWeekHit = thisWeekDays >= WEEKLY_INCREMENT_MIN_DAYS
  const streak = computeStreak(fourPlusWeekMondayKeys(task, weeklyData, isExemptDay), { unit: "week", today: asOf })
  return {
    thisWeekDays,
    thisWeekHit,
    current: streak.current,
    longest: streak.longest,
  }
}
