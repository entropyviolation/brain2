/**
 * lib/habit-accomplishment.ts — Daily "good day" threshold, bonus, and streaks
 *
 * Overall daily-habit settings (not per-habit): the raw column completion %
 * that counts as feeling accomplished, and the point bonus awarded that day.
 * Defaults match the old hardcoded +50 when a day's overall score cleared 80%.
 * A day at or above the threshold is a Good day (so 80% is enough).
 * `priorRawAverage` is the mean of `rawDayCompletionPercent` over the calendar
 * days before today (7 and 30). Empty days count as 0. Today is not included.
 * `weekRawAverage` is the mean of those day scores for one Monday week: days
 * that have happened, including today, while the week is in progress, and all
 * seven once the week is finished. Empty days in that span count as 0.
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
/** Calendar days before today used for the weekly raw-completion average. */
export const PRIOR_WEEK_DAYS = 7
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

/** How an older average sits next to today. Whole percents, same rounding as the sheet. */
export type OlderAverageVsToday = "higher" | "same" | "lower"

/**
 * `higher` — the older average is above today (today is behind).
 * `lower` — the older average is below today (today is ahead).
 * `same` — the rounded percents match.
 */
export function olderAverageComparedToToday(average: number, todayRaw: number): OlderAverageVsToday {
  const older = Math.round(Number.isFinite(average) ? average : 0)
  const today = Math.round(Number.isFinite(todayRaw) ? todayRaw : 0)
  if (older > today) return "higher"
  if (older < today) return "lower"
  return "same"
}

/** The `count` local calendar days immediately before `asOf` (not including `asOf`), oldest first. */
export function priorCalendarDays(asOf: Date, count: number): Date[] {
  const end = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() - 1)
  return localCalendarDaysEndingOn(end, count)
}

/**
 * Mean of `rawDayCompletionPercent` over the `count` days before `asOf`.
 * Empty days count as 0. Today is not in the average.
 */
