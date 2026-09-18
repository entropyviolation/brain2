/**
 * lib/incremental-habits.ts — Daily vs weekly climb (incremental) habits
 *
 * Two cadences, one habit type:
 *
 * Weekly (meditation): shown like a goal habit. The day's target is fixed for
 * the whole week (startValue, then +increment on Monday only if the previous
 * week had at least `WEEKLY_INCREMENT_MIN_DAYS` days at/above that week's
 * target). How far over the target a day went does not matter.
 *
 * Daily (chess rating): the user logs their current score. That log becomes the
 * committed score for the next day, even if it is a drop. The day's target is
 * last logged score + increment. A skipped day (no log) keeps the previous
 * committed score. Week % is (gain during the week) / (increment × 7).
 *
 * Completions persist as `TaskCompletion.value` (same as GOAL). Legacy
 * `incrementalValues` maps are still read.
 */
import {
  type IncrementalHabitData,
  type IncrementalHabitLegacy,
  type IncrementalHabitPersisted,
  type TaskCompletion,
  type WeeklyData,
  type WeeklyTask,
  TaskType,
} from "./types"
import { formatLocalDateKey, getWeekDates, getWeekStartDate, parseLocalDate } from "./date-utils"

export const WEEKLY_INCREMENT_MIN_DAYS = 4

export function addLocalDays(date: Date, days: number): Date {
  const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
  next.setHours(0, 0, 0, 0)
  return next
}

/** Pull the numeric log from a completion (new `value` or legacy per-key map). */
export function incrementalLoggedValue(completion: TaskCompletion | undefined): number | undefined {
  if (!completion) return undefined
  if (typeof completion.value === "number" && !Number.isNaN(completion.value)) return completion.value
  const legacy = completion.incrementalValues
  if (!legacy) return undefined
  const first = Object.values(legacy)[0]
  return typeof first === "number" && !Number.isNaN(first) ? first : undefined
}

function isNewShape(raw: IncrementalHabitPersisted): raw is IncrementalHabitData {
  return typeof (raw as IncrementalHabitData).cadence === "string"
}

function guessCadence(key: string, increment: number): IncrementalHabitData["cadence"] {
  if (increment <= 1) return "weekly"
  if (/meditat|minute/i.test(key)) return "weekly"
  return "daily"
}

/** Normalize persisted incremental config (new shape or legacy multi-key maps). */
export function normalizeIncrementalData(
  raw: IncrementalHabitPersisted | undefined,
): IncrementalHabitData | undefined {
  if (!raw) return undefined
  if (isNewShape(raw)) {
    return {
      cadence: raw.cadence === "daily" ? "daily" : "weekly",
      startValue: Number(raw.startValue) || 0,
      increment: Number(raw.increment) || 0,
      unit: raw.unit,
      startedOn: raw.startedOn,
    }
  }
  const currentValues = raw.currentValues || {}
  const weeklyIncrement = raw.weeklyIncrement || {}
  const keys = Object.keys(currentValues)
  if (keys.length === 0) return undefined
  const key = keys[0]
  const startValue = Number(currentValues[key]) || 0
  const increment = Number(weeklyIncrement[key]) || 0
  return {
    cadence: guessCadence(key, increment),
    startValue,
    increment,
    unit: key === "meditation" ? "minutes" : key,
  }
}

export function incrementalDataForTask(task: WeeklyTask): IncrementalHabitData | undefined {
  if (task.type !== TaskType.INCREMENTAL) return undefined
  return normalizeIncrementalData(task.incrementalData)
}

function startedWeekMonday(task: WeeklyTask, weeklyData: WeeklyData, asOf: Date): Date {
  const data = incrementalDataForTask(task)
  if (data?.startedOn) {
    const parsed = parseLocalDate(data.startedOn)
    if (parsed) return getWeekStartDate(parsed)
  }
  const keys = Object.keys(weeklyData)
    .filter((key) => incrementalLoggedValue(weeklyData[key]?.[task.id]) !== undefined)
    .sort()
  if (keys[0]) {
    const parsed = parseLocalDate(keys[0])
    if (parsed) return getWeekStartDate(parsed)
  }
  return getWeekStartDate(asOf)
}

