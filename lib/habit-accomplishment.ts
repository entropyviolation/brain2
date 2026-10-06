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
 * `monthRawAverage` and `seasonRawAverage` are that same mean for one civil
 * month and one calendar season. A good week, month, or season is that
 * average at or above the same accomplishment line — not the curved grade.
 * `pointsStillNeeded` is the whole-point gap from that line (round each
 * figure, then subtract), the same rounding as the comparison phrases.
 *
 * Week grade / Perfect output curves are independent — this module never reads
 * `gradeTolerance` or `outputGradeTolerance`.
 *
 * Spec: §9, §14.
 */
import { calculateDayPercentageAV, type HabitExemptFn } from "./calculations"
import {
  formatLocalDateKey,
  getMonthDates,
  getPrecedingMonthStarts,
  getPrecedingWeekStarts,
  getWeekDates,
  getWeekStartDate,
  parseLocalDate,
} from "./date-utils"
import { precedingQuarterStarts, quarterEndDate, quarterKey, quarterOf, quarterStartDate, seasonOfDate } from "./seasons"
import { computeStreak } from "./streaks"
import type { WeeklyData, WeeklyTask } from "./types"

export const DEFAULT_ACCOMPLISHMENT_THRESHOLD = 80
export const DEFAULT_ACCOMPLISHMENT_BONUS = 50
export const GOOD_DAYS_LOOKBACK = 30
/** Recent weeks shown beside the good-week streak. */
export const GOOD_WEEKS_LOOKBACK = 12
/** Recent months shown beside the good-month streak — one year. */
export const GOOD_MONTHS_LOOKBACK = 12
/** Recent seasons shown beside the good-season streak — one year. */
export const GOOD_SEASONS_LOOKBACK = 4
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

export type GoodPeriodNoun = "day" | "week" | "month" | "season"

export interface PointsStillNeeded {
  /** Whole points still short of the line. 0 when the rounded percent has met it. */
  needed: number
  met: boolean
}

/**
 * Whole-point gap between a raw percent and the accomplishment line.
 * Each figure is rounded first, the same way the comparison phrases are.
 * Does not change `isAccomplishedDay` (that stays an unrounded `>=`).
 */
export function pointsStillNeeded(rawPercent: number, threshold: number): PointsStillNeeded {
  const line = clampAccomplishmentThreshold(threshold)
  const current = Math.round(Number.isFinite(rawPercent) ? rawPercent : 0)
  const needed = Math.max(0, line - current)
  return { needed, met: needed === 0 }
}

/** "10 needed to be a good day", or "Met — a good day" when the rounded percent has cleared the line. */
export function pointsStillNeededPhrase(
  rawPercent: number,
  threshold: number,
  noun: GoodPeriodNoun = "day",
): string {
  const { needed, met } = pointsStillNeeded(rawPercent, threshold)
  if (met) return `Met — a good ${noun}`
  return `${needed} needed to be a good ${noun}`
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
 * Mean raw day completion across a span of calendar days.
 * In progress: days from the first through `asOf`, divided by how many of those days exist.
 * Finished (the last day is on or before `asOf`): every day in the span, empty ones as 0.
 */
function spanRawAverage(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  dates: Date[],
  asOf: Date,
  isExempt?: HabitExemptFn,
): number {
  if (dates.length === 0) return 0
  const asOfKey = formatLocalDateKey(asOf)
  if (formatLocalDateKey(dates[0]) > asOfKey) return 0
  const finished = formatLocalDateKey(dates[dates.length - 1]) <= asOfKey
  const included = finished ? dates : dates.filter((date) => formatLocalDateKey(date) <= asOfKey)
  if (included.length === 0) return 0
  let sum = 0
  for (const date of included) sum += rawDayCompletionPercent(tasks, weeklyData, date, isExempt)
  return sum / (finished ? dates.length : included.length)
}

/** Every local calendar date from `start` through `end`, inclusive. */
function localDatesThrough(start: Date, end: Date): Date[] {
  const dates: Date[] = []
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate())
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate()).getTime()
  while (cursor.getTime() <= last) {
    dates.push(new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()))
    cursor.setDate(cursor.getDate() + 1)
  }
  return dates
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
  return spanRawAverage(tasks, weeklyData, getWeekDates(getWeekStartDate(weekStart)), asOf, isExempt)
}

/**
 * Mean raw day completion for one civil month.
 * In progress: the 1st through `asOf`. Finished: every day of the month, empty ones as 0.
 */
