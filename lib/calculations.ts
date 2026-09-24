/**
 * lib/calculations.ts — Habit completion math (pure)
 *
 * Pure functions that compute habit-tracker percentages for all five habit types
 * (boolean/goal/text/climb; TIME/COUNT treated as GOAL):
 *  - `calculateTaskPercentage`: a habit's completion % across the week
 *    (climb uses `incrementalWeekPercentage`; denominator is always 7).
 *  - `calculateElapsedTaskPercentage`: same row formulas paced to elapsed days.
 *  - `calculateDayPercentage` / `calculateDayPercentageAV`: a day's overall %
 *    (the AV variant averages over all habits, not just those with data).
 *    Climb uses `incrementalDayPercentage`.
 *  - `calculateWeekToDateGrade`: mean of elapsed days' AV % (Mon → as-of date),
 *    optional daily curve via `tolerance` (`curveDayPercentage`; 0% stays 0).
 *  - `calculateWeekToDateOutputGrade`: mean of elapsed-paced row % per habit
 *    (Perfect Output), same curve, separate tolerance.
 *  - Period (weekly/monthly) analogs: `calculatePeriodTaskPercentage`,
 *    `calculatePeriodColumnPercentage`, `calculatePeriodGrade`,
 *    `calculatePeriodOutputGrade` — same formulas over week/month keys.
 *
 * Optional `isExempt` lifts a period out of both sides of the fraction
 * (`lib/habit-exemption.ts`). Omit it and every denominator stays the full
 * window, exactly as before the exemption wand.
 *
 * Spec: §9 (Habit Tracker). Uses ISO-date-keyed `WeeklyData` (spec §9.4).
 */
import { type WeeklyTask as Task, TaskType, type TaskCompletion, type WeeklyData } from "./types"
import { addCalendarDays, formatLocalDateKey, parseLocalDate } from "./date-utils"
import {
  incrementalDataForTask,
  incrementalDayPercentage,
  incrementalLoggedValue,
  incrementalWeekPercentage,
  weeklyGoalOn,
} from "./incremental-habits"

/** `true` when that period is waived for the habit and must leave the fraction. */
export type HabitExemptFn = (task: Task, periodKey: string) => boolean

/**
 * As-of date for week / span grades on the visible Habits window.
 *
 * Home's calendar date (Plan / Day View) is used when it falls inside the
 * window. When it falls outside — e.g. Plan jumped to last month while Habits
 * still shows this week — fall back to today (current window), the window end
 * (past), or just before the start (future → zero elapsed days). Otherwise
 * `weekToDateDays` returns [] and the tubes stay on "—".
 */
export function gradeAsOfForVisibleWindow(
  windowStart: Date,
  windowEnd: Date,
  homeDate: Date,
  today: Date = new Date(),
): Date {
  const homeKey = formatLocalDateKey(homeDate)
  const startKey = formatLocalDateKey(windowStart)
  const endKey = formatLocalDateKey(windowEnd)
  if (homeKey >= startKey && homeKey <= endKey) return homeDate
  const todayKey = formatLocalDateKey(today)
  if (endKey < todayKey) return windowEnd
  if (startKey > todayKey) return addCalendarDays(windowStart, -1)
  return today
}

function activeDates(task: Task, dates: Date[], isExempt?: HabitExemptFn): Date[] {
  if (!isExempt) return dates
  return dates.filter((date) => !isExempt(task, formatLocalDateKey(date)))
}

/** Climb % over a window that has already dropped exempt days. */
function incrementalOverActiveDates(task: Task, weeklyData: WeeklyData, dates: Date[]): number {
  const data = incrementalDataForTask(task)
  if (!data || dates.length === 0) return 0
  if (data.cadence === "weekly") {
    const goal = weeklyGoalOn(task, weeklyData, dates[0])
    if (goal <= 0) return 0
    let total = 0
    for (const date of dates) {
      const value = incrementalLoggedValue(weeklyData[formatLocalDateKey(date)]?.[task.id])
      if (value !== undefined) total += value
    }
    return Math.min(100, (total / (goal * dates.length)) * 100)
  }
  let sum = 0
  for (const date of dates) {
    const pct = incrementalDayPercentage(task, weeklyData[formatLocalDateKey(date)]?.[task.id], weeklyData, date)
    sum += pct ?? 0
  }
  return sum / dates.length
}

