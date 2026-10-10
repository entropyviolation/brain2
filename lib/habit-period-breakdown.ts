/**
 * lib/habit-period-breakdown.ts — Titles behind a period-column percent
 *
 * The footer number is `calculateDayPercentageAV` on a day and
 * `calculatePeriodColumnPercentage` on a week, month, or season. Both divide
 * by the habits still required, and each habit's share is `periodCellPercentage`.
 * This list is those habits. A title is completed when that share is 100.
 * Exempt habits stay out. The percent itself is not recomputed here.
 */
import { periodCellPercentage, type HabitExemptFn, type HabitPeriod } from "./calculations"
import type { WeeklyData, WeeklyTask } from "./types"

export type PeriodBreakdownFilter = "all" | "completed" | "open"

export interface PeriodBreakdownInput {
  tasks: WeeklyTask[]
  period: HabitPeriod
  data: WeeklyData
  isExempt?: HabitExemptFn
}

export interface PeriodBreakdownRow {
  id: string
  title: string
}

/** Window title: the day or the span already printed on the column. */
export function periodBreakdownWindowTitle(label: string, sublabel = ""): string {
  const sub = sublabel.trim()
  if (!sub) return label
  return `${label} ${sub}`
}

function rowsFor(input: PeriodBreakdownInput, filter: PeriodBreakdownFilter): PeriodBreakdownRow[] {
  const { tasks, period, data, isExempt } = input
  const active = isExempt ? tasks.filter((task) => !isExempt(task, period.key)) : tasks
  const rows: PeriodBreakdownRow[] = []
  for (const task of active) {
    const share = periodCellPercentage(task, data[period.key]?.[task.id], period, data)
    const completed = share === 100
    if (filter === "completed" && !completed) continue
    if (filter === "open" && completed) continue
    rows.push({ id: task.id, title: task.name })
  }
  return rows
}

/** Habit titles in that period's percent, in sheet order. */
export function periodBreakdownTitles(
  input: PeriodBreakdownInput,
  filter: PeriodBreakdownFilter = "all",
): string[] {
  return rowsFor(input, filter).map((row) => row.title)
}

export function periodBreakdownRows(
  input: PeriodBreakdownInput,
  filter: PeriodBreakdownFilter = "all",
): PeriodBreakdownRow[] {
  return rowsFor(input, filter)
}