/** Target in force on `date` for a weekly-cadence climb habit. */
export function weeklyGoalOn(task: WeeklyTask, weeklyData: WeeklyData, date: Date): number {
  const data = incrementalDataForTask(task)
  if (!data) return 0
  let goal = data.startValue
  const targetMonday = getWeekStartDate(date)
  let week = startedWeekMonday(task, weeklyData, date)
  while (week < targetMonday) {
    if (countWeeklyHits(task, weeklyData, week, goal) >= WEEKLY_INCREMENT_MIN_DAYS) {
      goal += data.increment
    }
    week = addLocalDays(week, 7)
  }
  return goal
}

export function countWeeklyHits(task: WeeklyTask, weeklyData: WeeklyData, weekStart: Date, goal: number): number {
  return getWeekDates(weekStart).reduce((count, day) => {
    const value = incrementalLoggedValue(weeklyData[formatLocalDateKey(day)]?.[task.id])
    return value !== undefined && value >= goal ? count + 1 : count
  }, 0)
}

/**
 * Last logged score before `date` (exclusive). Any log, including a drop,
 * becomes the new committed value. Days with no log are skipped.
 */
export function dailyCommittedBefore(task: WeeklyTask, weeklyData: WeeklyData, date: Date): number {
  const data = incrementalDataForTask(task)
  if (!data) return 0
  const dateKey = formatLocalDateKey(date)
  let committed = data.startValue
  for (const key of Object.keys(weeklyData).sort()) {
    if (key >= dateKey) break
    const value = incrementalLoggedValue(weeklyData[key]?.[task.id])
    if (value !== undefined) committed = value
  }
  return committed
}

export function dailyGoalOn(task: WeeklyTask, weeklyData: WeeklyData, date: Date): number {
  const data = incrementalDataForTask(task)
  if (!data) return 0
  return dailyCommittedBefore(task, weeklyData, date) + data.increment
}

/** Display / completion target for `date`. */
export function incrementalGoalOn(task: WeeklyTask, weeklyData: WeeklyData, date: Date): number {
  const data = incrementalDataForTask(task)
  if (!data) return 0
  return data.cadence === "daily" ? dailyGoalOn(task, weeklyData, date) : weeklyGoalOn(task, weeklyData, date)
}

export function isIncrementalCompleteOn(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  weeklyData: WeeklyData,
  date: Date,
): boolean {
  const data = incrementalDataForTask(task)
  if (!data) return false
  const value = incrementalLoggedValue(completion)
  if (value === undefined) return false
  if (data.cadence === "weekly") return value >= weeklyGoalOn(task, weeklyData, date)
  const committed = dailyCommittedBefore(task, weeklyData, date)
  return value >= committed + data.increment
}

export function incrementalDayPercentage(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  weeklyData: WeeklyData,
  date: Date,
): number | null {
  const data = incrementalDataForTask(task)
  if (!data) return null
  const value = incrementalLoggedValue(completion)
  if (value === undefined) return null
  if (data.cadence === "weekly") {
    const goal = weeklyGoalOn(task, weeklyData, date)
    if (goal <= 0) return value > 0 ? 100 : 0
    return Math.min(100, (value / goal) * 100)
  }
  const committed = dailyCommittedBefore(task, weeklyData, date)
  if (value <= committed) return 0
  if (data.increment <= 0) return 100
  return Math.min(100, ((value - committed) / data.increment) * 100)
}

export function incrementalWeekPercentage(task: WeeklyTask, weeklyData: WeeklyData, weekDates: Date[]): number {
  const data = incrementalDataForTask(task)
  if (!data || weekDates.length === 0) return 0
  if (data.cadence === "weekly") {
    const goal = weeklyGoalOn(task, weeklyData, weekDates[0])
    if (goal <= 0) return 0
    let total = 0
    for (const day of weekDates) {
      const value = incrementalLoggedValue(weeklyData[formatLocalDateKey(day)]?.[task.id])
      if (value !== undefined) total += value
    }
    return Math.min(100, (total / (goal * weekDates.length)) * 100)
  }
  const monday = getWeekStartDate(weekDates[0])
  const nextMonday = addLocalDays(monday, 7)
  const start = dailyCommittedBefore(task, weeklyData, monday)
  const end = dailyCommittedBefore(task, weeklyData, nextMonday)
  const ideal = data.increment * weekDates.length
  if (ideal <= 0) return 0
  return Math.min(100, (Math.max(0, end - start) / ideal) * 100)
}