function percentageOverDates(
  task: Task,
  weeklyData: WeeklyData,
  dates: Date[],
  isExempt?: HabitExemptFn,
): number {
  const active = activeDates(task, dates, isExempt)
  const n = active.length
  if (n === 0) return 0
  const dropped = !!isExempt && n !== dates.length

  switch (task.type) {
    case TaskType.BOOLEAN:
    case TaskType.TEXT: {
      let daysCompleted = 0
      for (const date of active) {
        const completion = weeklyData[formatLocalDateKey(date)]?.[task.id]
        if (task.type === TaskType.BOOLEAN && completion?.completed) daysCompleted++
        else if (task.type === TaskType.TEXT && completion?.text) daysCompleted++
      }
      return (daysCompleted / n) * 100
    }
    case TaskType.GOAL:
    case TaskType.TIME:
    case TaskType.COUNT: {
      if (!task.goal) return 0
      let totalCompleted = 0
      for (const date of active) {
        const completion = weeklyData[formatLocalDateKey(date)]?.[task.id]
        if (completion?.value !== undefined) totalCompleted += completion.value
      }
      return Math.min(100, (totalCompleted / (task.goal * n)) * 100)
    }
    case TaskType.INCREMENTAL:
      return dropped
        ? incrementalOverActiveDates(task, weeklyData, active)
        : incrementalWeekPercentage(task, weeklyData, active)
    default:
      return 0
  }
}

export const calculateTaskPercentage = (
  taskId: string,
  tasks: Task[],
  weeklyData: WeeklyData,
  weekDates: Date[],
  isExempt?: HabitExemptFn,
): number => {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return 0
  return percentageOverDates(task, weeklyData, weekDates, isExempt)
}

/** Same formulas as `calculateTaskPercentage`, but paced to elapsed days (not a full 7). */
export function calculateElapsedTaskPercentage(
  task: Task,
  weeklyData: WeeklyData,
  elapsedDates: Date[],
  isExempt?: HabitExemptFn,
): number {
  if (elapsedDates.length === 0) return 0
  return percentageOverDates(task, weeklyData, elapsedDates, isExempt)
}

function activeTasks(tasks: Task[], periodKey: string, isExempt?: HabitExemptFn): Task[] {
  if (!isExempt) return tasks
  return tasks.filter((task) => !isExempt(task, periodKey))
}

export const calculateDayPercentage = (
  dateKey: string,
  tasks: Task[],
  weeklyData: WeeklyData,
  dayIndex: number,
  isExempt?: HabitExemptFn,
): number => {
  tasks = activeTasks(tasks, dateKey, isExempt)
  if (tasks.length === 0 || !weeklyData[dateKey]) {
    return 0
  }

  let totalTaskPercentage = 0
  let tasksWithData = 0

  tasks.forEach((task) => {
    const completion = weeklyData[dateKey]?.[task.id]
    if (!completion) {
      return
    }

    let taskPercentage = 0

    switch (task.type) {
      case TaskType.BOOLEAN:
        if (completion.completed) {
          taskPercentage = 100
          tasksWithData++
        }
        break

      case TaskType.GOAL:
      case TaskType.TIME:
      case TaskType.COUNT:
        if (completion.value !== undefined && task.goal) {
          taskPercentage = Math.min(100, (completion.value / task.goal) * 100)
          tasksWithData++
        }
        break

      case TaskType.TEXT:
        if (completion.text) {
          taskPercentage = 100
          tasksWithData++
        }
        break

      case TaskType.INCREMENTAL: {
        const date = parseLocalDate(dateKey) ?? new Date()
        const pct = incrementalDayPercentage(task, completion, weeklyData, date)
        if (pct !== null) {
          taskPercentage = pct
          tasksWithData++
        }
        break
      }
    }

    totalTaskPercentage += taskPercentage
  })

  const finalPercentage = tasksWithData > 0 ? totalTaskPercentage / tasksWithData : 0
  return finalPercentage
}

