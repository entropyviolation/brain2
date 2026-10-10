/**
 * lib/habit-span-breakdown.ts — What a far-right span % is made of
 *
 * The % column is one habit across the span on the sheet (the week, or the
 * weeks / months / seasons). Total is that same full-span figure
 * (`calculateTaskPercentage` / `calculatePeriodTaskPercentage`).
 * Running, only while the span is in progress, is the same formulas paced to
 * days that have started (`weekToDateDays` + `calculateElapsedTaskPercentage`)
 * or to periods that have started (`elapsedHabitPeriods` +
 * `calculateElapsedPeriodTaskPercentage`). A finished span has no running
 * value. This file does not draw a second curve.
 *
 * A habit that prints a current/target on the cell lists that same pair on
 * each period (`printedGoalAmounts`, or the climb log and that day's target).
 * The numerator is not clamped to the target. Extra above the target fills
 * the other periods in Total and Running; those figures still stop at 100.
 * A yes/no lamp stays a name.
 */
import {
  calculateElapsedPeriodTaskPercentage,
  calculateElapsedTaskPercentage,
  calculatePeriodTaskPercentage,
  calculateTaskPercentage,
  elapsedHabitPeriods,
  weekToDateDays,
  type HabitExemptFn,
  type HabitPeriod,
} from "./calculations"
import { addCalendarDays, formatDateRange, formatLocalDateKey } from "./date-utils"
import { incrementalGoalOn, incrementalLoggedValue } from "./incremental-habits"
import { printedGoalAmounts } from "./habit-missed-opportunity"
import { quarterEndDate, quarterKey } from "./seasons"
import { TaskType, type WeeklyData, type WeeklyTask } from "./types"

export type SpanUnit = "day" | "week" | "month" | "season"

/** One day or period already titled on the sheet. */
export interface SpanColumn {
  /** Date key on a daily sheet; the period key on weekly, monthly, and season. */
  key: string
  title: string
  date: Date
}

export interface HabitSpanBreakdown {
  habitName: string
  spanLabel: string
  /** Title bar: the habit and the span. */
  title: string
  /**
   * `amount` is the cell's current/target (`98.2/70`), present when the habit
   * prints one. A yes/no lamp omits it. An empty numerator is still the target
   * (`/70`), the same blank field the cell shows.
   */
  columns: { key: string; title: string; started: boolean; amount?: string }[]
  /**
   * The span has started and has not finished — the current week, month, or
   * season, including a window that still contains that period.
   */
  inProgress: boolean
  /** Through today, or through the last period that has started. Null when the span is not in progress. */
  running: number | null
  /** Full span. Null when nothing in the span was required (the sheet’s —). */
  total: number | null
  /** Every column was exempt. The sheet shows — rather than 0%. */
  vacant: boolean
  note: string | null
}

function columnEnd(date: Date, unit: SpanUnit): Date {
  if (unit === "day") return date
  if (unit === "week") return addCalendarDays(date, 6)
  if (unit === "month") return new Date(date.getFullYear(), date.getMonth() + 1, 0)
  return quarterEndDate(quarterKey(date)) ?? date
}

/** Today falls inside the span, including a window whose last period is still open. */
export function spanIsInProgress(columns: SpanColumn[], unit: SpanUnit, asOf: Date): boolean {
  if (columns.length === 0) return false
  const asOfKey = formatLocalDateKey(asOf)
  const startKey = formatLocalDateKey(columns[0].date)
  const endKey = formatLocalDateKey(columnEnd(columns[columns.length - 1].date, unit))
  return startKey <= asOfKey && asOfKey <= endKey
}

/** Same slash the cell paints: the number that was logged, then the target. */
function formatCellAmount(shown: number | undefined, goal: number | undefined): string {
  const numerator = typeof shown === "number" ? String(shown) : ""
  const denominator = typeof goal === "number" ? String(goal) : ""
  return `${numerator}/${denominator}`
}