export function completionValueFromInput(raw: string): number | undefined {
  const trimmed = raw.trim()
  if (trimmed === "") return undefined
  const num = Number.parseFloat(trimmed)
  return Number.isNaN(num) ? undefined : num
}

/** Persist a climb log the same way GOAL habits persist (`value`). */
export function incrementalCompletionPayload(value: number | undefined): TaskCompletion {
  return value === undefined ? { value: undefined, incrementalValues: undefined } : { value }
}

type LegacyIncremental = IncrementalHabitLegacy

function extraLegacyKeys(raw: IncrementalHabitPersisted | undefined): string[] {
  if (!raw || isNewShape(raw)) return []
  return Object.keys((raw as LegacyIncremental).currentValues || {}).slice(1)
}

export function migrateIncrementalTask(task: WeeklyTask): WeeklyTask {
  if (task.type !== TaskType.INCREMENTAL) return task
  const normalized = normalizeIncrementalData(task.incrementalData)
  if (!normalized) return task
  return {
    ...task,
    unit: task.unit || normalized.unit,
    incrementalData: normalized,
  }
}

/**
 * Expand a legacy multi-metric climb (e.g. chess match + puzzle) into one habit
 * per metric, and rewrite `value` onto completions.
 */
export function migrateIncrementalHabits(
  tasks: WeeklyTask[],
  weeklyData: WeeklyData,
): { tasks: WeeklyTask[]; weeklyData: WeeklyData } {
  const nextTasks: WeeklyTask[] = []
  const nextData: WeeklyData = {}

  for (const key of Object.keys(weeklyData)) {
    nextData[key] = { ...weeklyData[key] }
  }

  for (const task of tasks) {
    if (task.type !== TaskType.INCREMENTAL) {
      nextTasks.push(task)
      continue
    }
    const extras = extraLegacyKeys(task.incrementalData)
    const primary = migrateIncrementalTask(task)
    nextTasks.push(primary)

    const raw = !task.incrementalData || isNewShape(task.incrementalData) ? undefined : task.incrementalData
    const currentValues = raw?.currentValues || {}
    const weeklyIncrement = raw?.weeklyIncrement || {}
    const primaryKey = Object.keys(currentValues)[0]

    for (const metricKey of extras) {
      const childId = `${task.id}-${metricKey}`
      nextTasks.push({
        ...task,
        id: childId,
        name: `${task.name} (${metricKey})`,
        unit: metricKey,
        incrementalData: {
          cadence: guessCadence(metricKey, Number(weeklyIncrement[metricKey]) || 0),
          startValue: Number(currentValues[metricKey]) || 0,
          increment: Number(weeklyIncrement[metricKey]) || 0,
          unit: metricKey,
        },
      })
    }

    for (const dateKey of Object.keys(nextData)) {
      const bucket = nextData[dateKey]
      const completion = bucket[task.id]
      if (!completion) continue
      if (completion.value === undefined && completion.incrementalValues) {
        const fromPrimary = primaryKey ? completion.incrementalValues[primaryKey] : Object.values(completion.incrementalValues)[0]
        if (fromPrimary !== undefined) {
          bucket[task.id] = { ...completion, value: fromPrimary }
        }
      }
      for (const metricKey of extras) {
        const logged = completion.incrementalValues?.[metricKey]
        if (logged === undefined) continue
        const childId = `${task.id}-${metricKey}`
        bucket[childId] = { ...(bucket[childId] || {}), value: logged }
      }
    }
  }

  return { tasks: nextTasks, weeklyData: nextData }
}