export const calculateDayPercentageAV = (
  dateKey: string,
  tasks: Task[],
  weeklyData: WeeklyData,
  dayIndex: number,
  isExempt?: HabitExemptFn,
): number => {
  tasks = activeTasks(tasks, dateKey, isExempt)
  const numTasks = tasks.length

  if (numTasks === 0 || !weeklyData[dateKey]) {
    return 0
  }

  let totalTaskPercentage = 0
  let tasksWithData = 0

  tasks.forEach((task) => {
    const completion = weeklyData[dateKey]?.[task.id]
    if (!completion) {
      return
    }

    let taskPercentage = 0

    switch (task.type) {
      case TaskType.BOOLEAN:
        if (completion.completed) {
          taskPercentage = 100
          tasksWithData++
        }
        break

      case TaskType.GOAL:
      case TaskType.TIME:
      case TaskType.COUNT:
        if (completion.value !== undefined && task.goal) {
          taskPercentage = Math.min(100, (completion.value / task.goal) * 100)
          tasksWithData++
        }
        break

      case TaskType.TEXT:
        if (completion.text) {
          taskPercentage = 100
          tasksWithData++
        }
        break

      case TaskType.INCREMENTAL: {
        const date = parseLocalDate(dateKey) ?? new Date()
        const pct = incrementalDayPercentage(task, completion, weeklyData, date)
        if (pct !== null) {
          taskPercentage = pct
          tasksWithData++
        }
        break
      }
    }

    totalTaskPercentage += taskPercentage
  })

  const finalPercentage = tasksWithData > 0 ? totalTaskPercentage / numTasks : 0
  return finalPercentage
}

/** Days of `weekDates` that have started as of `asOf` (inclusive, local dates). */
export function weekToDateDays(weekDates: Date[], asOf: Date): Date[] {
  const asOfKey = formatLocalDateKey(asOf)
  return weekDates.filter((date) => formatLocalDateKey(date) <= asOfKey)
}

/**
 * Running week grade: mean of each elapsed day's overall habit %.
 * Optional `tolerance`: raw day % that counts as 100 after a daily curve
 * (`curved = raw + (100 − tolerance)`). Default 100 = no curve.
 */
export const DEFAULT_GRADE_TOLERANCE = 100

export function clampGradeTolerance(tolerance: number): number {
  if (!Number.isFinite(tolerance)) return DEFAULT_GRADE_TOLERANCE
  return Math.min(100, Math.max(1, Math.round(tolerance)))
}

/** Day score after the curve: 80% tolerance → +20, so 70 raw → 90. Zero stays zero. */
export function curveDayPercentage(raw: number, tolerance: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return raw + (100 - clampGradeTolerance(tolerance))
}

export interface WeekGradeDay {
  date: Date
  dateKey: string
  raw: number
  curved: number
  /** Every habit was exempt. Left out of the average; the day was not required. */
  vacant?: boolean
}

export interface WeekGradeResult {
  grade: number
  rawGrade: number
  daysIncluded: number
  days: WeekGradeDay[]
  tolerance: number
  curveBonus: number
}

function averageOpenDays(days: WeekGradeDay[]): { grade: number; rawGrade: number; daysIncluded: number } {
  const open = days.filter((day) => !day.vacant)
  if (open.length === 0) return { grade: 0, rawGrade: 0, daysIncluded: 0 }
  const rawSum = open.reduce((acc, day) => acc + day.raw, 0)
  const curvedSum = open.reduce((acc, day) => acc + day.curved, 0)
  return {
    grade: curvedSum / open.length,
    rawGrade: rawSum / open.length,
    daysIncluded: days.length,
  }
}

export function calculateWeekToDateGrade(
  tasks: Task[],
  weeklyData: WeeklyData,
  weekDates: Date[],
  asOf: Date,
  tolerance: number = DEFAULT_GRADE_TOLERANCE,
  isExempt?: HabitExemptFn,
): WeekGradeResult {
  const t = clampGradeTolerance(tolerance)
  const curveBonus = 100 - t
  const included = weekToDateDays(weekDates, asOf)
  if (included.length === 0) {
    return { grade: 0, rawGrade: 0, daysIncluded: 0, days: [], tolerance: t, curveBonus }
  }

  const days: WeekGradeDay[] = included.map((date) => {
    const index = weekDates.findIndex((d) => formatLocalDateKey(d) === formatLocalDateKey(date))
    const dateKey = formatLocalDateKey(date)
    const vacant = !!isExempt && tasks.length > 0 && tasks.every((task) => isExempt(task, dateKey))
    if (vacant) return { date, dateKey, raw: 0, curved: 0, vacant: true }
    const raw = calculateDayPercentageAV(dateKey, tasks, weeklyData, index, isExempt)
    return { date, dateKey, raw, curved: curveDayPercentage(raw, t) }
  })

  return { ...averageOpenDays(days), days, tolerance: t, curveBonus }
}