/**
 * The amount the grid cell prints for this period. Goal, time, and count use
 * `printedGoalAmounts` (a sourced 98.2 against 70 stays 98.2/70). Climb uses
 * the logged score and that day's target. A lamp or a note has no fraction.
 */
function periodAmount(task: WeeklyTask, data: WeeklyData, column: SpanColumn): string | undefined {
  if (task.type === TaskType.BOOLEAN || task.type === TaskType.TEXT) return undefined
  const completion = data[column.key]?.[task.id]
  if (task.type === TaskType.INCREMENTAL) {
    return formatCellAmount(incrementalLoggedValue(completion), incrementalGoalOn(task, data, column.date))
  }
  const printed = printedGoalAmounts(task, completion)
  if (printed.shown === undefined && printed.goal === undefined) return undefined
  return formatCellAmount(printed.shown, printed.goal)
}

function exemptKey(column: SpanColumn, unit: SpanUnit): string {
  return unit === "day" ? formatLocalDateKey(column.date) : column.key
}

function startedSet(columns: SpanColumn[], unit: SpanUnit, asOf: Date): Set<string> {
  if (unit === "day") {
    return new Set(weekToDateDays(columns.map((column) => column.date), asOf).map((date) => formatLocalDateKey(date)))
  }
  const periods: HabitPeriod[] = columns.map((column) => ({ key: column.key, date: column.date }))
  return new Set(elapsedHabitPeriods(periods, asOf).map((period) => period.key))
}

function spanFigures(
  task: WeeklyTask,
  data: WeeklyData,
  columns: SpanColumn[],
  unit: SpanUnit,
  asOf: Date,
  isExempt?: HabitExemptFn,
): { running: number; total: number } {
  if (unit === "day") {
    const dates = columns.map((column) => column.date)
    return {
      total: calculateTaskPercentage(task.id, [task], data, dates, isExempt),
      running: calculateElapsedTaskPercentage(task, data, weekToDateDays(dates, asOf), isExempt),
    }
  }
  const periods: HabitPeriod[] = columns.map((column) => ({ key: column.key, date: column.date }))
  const elapsed = elapsedHabitPeriods(periods, asOf)
  const paced = isExempt ? elapsed.filter((period) => !isExempt(task, period.key)) : elapsed
  return {
    total: calculatePeriodTaskPercentage(task.id, [task], data, periods, isExempt),
    running: calculateElapsedPeriodTaskPercentage(task, data, paced),
  }
}

export function habitSpanBreakdown(input: {
  task: WeeklyTask
  data: WeeklyData
  columns: SpanColumn[]
  unit: SpanUnit
  asOf: Date
  isExempt?: HabitExemptFn
}): HabitSpanBreakdown {
  const { task, data, columns, unit, asOf, isExempt } = input
  const spanLabel =
    columns.length === 0
      ? "span"
      : formatDateRange(columns[0].date, columnEnd(columns[columns.length - 1].date, unit))
  const started = startedSet(columns, unit, asOf)
  const listed = columns.map((column) => {
    const amount = periodAmount(task, data, column)
    return {
      key: column.key,
      title: column.title,
      started: unit === "day" ? started.has(formatLocalDateKey(column.date)) : started.has(column.key),
      ...(amount !== undefined ? { amount } : {}),
    }
  })
  const vacant =
    !!isExempt &&
    columns.length > 0 &&
    columns.every((column) => isExempt(task, exemptKey(column, unit)))
  const inProgress = !vacant && spanIsInProgress(columns, unit, asOf)
  const figures = vacant ? null : spanFigures(task, data, columns, unit, asOf, isExempt)
  const note = inProgress
    ? unit === "day"
      ? "Running is through today. Total is the full span."
      : "Running is through the last period that has started. Total is the full span."
    : null

  return {
    habitName: task.name,
    spanLabel,
    title: `${task.name} — ${spanLabel}`,
    columns: listed,
    inProgress,
    running: inProgress && figures ? figures.running : null,
    total: figures ? figures.total : null,
    vacant,
    note,
  }
}
