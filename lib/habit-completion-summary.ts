/**
 * lib/habit-completion-summary.ts — Read-only habit standing for item detail
 *
 * Reads the habit and the completion book it already uses (daily `weeklyData`,
 * weekly / monthly / season maps). Does not write cells or change week windows.
 */
import { formatLocalDateKey, formatLocalMonthKey, getWeekString } from "@/lib/date-utils"
import { isGoalType, isHabitGoalMet, normalizeTaskType } from "@/lib/habit-utils"
import { quarterKey, quarterLabel } from "@/lib/seasons"
import { TaskType, type HabitFrequency, type TaskCompletion, type WeeklyData, type WeeklyTask } from "@/lib/types"

export interface HabitCompletionBooks {
  weeklyData: WeeklyData
  weeklyHabitData: WeeklyData
  monthlyHabitData: WeeklyData
  quarterlyHabitData: WeeklyData
}

export interface HabitRecentCompletion {
  key: string
  label: string
  detail: string
}

export interface HabitCompletionSummary {
  habitName: string
  frequencyLabel: string
  goalLabel: string
  periodLabel: string
  standing: string
  recent: HabitRecentCompletion[]
}

const FREQUENCY_LABEL: Record<HabitFrequency, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  quarterly: "Season",
}

const PERIOD_LABEL: Record<HabitFrequency, string> = {
  daily: "Today",
  weekly: "This week",
  monthly: "This month",
  quarterly: "This season",
}

function frequencyOf(habit: WeeklyTask): HabitFrequency {
  return habit.frequency ?? "daily"
}

export function bookForFrequency(books: HabitCompletionBooks, frequency: HabitFrequency): WeeklyData {
  switch (frequency) {
    case "weekly":
      return books.weeklyHabitData
    case "monthly":
      return books.monthlyHabitData
    case "quarterly":
      return books.quarterlyHabitData
    default:
      return books.weeklyData
  }
}

function periodKey(frequency: HabitFrequency, now: Date): string {
  switch (frequency) {
    case "weekly":
      return getWeekString(now)
    case "monthly":
      return formatLocalMonthKey(now)
    case "quarterly":
      return quarterKey(now)
    default:
      return formatLocalDateKey(now)
  }
}

function periodKeyLabel(frequency: HabitFrequency, key: string): string {
  if (frequency === "weekly") return key.split("_")[0] || key
  if (frequency === "quarterly") return quarterLabel(key)
  return key
}

export function habitGoalLabel(habit: WeeklyTask): string {
  const type = normalizeTaskType(habit.type)
  if (type === TaskType.BOOLEAN) return "Yes / No"
  if (type === TaskType.TEXT) return "A note"
  if (type === TaskType.INCREMENTAL) {
    const data = habit.incrementalData
    if (!data) return "Climb"
    const unit = habit.unit ? ` ${habit.unit}` : ""
    return data.cadence === "weekly"
      ? `${data.startValue}${unit}, then +${data.increment}`
      : `+${data.increment}${unit} from the last log`
  }
  if (habit.goal) {
    const unit = habit.unit ? ` ${habit.unit}` : ""
    return `${habit.goal}${unit}`
  }
  return "No number set"
}

function standingText(habit: WeeklyTask, cell: TaskCompletion | undefined, met: boolean): string {
  const type = normalizeTaskType(habit.type)
  if (isGoalType(habit.type) || type === TaskType.INCREMENTAL) {
    const value = cell?.value ?? 0
    const unit = habit.unit ? ` ${habit.unit}` : ""
    const target = habit.goal ? ` of ${habit.goal}${unit}` : unit
    return `${value}${target} — ${met ? "done" : "not there yet"}`
  }
  if (type === TaskType.TEXT) {
    const text = cell?.text?.trim()
    return text || "Empty"
  }
  return met ? "Done" : "Not done"
}

function cellDetail(habit: WeeklyTask, cell: TaskCompletion): string {
  const type = normalizeTaskType(habit.type)
  if (type === TaskType.TEXT) return cell.text?.trim() || "Done"
  if (isGoalType(habit.type) || type === TaskType.INCREMENTAL) {
    const unit = habit.unit ? ` ${habit.unit}` : ""
    return `${cell.value ?? 0}${unit}`.trim()
  }
  return "Done"
}

/** Name, frequency, goal, this period, and recent met periods. */
export function summarizeHabitCompletions(
  habit: WeeklyTask,
  books: HabitCompletionBooks,
  now: Date = new Date(),
): HabitCompletionSummary {
  const frequency = frequencyOf(habit)
  const book = bookForFrequency(books, frequency)
  const currentKey = periodKey(frequency, now)
  const current = book[currentKey]?.[habit.id]
  const metNow = isHabitGoalMet(habit, current, { date: now, weeklyData: book })

  const recent: HabitRecentCompletion[] = []
  const keys = Object.keys(book).sort((a, b) => (a < b ? 1 : a > b ? -1 : 0))
  for (const key of keys) {
    const cell = book[key]?.[habit.id]
    if (!cell) continue
    if (!isHabitGoalMet(habit, cell, { date: now, weeklyData: book })) continue
    recent.push({
      key,
      label: periodKeyLabel(frequency, key),
      detail: cellDetail(habit, cell),
    })
    if (recent.length >= 6) break
  }

  return {
    habitName: habit.name.trim() || "Habit",
    frequencyLabel: FREQUENCY_LABEL[frequency],
    goalLabel: habitGoalLabel(habit),
    periodLabel: PERIOD_LABEL[frequency],
    standing: standingText(habit, current, metNow),
    recent,
  }
}