export interface OutputGradeHabit {
  taskId: string
  name: string
  raw: number
  curved: number
}

export interface OutputGradeResult {
  grade: number
  rawGrade: number
  daysIncluded: number
  habits: OutputGradeHabit[]
  tolerance: number
  curveBonus: number
}

/**
 * One column in a weekly/monthly habit grid: a store key plus the period's
 * start date (Monday, or the 1st of the month).
 */
export interface HabitPeriod {
  key: string
  date: Date
}

/** Periods whose start is on or before `asOf` (the week/month has begun). */
export function elapsedHabitPeriods(periods: HabitPeriod[], asOf: Date): HabitPeriod[] {
  const asOfKey = formatLocalDateKey(asOf)
  return periods.filter((period) => formatLocalDateKey(period.date) <= asOfKey)
}

function periodCellPercentage(
  task: Task,
  completion: TaskCompletion | undefined,
  period: HabitPeriod,
  data: WeeklyData,
): number | null {
  if (!completion) return null
  switch (task.type) {
    case TaskType.BOOLEAN:
      return completion.completed ? 100 : 0
    case TaskType.TEXT:
      return completion.text ? 100 : 0
    case TaskType.GOAL:
    case TaskType.TIME:
    case TaskType.COUNT:
      if (completion.value === undefined || !task.goal) return null
      return Math.min(100, (completion.value / task.goal) * 100)
    case TaskType.INCREMENTAL: {
      const pct = incrementalDayPercentage(task, completion, data, period.date)
      return pct
    }
    default:
      return null
  }
}

function activePeriods(task: Task, periods: HabitPeriod[], isExempt?: HabitExemptFn): HabitPeriod[] {
  if (!isExempt) return periods
  return periods.filter((period) => !isExempt(task, period.key))
}

/** A habit's % across a window of weeks or months (denominator is the required periods). */
export function calculatePeriodTaskPercentage(
  taskId: string,
  tasks: Task[],
  data: WeeklyData,
  periods: HabitPeriod[],
  isExempt?: HabitExemptFn,
): number {
  const task = tasks.find((t) => t.id === taskId)
  if (!task || periods.length === 0) return 0
  const required = activePeriods(task, periods, isExempt)
  const n = required.length
  if (n === 0) return 0

  switch (task.type) {
    case TaskType.BOOLEAN:
    case TaskType.TEXT: {
      let hits = 0
      for (const period of required) {
        const completion = data[period.key]?.[taskId]
        if (task.type === TaskType.BOOLEAN && completion?.completed) hits++
        else if (task.type === TaskType.TEXT && completion?.text) hits++
      }
      return (hits / n) * 100
    }
    case TaskType.GOAL:
    case TaskType.TIME:
    case TaskType.COUNT: {
      if (!task.goal) return 0
      let total = 0
      for (const period of required) {
        const completion = data[period.key]?.[taskId]
        if (completion?.value !== undefined) total += completion.value
      }
      return Math.min(100, (total / (task.goal * n)) * 100)
    }
    case TaskType.INCREMENTAL: {
      let total = 0
      for (const period of required) {
        const pct = incrementalDayPercentage(task, data[period.key]?.[taskId], data, period.date)
        total += pct ?? 0
      }
      return total / n
    }
    default:
      return 0
  }
}

/** Same row formulas as `calculatePeriodTaskPercentage`, paced to elapsed periods. */
export function calculateElapsedPeriodTaskPercentage(
  task: Task,
  data: WeeklyData,
  periods: HabitPeriod[],
): number {
  if (periods.length === 0) return 0
  return calculatePeriodTaskPercentage(task.id, [task], data, periods)
}

/**
 * A period column's overall % — same AV rule as `calculateDayPercentageAV`:
 * scored cells over *all* habits, so an empty habit still pulls the column down.
 */
export function calculatePeriodColumnPercentage(
  period: HabitPeriod,
  tasks: Task[],
  data: WeeklyData,
  isExempt?: HabitExemptFn,
): number {
  tasks = activeTasks(tasks, period.key, isExempt)
  const numTasks = tasks.length
  if (numTasks === 0 || !data[period.key]) return 0

  let total = 0
  let scored = 0
  for (const task of tasks) {
    const pct = periodCellPercentage(task, data[period.key]?.[task.id], period, data)
    if (pct === null) continue
    total += pct
    scored++
  }
  return scored > 0 ? total / numTasks : 0
}

