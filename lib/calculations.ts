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
 *
 * Spec: §9 (Habit Tracker). Uses ISO-date-keyed `WeeklyData` (spec §9.4).
 */
import { type WeeklyTask as Task, TaskType, type WeeklyData } from "./types"
import { formatLocalDateKey, parseLocalDate } from "./date-utils"
import { incrementalDayPercentage, incrementalWeekPercentage } from "./incremental-habits"

export const calculateTaskPercentage = (
  taskId: string,
  tasks: Task[],
  weeklyData: WeeklyData,
  weekDates: Date[],
): number => {
  const task = tasks.find((t) => t.id === taskId)
  if (!task) return 0

  // Convert dates to string keys
  const dateKeys = weekDates.map((date) => formatLocalDateKey(date))

  switch (task.type) {
    case TaskType.BOOLEAN:
    case TaskType.TEXT: {
      // For boolean/text: % = (days completed / 7) * 100
      let daysCompleted = 0

      dateKeys.forEach((dateKey) => {
        const completion = weeklyData[dateKey]?.[taskId]
        if (task.type === TaskType.BOOLEAN && completion?.completed) {
          daysCompleted++
        } else if (task.type === TaskType.TEXT && completion?.text) {
          daysCompleted++
        }
      })

      return (daysCompleted / 7) * 100
    }

    case TaskType.GOAL:
    case TaskType.TIME:
    case TaskType.COUNT: {
      // For goal-based: % = (total completed / (goal * 7)) * 100, capped at 100%
      if (!task.goal) return 0

      let totalCompleted = 0
      const totalGoal = task.goal * 7

      dateKeys.forEach((dateKey) => {
        const completion = weeklyData[dateKey]?.[taskId]
        if (completion?.value !== undefined) {
          totalCompleted += completion.value
        }
      })

      const percentage = (totalCompleted / totalGoal) * 100
      return Math.min(100, percentage)
    }

    case TaskType.INCREMENTAL:
      return incrementalWeekPercentage(task, weeklyData, weekDates)

    default:
      return 0
  }
}

/** Same formulas as `calculateTaskPercentage`, but paced to elapsed days (not a full 7). */
export function calculateElapsedTaskPercentage(
  task: Task,
  weeklyData: WeeklyData,
  elapsedDates: Date[],
): number {
  if (elapsedDates.length === 0) return 0
  const n = elapsedDates.length
  const dateKeys = elapsedDates.map((date) => formatLocalDateKey(date))

  switch (task.type) {
    case TaskType.BOOLEAN:
    case TaskType.TEXT: {
      let daysCompleted = 0
      dateKeys.forEach((dateKey) => {
        const completion = weeklyData[dateKey]?.[task.id]
        if (task.type === TaskType.BOOLEAN && completion?.completed) daysCompleted++
        else if (task.type === TaskType.TEXT && completion?.text) daysCompleted++
      })
      return (daysCompleted / n) * 100
    }
    case TaskType.GOAL:
    case TaskType.TIME:
    case TaskType.COUNT: {
      if (!task.goal) return 0
      let totalCompleted = 0
      dateKeys.forEach((dateKey) => {
        const completion = weeklyData[dateKey]?.[task.id]
        if (completion?.value !== undefined) totalCompleted += completion.value
      })
      return Math.min(100, (totalCompleted / (task.goal * n)) * 100)
    }
    case TaskType.INCREMENTAL:
      return incrementalWeekPercentage(task, weeklyData, elapsedDates)
    default:
      return 0
  }
}

export const calculateDayPercentage = (
  dateKey: string,
  tasks: Task[],
  weeklyData: WeeklyData,
  dayIndex: number,
): number => {
  if (!weeklyData[dateKey]) {
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
): number => {
  const numTasks = tasks.length

  if (!weeklyData[dateKey]) {
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
}

export interface WeekGradeResult {
  grade: number
  rawGrade: number
  daysIncluded: number
  days: WeekGradeDay[]
  tolerance: number
  curveBonus: number
}

export function calculateWeekToDateGrade(
  tasks: Task[],
  weeklyData: WeeklyData,
  weekDates: Date[],
  asOf: Date,
  tolerance: number = DEFAULT_GRADE_TOLERANCE,
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
    const raw = calculateDayPercentageAV(dateKey, tasks, weeklyData, index)
    return { date, dateKey, raw, curved: curveDayPercentage(raw, t) }
  })

  const n = days.length
  const rawSum = days.reduce((acc, d) => acc + d.raw, 0)
  const curvedSum = days.reduce((acc, d) => acc + d.curved, 0)
  return {
    grade: curvedSum / n,
    rawGrade: rawSum / n,
    daysIncluded: n,
    days,
    tolerance: t,
    curveBonus,
  }
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
 * Perfect Output: mean of each daily habit's week-to-date row % (paced to
 * elapsed days). Same daily curve as Week grade, with its own tolerance.
 */
export function calculateWeekToDateOutputGrade(
  tasks: Task[],
  weeklyData: WeeklyData,
  weekDates: Date[],
  asOf: Date,
  tolerance: number = DEFAULT_GRADE_TOLERANCE,
): OutputGradeResult {
  const t = clampGradeTolerance(tolerance)
  const curveBonus = 100 - t
  const elapsed = weekToDateDays(weekDates, asOf)
  if (elapsed.length === 0 || tasks.length === 0) {
    return { grade: 0, rawGrade: 0, daysIncluded: elapsed.length, habits: [], tolerance: t, curveBonus }
  }

  const habits: OutputGradeHabit[] = tasks.map((task) => {
    const raw = calculateElapsedTaskPercentage(task, weeklyData, elapsed)
    return { taskId: task.id, name: task.name, raw, curved: curveDayPercentage(raw, t) }
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