export function priorRawAverage(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  asOf: Date,
  count: number,
  isExempt?: HabitExemptFn,
  cache?: Map<string, number>,
): number {
  const days = priorCalendarDays(asOf, count)
  if (days.length === 0) return 0
  let sum = 0
  for (const date of days) {
    const key = formatLocalDateKey(date)
    let value = cache?.get(key)
    if (value === undefined) {
      value = rawDayCompletionPercent(tasks, weeklyData, date, isExempt)
      cache?.set(key, value)
    }
    sum += value
  }
  return sum / days.length
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

export interface WeekRawComparisons {
  /** This week's raw average (elapsed days, or all 7 when the week is finished). */
  thisWeek: number
  lastWeek: number
  /** Mean of week raw averages for weeks with data that overlap this calendar year. */
  thisYear: number
  /** Mean of week raw averages for every week with data up through today. */
  allTime: number
  lastWeekVs: OlderAverageVsToday
  thisYearVs: OlderAverageVsToday
  allTimeVs: OlderAverageVsToday
}

/** A week counts once some daily habit has a stored cell in it. */
function weekHasRecordedCompletion(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  weekStart: Date,
): boolean {
  for (const date of getWeekDates(getWeekStartDate(weekStart))) {
    const bucket = weeklyData[formatLocalDateKey(date)]
    if (!bucket) continue
    for (const task of tasks) {
      if (bucket[task.id]) return true
    }
  }
  return false
}

/**
 * Mean raw day completion for one week.
 * In progress: days from Monday through `asOf`, divided by how many of those days exist.
 * Finished (Sunday is on or before `asOf`): all seven days, empty ones as 0.
 */
export function weekRawAverage(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  weekStart: Date,
  asOf: Date,
  isExempt?: HabitExemptFn,
): number {
  const dates = getWeekDates(getWeekStartDate(weekStart))
  const asOfKey = formatLocalDateKey(asOf)
  if (formatLocalDateKey(dates[0]) > asOfKey) return 0
  const finished = formatLocalDateKey(dates[6]) <= asOfKey
  const included = finished ? dates : dates.filter((date) => formatLocalDateKey(date) <= asOfKey)
  if (included.length === 0) return 0
  let sum = 0
  for (const date of included) sum += rawDayCompletionPercent(tasks, weeklyData, date, isExempt)
  return sum / (finished ? 7 : included.length)
}

function weekStartsWithData(tasks: WeeklyTask[], weeklyData: WeeklyData, asOf: Date): Date[] {
  const asOfKey = formatLocalDateKey(asOf)
  const seen = new Set<string>()
  const starts: Date[] = []
  for (const key of Object.keys(weeklyData || {})) {
    if (key > asOfKey) continue
    const date = parseLocalDate(key)
    if (!date) continue
    const start = getWeekStartDate(date)
    const id = formatLocalDateKey(start)
    if (seen.has(id)) continue
    if (id > asOfKey) continue
    if (!weekHasRecordedCompletion(tasks, weeklyData, start)) continue
    seen.add(id)
    starts.push(start)
  }
  return starts
}

function meanWeekRaw(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  starts: Date[],
  asOf: Date,
  isExempt?: HabitExemptFn,
): number {
  if (starts.length === 0) return 0
  let sum = 0
  for (const start of starts) sum += weekRawAverage(tasks, weeklyData, start, asOf, isExempt)
  return sum / starts.length
}

export function weekRawComparisons(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  asOf: Date,
  isExempt?: HabitExemptFn,
): WeekRawComparisons {
  const thisStart = getWeekStartDate(asOf)
  const thisWeek = weekRawAverage(tasks, weeklyData, thisStart, asOf, isExempt)
  const lastStart = new Date(thisStart.getFullYear(), thisStart.getMonth(), thisStart.getDate() - 7)
  const lastWeek = weekRawAverage(tasks, weeklyData, lastStart, asOf, isExempt)
  const year = asOf.getFullYear()
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`
  const starts = weekStartsWithData(tasks, weeklyData, asOf)
  const yearWeeks = starts.filter((start) => {
    const dates = getWeekDates(start)
    const monday = formatLocalDateKey(dates[0])
    const sunday = formatLocalDateKey(dates[6])
    return sunday >= yearStart && monday <= yearEnd
  })
  const thisYear = meanWeekRaw(tasks, weeklyData, yearWeeks, asOf, isExempt)
  const allTime = meanWeekRaw(tasks, weeklyData, starts, asOf, isExempt)
  return {
    thisWeek,
    lastWeek,
    thisYear,
    allTime,
    lastWeekVs: olderAverageComparedToToday(lastWeek, thisWeek),
    thisYearVs: olderAverageComparedToToday(thisYear, thisWeek),
    allTimeVs: olderAverageComparedToToday(allTime, thisWeek),
  }
}

export interface GoodDaySummary {
  threshold: number
  bonus: number
  streak: number
  longestStreak: number
  last30Count: number
  last30: GoodDayLookbackDay[]
  /** Good-day score for today (raw, or the priority blend when that is on). */
  todayRaw: number
  /** Unblended column completion for today — the same figure `rawDayCompletionPercent` returns. */
  todayCompletionRaw: number
  todayGood: boolean
  /** Mean raw completion of the 7 calendar days before today. */
  prior7Average: number
  /** Mean raw completion of the 30 calendar days before today. */
  prior30Average: number
  /** Prior-7 average compared with today's raw completion. */
  prior7VsToday: OlderAverageVsToday
  /** Prior-30 average compared with today's raw completion. */
  prior30VsToday: OlderAverageVsToday
  /** Raw completion for the calendar day before today. */
  yesterdayCompletionRaw: number
  yesterdayVsToday: OlderAverageVsToday
  weeks: WeekRawComparisons
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
  const todayCompletionRaw = rawDayCompletionPercent(tasks, weeklyData, asOf, isExempt)
  const yesterday = new Date(asOf.getFullYear(), asOf.getMonth(), asOf.getDate() - 1)
  const yesterdayCompletionRaw = rawDayCompletionPercent(tasks, weeklyData, yesterday, isExempt)
  const prior7Average = priorRawAverage(tasks, weeklyData, asOf, PRIOR_WEEK_DAYS, isExempt)
  const prior30Average = priorRawAverage(tasks, weeklyData, asOf, GOOD_DAYS_LOOKBACK, isExempt)
  const weeks = weekRawComparisons(tasks, weeklyData, asOf, isExempt)
  return {
    threshold: t,
    bonus: clampAccomplishmentBonus(bonus),
    streak: streak.current,
    longestStreak: streak.longest,
    last30Count: last30.filter((d) => d.good).length,
    last30,
    todayRaw: today?.raw ?? 0,
    todayCompletionRaw,
    todayGood: today?.good ?? false,
    prior7Average,
    prior30Average,
    prior7VsToday: olderAverageComparedToToday(prior7Average, todayCompletionRaw),
    prior30VsToday: olderAverageComparedToToday(prior30Average, todayCompletionRaw),
    yesterdayCompletionRaw,
    yesterdayVsToday: olderAverageComparedToToday(yesterdayCompletionRaw, todayCompletionRaw),
    weeks,
  }
}