/** Mean of elapsed period-column AV % (weekly/monthly analog of Week grade). */
export function calculatePeriodGrade(
  tasks: Task[],
  data: WeeklyData,
  periods: HabitPeriod[],
  asOf: Date,
  tolerance: number = DEFAULT_GRADE_TOLERANCE,
  isExempt?: HabitExemptFn,
): WeekGradeResult {
  const t = clampGradeTolerance(tolerance)
  const curveBonus = 100 - t
  const included = elapsedHabitPeriods(periods, asOf)
  if (included.length === 0) {
    return { grade: 0, rawGrade: 0, daysIncluded: 0, days: [], tolerance: t, curveBonus }
  }

  const days: WeekGradeDay[] = included.map((period) => {
    const vacant = !!isExempt && tasks.length > 0 && tasks.every((task) => isExempt(task, period.key))
    if (vacant) return { date: period.date, dateKey: period.key, raw: 0, curved: 0, vacant: true }
    const raw = calculatePeriodColumnPercentage(period, tasks, data, isExempt)
    return { date: period.date, dateKey: period.key, raw, curved: curveDayPercentage(raw, t) }
  })

  return { ...averageOpenDays(days), days, tolerance: t, curveBonus }
}

/** Mean of each habit's elapsed row % across a weekly/monthly window (Perfect output). */
export function calculatePeriodOutputGrade(
  tasks: Task[],
  data: WeeklyData,
  periods: HabitPeriod[],
  asOf: Date,
  tolerance: number = DEFAULT_GRADE_TOLERANCE,
  isExempt?: HabitExemptFn,
): OutputGradeResult {
  const t = clampGradeTolerance(tolerance)
  const curveBonus = 100 - t
  const elapsed = elapsedHabitPeriods(periods, asOf)
  if (elapsed.length === 0 || tasks.length === 0) {
    return { grade: 0, rawGrade: 0, daysIncluded: elapsed.length, habits: [], tolerance: t, curveBonus }
  }

  const habits: OutputGradeHabit[] = tasks.flatMap((task) => {
    if (isExempt && activePeriods(task, elapsed, isExempt).length === 0) return []
    const raw = calculateElapsedPeriodTaskPercentage(task, data, activePeriods(task, elapsed, isExempt))
    return [{ taskId: task.id, name: task.name, raw, curved: curveDayPercentage(raw, t) }]
  })

  const n = habits.length
  const rawSum = habits.reduce((acc, h) => acc + h.raw, 0)
  const curvedSum = habits.reduce((acc, h) => acc + h.curved, 0)
  return {
    grade: curvedSum / n,
    rawGrade: rawSum / n,
    daysIncluded: elapsed.length,
    habits,
    tolerance: t,
    curveBonus,
  }
}

/**
 * Perfect Output: mean of each daily habit's week-to-date row % (paced to
 * elapsed days). Same daily curve as Week grade, with its own tolerance.
 */
export function calculateWeekToDateOutputGrade(
  tasks: Task[],
  weeklyData: WeeklyData,
  weekDates: Date[],
  asOf: Date,
  tolerance: number = DEFAULT_GRADE_TOLERANCE,
  isExempt?: HabitExemptFn,
): OutputGradeResult {
  const t = clampGradeTolerance(tolerance)
  const curveBonus = 100 - t
  const elapsed = weekToDateDays(weekDates, asOf)
  if (elapsed.length === 0 || tasks.length === 0) {
    return { grade: 0, rawGrade: 0, daysIncluded: elapsed.length, habits: [], tolerance: t, curveBonus }
  }

  const habits: OutputGradeHabit[] = tasks.flatMap((task) => {
    if (isExempt && activeDates(task, elapsed, isExempt).length === 0) return []
    const raw = calculateElapsedTaskPercentage(task, weeklyData, elapsed, isExempt)
    return [{ taskId: task.id, name: task.name, raw, curved: curveDayPercentage(raw, t) }]
  })

  const n = habits.length
  const rawSum = habits.reduce((acc, h) => acc + h.raw, 0)
  const curvedSum = habits.reduce((acc, h) => acc + h.curved, 0)
  return {
    grade: curvedSum / n,
    rawGrade: rawSum / n,
    daysIncluded: elapsed.length,
    habits,
    tolerance: t,
    curveBonus,
  }
}
