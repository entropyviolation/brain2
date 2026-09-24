/**
 * lib/habit-accomplishment.ts — Daily "good day" threshold, bonus, and streaks
 *
 * Overall daily-habit settings (not per-habit): the raw column completion %
 * that counts as feeling accomplished, and the point bonus awarded that day.
 * Defaults match the old hardcoded +50 when a day's overall score cleared 80%.
 * A day at or above the threshold is a Good day (so 80% is enough).
 *
 * Week grade / Perfect output curves are independent — this module never reads
 * `gradeTolerance` or `outputGradeTolerance`.
 *
 * Spec: §9, §14.
 */
import { calculateDayPercentageAV, type HabitExemptFn } from "./calculations"
import { formatLocalDateKey, getWeekDates, getWeekStartDate, parseLocalDate } from "./date-utils"
import { computeStreak } from "./streaks"
import type { WeeklyData, WeeklyTask } from "./types"

export const DEFAULT_ACCOMPLISHMENT_THRESHOLD = 80
export const DEFAULT_ACCOMPLISHMENT_BONUS = 50
export const GOOD_DAYS_LOOKBACK = 30
export const MAX_ACCOMPLISHMENT_BONUS = 10_000

export function clampAccomplishmentThreshold(threshold: number): number {
  if (!Number.isFinite(threshold)) return DEFAULT_ACCOMPLISHMENT_THRESHOLD
  return Math.min(100, Math.max(1, Math.round(threshold)))
}

export function clampAccomplishmentBonus(bonus: number): number {
  if (!Number.isFinite(bonus)) return DEFAULT_ACCOMPLISHMENT_BONUS
  return Math.min(MAX_ACCOMPLISHMENT_BONUS, Math.max(0, Math.round(bonus)))
}

/** Local calendar days ending on `asOf`, oldest first. */
export function localCalendarDaysEndingOn(asOf: Date, count: number = GOOD_DAYS_LOOKBACK): Date[] {
  const n = Number.isFinite(count) ? Math.max(0, Math.round(count)) : GOOD_DAYS_LOOKBACK
  const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())
  const days: Date[] = []
  for (let i = n - 1; i >= 0; i--) {
    days.push(new Date(end.getFullYear(), end.getMonth(), end.getDate() - i))
  }
  return days
}

/** Overall daily-habit completion % for one calendar day (same math as the grid). */
export function rawDayCompletionPercent(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  date: Date,
  isExempt?: HabitExemptFn,
): number {
  if (tasks.length === 0) return 0
  const dateKey = formatLocalDateKey(date)
  if (isExempt && tasks.every((task) => isExempt(task, dateKey))) return 0
  const weekDates = getWeekDates(getWeekStartDate(date))
  const dayIndex = weekDates.findIndex((d) => formatLocalDateKey(d) === dateKey)
  return calculateDayPercentageAV(dateKey, tasks, weeklyData, dayIndex < 0 ? 0 : dayIndex, isExempt)
}

export function isAccomplishedDay(rawPercent: number, threshold: number): boolean {
  if (!Number.isFinite(rawPercent) || rawPercent <= 0) return false
  return rawPercent >= clampAccomplishmentThreshold(threshold)
}

export function accomplishmentBonusPoints(
  rawPercent: number,
  threshold: number = DEFAULT_ACCOMPLISHMENT_THRESHOLD,
  bonus: number = DEFAULT_ACCOMPLISHMENT_BONUS,
): number {
  return isAccomplishedDay(rawPercent, threshold) ? clampAccomplishmentBonus(bonus) : 0
}

export function accomplishmentBonusDescription(points: number, threshold: number): string {
  const t = clampAccomplishmentThreshold(threshold)
  return points > 0 ? `Accomplishment bonus (${t}%+)` : "Accomplishment bonus"
}

export function collectAccomplishedDateKeys(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  asOf: Date,
  threshold: number,
  scoreForDay?: (date: Date, overallRaw: number) => number,
  isExempt?: HabitExemptFn,
): string[] {
  const asOfKey = formatLocalDateKey(asOf)
  const keys = new Set<string>()
  for (const key of Object.keys(weeklyData || {})) {
    if (key <= asOfKey) keys.add(key)
  }
  for (const day of localCalendarDaysEndingOn(asOf)) {
    keys.add(formatLocalDateKey(day))
  }
  const hits: string[] = []
  const t = clampAccomplishmentThreshold(threshold)
  for (const key of keys) {
    const date = parseLocalDate(key)
    if (!date) continue
    const overall = rawDayCompletionPercent(tasks, weeklyData, date, isExempt)
    const scored = scoreForDay ? scoreForDay(date, overall) : overall
    if (isAccomplishedDay(scored, t)) hits.push(key)
  }
  return hits.sort()
}

export interface GoodDayLookbackDay {
  date: Date
  dateKey: string
  raw: number
  good: boolean
}

export interface GoodDaySummary {
  threshold: number
  bonus: number
  streak: number
  longestStreak: number
  last30Count: number
  last30: GoodDayLookbackDay[]
  todayRaw: number
  todayGood: boolean
}

export function goodDaySummary(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  asOf: Date,
  threshold: number,
  bonus: number = DEFAULT_ACCOMPLISHMENT_BONUS,
  scoreForDay?: (date: Date, overallRaw: number) => number,
  isExempt?: HabitExemptFn,
): GoodDaySummary {
  const t = clampAccomplishmentThreshold(threshold)
  const last30 = localCalendarDaysEndingOn(asOf, GOOD_DAYS_LOOKBACK).map((date) => {
    const raw = rawDayCompletionPercent(tasks, weeklyData, date, isExempt)
    const scored = scoreForDay ? scoreForDay(date, raw) : raw
    return { date, dateKey: formatLocalDateKey(date), raw: scored, good: isAccomplishedDay(scored, t) }
  })
  const hits = collectAccomplishedDateKeys(tasks, weeklyData, asOf, t, scoreForDay, isExempt)
  const streak = computeStreak(hits, {
    unit: "day",
    today: asOf,
  })
  const today = last30[last30.length - 1]
  return {
    threshold: t,
    bonus: clampAccomplishmentBonus(bonus),
    streak: streak.current,
    longestStreak: streak.longest,
    last30Count: last30.filter((d) => d.good).length,
    last30,
    todayRaw: today?.raw ?? 0,
    todayGood: today?.good ?? false,
  }
}