export function monthRawAverage(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  month: Date,
  asOf: Date,
  isExempt?: HabitExemptFn,
): number {
  const start = new Date(month.getFullYear(), month.getMonth(), 1)
  return spanRawAverage(tasks, weeklyData, getMonthDates(start), asOf, isExempt)
}

/**
 * Mean raw day completion for one calendar season (Jan–Mar, Apr–Jun, Jul–Sep, Oct–Dec).
 * In progress: the season's first day through `asOf`. Finished: every day, empty ones as 0.
 */
export function seasonRawAverage(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  season: Date,
  asOf: Date,
  isExempt?: HabitExemptFn,
): number {
  const start = quarterStartDate(season)
  const end = quarterEndDate(quarterKey(start))
  if (!end) return 0
  return spanRawAverage(tasks, weeklyData, localDatesThrough(start, end), asOf, isExempt)
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

export type GoodPeriodUnit = "week" | "month" | "season"

export interface GoodPeriodReading {
  date: Date
  dateKey: string
  label: string
  raw: number
  good: boolean
}

export interface GoodPeriodSummary {
  unit: GoodPeriodUnit
  noun: "week" | "month" | "season"
  plural: "weeks" | "months" | "seasons"
  threshold: number
  bonus: number
  streak: number
  longestStreak: number
  /** Good periods inside the lookback, including the current one. */
  lookbackCount: number
  lookbackSize: number
  streakLabel: string
  countLabel: string
  lookback: GoodPeriodReading[]
  /** Raw daily-completion average of the current period. */
  currentRaw: number
  currentGood: boolean
  pointsNeeded: number
  pointsMet: boolean
  pointsPhrase: string
}

const PERIOD_LOOKBACK: Record<GoodPeriodUnit, number> = {
  week: GOOD_WEEKS_LOOKBACK,
  month: GOOD_MONTHS_LOOKBACK,
  season: GOOD_SEASONS_LOOKBACK,
}

const PERIOD_COPY: Record<
  GoodPeriodUnit,
  Pick<GoodPeriodSummary, "noun" | "plural" | "streakLabel" | "countLabel">
> = {
  week: {
    noun: "week",
    plural: "weeks",
    streakLabel: "Good week streak",
    countLabel: "Good weeks in the last 12",
  },
  month: {
    noun: "month",
    plural: "months",
    streakLabel: "Good month streak",
    countLabel: "Good months in the last year",
  },
  season: {
    noun: "season",
    plural: "seasons",
    streakLabel: "Good season streak",
    countLabel: "Good seasons in the last year",
  },
}

function periodAnchor(unit: GoodPeriodUnit, date: Date): Date {
  if (unit === "week") return getWeekStartDate(date)
  if (unit === "month") return new Date(date.getFullYear(), date.getMonth(), 1)
  return quarterStartDate(date)
}

function lookbackAnchors(unit: GoodPeriodUnit, asOf: Date, count: number): Date[] {
  if (unit === "week") return getPrecedingWeekStarts(getWeekStartDate(asOf), count)
  if (unit === "month") return getPrecedingMonthStarts(asOf, count)
  return precedingQuarterStarts(asOf, count)
}

function periodRaw(
  unit: GoodPeriodUnit,
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  anchor: Date,
  asOf: Date,
  isExempt?: HabitExemptFn,
): number {
  if (unit === "week") return weekRawAverage(tasks, weeklyData, anchor, asOf, isExempt)
  if (unit === "month") return monthRawAverage(tasks, weeklyData, anchor, asOf, isExempt)
  return seasonRawAverage(tasks, weeklyData, anchor, asOf, isExempt)
}

function periodLabel(unit: GoodPeriodUnit, anchor: Date): string {
  if (unit === "week") return anchor.toLocaleDateString("en-US", { month: "short", day: "numeric" })
  if (unit === "month") return anchor.toLocaleDateString("en-US", { month: "short", year: "numeric" })
  return `${seasonOfDate(anchor)} ${anchor.getFullYear()}`
}

function bucketHasTask(bucket: WeeklyData[string] | undefined, tasks: WeeklyTask[]): boolean {
  if (!bucket) return false
  for (const task of tasks) {
    if (bucket[task.id]) return true
  }
  return false
}

/** Period starts that hold at least one daily-habit cell on or before `asOf`. */
function anchorsWithData(
  unit: GoodPeriodUnit,
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  asOf: Date,
): Date[] {
  const asOfKey = formatLocalDateKey(asOf)
  const seen = new Set<string>()
  const anchors: Date[] = []
  for (const key of Object.keys(weeklyData || {})) {
    if (key > asOfKey) continue
    const date = parseLocalDate(key)
    if (!date || !bucketHasTask(weeklyData[key], tasks)) continue
    const anchor = periodAnchor(unit, date)
    const id = formatLocalDateKey(anchor)
    if (seen.has(id) || id > asOfKey) continue
    seen.add(id)
    anchors.push(anchor)
  }
  return anchors
}

/** Season index: Q4 then next Q1 are consecutive. Matches `computeStreak`'s one-period grace. */
function seasonIndex(date: Date): number {
  return date.getFullYear() * 4 + quarterOf(date) - 1
}

/**
 * Current run ends at `current`, or at `current - 1` when the current period is not in the set.
 * Same grace `computeStreak` gives today.
 */
function streakFromIndices(indices: number[], current: number): { current: number; longest: number } {
  const sorted = [...new Set(indices)].sort((a, b) => a - b)
  if (sorted.length === 0) return { current: 0, longest: 0 }
  let longest = 1
  let run = 1
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) run += 1
    else run = 1
    if (run > longest) longest = run
  }
  const present = new Set(sorted)
  let cursor: number
  if (present.has(current)) cursor = current
  else if (present.has(current - 1)) cursor = current - 1
  else return { current: 0, longest }
  let currentRun = 0
  while (present.has(cursor)) {
    currentRun += 1
    cursor -= 1
  }
  return { current: currentRun, longest }
}

/**
 * Good weeks, months, or seasons: one raw daily-completion average per period,
 * compared with the same accomplishment line as a Good day.
 * The streak is consecutive good periods ending at the current one, or at the
 * last finished one when the current period is not yet good.
 */
export function goodPeriodSummary(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
  asOf: Date,
  unit: GoodPeriodUnit,
  threshold: number,
  bonus: number = DEFAULT_ACCOMPLISHMENT_BONUS,
  isExempt?: HabitExemptFn,
): GoodPeriodSummary {
  const t = clampAccomplishmentThreshold(threshold)
  const copy = PERIOD_COPY[unit]
  const lookbackSize = PERIOD_LOOKBACK[unit]
  const cache = new Map<string, number>()
  const rawOf = (anchor: Date) => {
    const key = formatLocalDateKey(anchor)
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    const value = periodRaw(unit, tasks, weeklyData, anchor, asOf, isExempt)
    cache.set(key, value)
    return value
  }
  const reading = (anchor: Date): GoodPeriodReading => {
    const raw = rawOf(anchor)
    return {
      date: anchor,
      dateKey: formatLocalDateKey(anchor),
      label: periodLabel(unit, anchor),
      raw,
      good: isAccomplishedDay(raw, t),
    }
  }
  const lookback = lookbackAnchors(unit, asOf, lookbackSize).map(reading)
  const goodAnchors = anchorsWithData(unit, tasks, weeklyData, asOf).filter((anchor) => reading(anchor).good)
  const currentAnchor = periodAnchor(unit, asOf)
  let streakCurrent = 0
  let longest = 0
  if (unit === "season") {
    const run = streakFromIndices(
      goodAnchors.map((anchor) => seasonIndex(anchor)),
      seasonIndex(asOf),
    )
    streakCurrent = run.current
    longest = run.longest
  } else {
    const run = computeStreak(
      goodAnchors.map((anchor) => formatLocalDateKey(anchor)),
      { unit, today: asOf },
    )
    streakCurrent = run.current
    longest = run.longest
  }
  const currentRaw = rawOf(currentAnchor)
  const points = pointsStillNeeded(currentRaw, t)
  return {
    unit,
    noun: copy.noun,
    plural: copy.plural,
    threshold: t,
    bonus: clampAccomplishmentBonus(bonus),
    streak: streakCurrent,
    longestStreak: longest,
    lookbackCount: lookback.filter((row) => row.good).length,
    lookbackSize,
    streakLabel: copy.streakLabel,
    countLabel: copy.countLabel,
    lookback,
    currentRaw,
    currentGood: isAccomplishedDay(currentRaw, t),
    pointsNeeded: points.needed,
    pointsMet: points.met,
    pointsPhrase: pointsStillNeededPhrase(currentRaw, t, copy.noun),
  }
}
