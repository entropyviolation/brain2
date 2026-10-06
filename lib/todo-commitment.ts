/**
 * lib/todo-commitment.ts — Required / prioritized marks and period load
 *
 * Every open To Do row is assigned to its period by the schedule fields.
 * `Task.todoMarks` adds required (its own list) and prioritized (a mark on
 * Assigned). The period load panel uses the same marks: days left, estimated
 * time, hours left, working hours left, and comfort (Hofstadter padding).
 */
import { differenceInDays, format } from "date-fns"
import type { Task, TodoMarkPeriod, TodoPeriodMark } from "@/lib/types"
import {
  canonicalWeekKey,
  formatLocalDateKey,
  formatLocalMonthKey,
  getWeekString,
  parseLocalDate,
  parseWeekString,
  startOfLocalDay,
} from "@/lib/date-utils"
import { periodKeyFor } from "@/lib/period-keys"
import { quarterEndDate, quarterKey, quarterStartDate } from "@/lib/seasons"
import { effectiveDurationMinutes } from "@/lib/todo-steps"

export type TodoViewPeriod = "day" | "week" | "month" | "quarter"

/** Which open tasks the estimated-time cell adds up. */
export type EstimateScope = "all" | "required" | "required-prioritized"

export type ComfortBand = "manageable" | "overfilled" | "behind"

/** Full days still ahead in the period are worth this many working hours each. */
export const WORKING_HOURS_PER_FUTURE_DAY = 10

/** The working day ends at 11:00pm local. Hours after that do not count. */
export const WORKING_DAY_END_MINUTES = 23 * 60

/** Hofstadter's Law: the estimate is doubled before it is compared to hours left. */
export const HOFSTADTER_PADDING = 2

export const ESTIMATE_SCOPE_LABELS: Record<EstimateScope, string> = {
  all: "All assigned",
  required: "Required",
  "required-prioritized": "Required + prioritized",
}

function markKey(period: TodoMarkPeriod, periodKey: string): string {
  return period === "week" ? canonicalWeekKey(periodKey) : periodKey
}

/** Day `YYYY-MM-DD`, week `getWeekString`, month `YYYY-MM`, season `YYYY-Qn`. */
export function todoPeriodKey(period: TodoViewPeriod, refDate: Date): string {
  return periodKeyFor(period, refDate)
}

export function findTodoMark(
  task: { todoMarks?: TodoPeriodMark[] },
  period: TodoMarkPeriod,
  periodKey: string,
): TodoPeriodMark | undefined {
  const key = markKey(period, periodKey)
  return task.todoMarks?.find((mark) => mark.period === period && markKey(period, mark.periodKey) === key)
}

export function taskIsRequired(
  task: { todoMarks?: TodoPeriodMark[] },
  period: TodoMarkPeriod,
  periodKey: string,
): boolean {
  return !!findTodoMark(task, period, periodKey)?.required
}

/**
 * Prioritized from a mark, or from a ritual id list (morning `priorityTaskIds`
 * for the day). The id list is display-only; clearing the flag also drops the id.
 */
export function taskIsPrioritized(
  task: { id?: string; todoMarks?: TodoPeriodMark[] },
  period: TodoMarkPeriod,
  periodKey: string,
  ritualPriorityIds?: readonly string[],
): boolean {
  if (period === "day" && task.id && ritualPriorityIds?.includes(task.id)) return true
  return !!findTodoMark(task, period, periodKey)?.prioritized
}

function sameMarks(a: TodoPeriodMark[] | undefined, b: TodoPeriodMark[] | undefined): boolean {
  const left = a ?? []
  const right = b ?? []
  if (left.length !== right.length) return false
  return left.every((mark, i) => {
    const other = right[i]
    return (
      mark.period === other?.period &&
      mark.periodKey === other?.periodKey &&
      !!mark.required === !!other?.required &&
      !!mark.prioritized === !!other?.prioritized
    )
  })
}

/** Replace the mark for one period. Both flags false drops it. Same task when nothing changed. */
export function withTodoCommitment(
  task: Task,
  period: TodoMarkPeriod,
  periodKey: string,
  flags: { required: boolean; prioritized: boolean },
): Task {
  const key = markKey(period, periodKey)
  const marks = (task.todoMarks ?? []).filter((mark) => !(mark.period === period && markKey(period, mark.periodKey) === key))
  if (flags.required || flags.prioritized) {
    marks.push({
      period,
      periodKey: key,
      ...(flags.required ? { required: true } : {}),
      ...(flags.prioritized ? { prioritized: true } : {}),
    })
  }
  const todoMarks = marks.length ? marks : undefined
  if (sameMarks(task.todoMarks, todoMarks)) return task
  return { ...task, todoMarks }
}

/** Flip one flag and keep the other. */
export function patchTodoCommitment(
  task: Task,
  period: TodoMarkPeriod,
  periodKey: string,
  patch: { required?: boolean; prioritized?: boolean },
): Task {
  const current = findTodoMark(task, period, periodKey)
  return withTodoCommitment(task, period, periodKey, {
    required: patch.required ?? !!current?.required,
    prioritized: patch.prioritized ?? !!current?.prioritized,
  })
}

/**
 * Write required / prioritized for every id in `scopeIds`. Tasks outside the
 * scope are left alone. Returns only the tasks whose marks changed.
 */
export function tasksWithCommitment(
  tasks: Task[],
  period: TodoMarkPeriod,
  periodKey: string,
  scopeIds: readonly string[],
  requiredIds: readonly string[],
  prioritizedIds: readonly string[],
): Task[] {
  const scope = new Set(scopeIds)
  const required = new Set(requiredIds)
  const prioritized = new Set(prioritizedIds)
  const changed: Task[] = []
  for (const task of tasks) {
    if (!scope.has(task.id)) continue
    const next = withTodoCommitment(task, period, periodKey, {
      required: required.has(task.id),
      prioritized: prioritized.has(task.id),
    })
    if (next !== task) changed.push(next)
  }
  return changed
}

/** Next morning `priorityTaskIds`, or null when the list would not change. */
export function nextPriorityIds(
  ids: readonly string[] | undefined,
  taskId: string,
  on: boolean,
): string[] | null {
  const current = ids ?? []
  const has = current.includes(taskId)
  if (on === has) return null
  return on ? [...current, taskId] : current.filter((id) => id !== taskId)
}

export function periodDayBounds(period: TodoViewPeriod, refDate: Date): { start: Date; end: Date } {
  if (period === "day") {
    const start = startOfLocalDay(refDate)
    return { start, end: start }
  }
  if (period === "week") {
    const range = parseWeekString(getWeekString(refDate))
    if (!range) {
      const start = startOfLocalDay(refDate)
      return { start, end: start }
    }
    return { start: startOfLocalDay(range.start), end: startOfLocalDay(range.end) }
  }
  if (period === "quarter") {
    const start = startOfLocalDay(quarterStartDate(refDate))
    const end = quarterEndDate(quarterKey(refDate))
    return { start, end: end ? startOfLocalDay(end) : start }
  }
  const start = new Date(refDate.getFullYear(), refDate.getMonth(), 1)
  const end = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0)
  return { start, end }
}

function inclusiveDays(from: Date, to: Date): number {
  if (from.getTime() > to.getTime()) return 0
  return differenceInDays(to, from) + 1
}

/** Calendar days from today through the period end, including today. Past periods are 0. */
export function daysLeftInPeriod(period: TodoViewPeriod, refDate: Date, now: Date = new Date()): number {
  const { start, end } = periodDayBounds(period, refDate)
  const today = startOfLocalDay(now)
  const from = today.getTime() > start.getTime() ? today : start
  return inclusiveDays(from, end)
}

export function todayIsInPeriod(period: TodoViewPeriod, refDate: Date, now: Date = new Date()): boolean {
  const { start, end } = periodDayBounds(period, refDate)
  const today = startOfLocalDay(now)
  return today.getTime() >= start.getTime() && today.getTime() <= end.getTime()
}

/** "2 days left in week", "1 day left in month". The day view says Today when that day is today. */
export function daysLeftLabel(period: TodoViewPeriod, refDate: Date, now: Date = new Date()): string {
  const n = daysLeftInPeriod(period, refDate, now)
  if (period === "day") {
    if (n === 1 && todayIsInPeriod(period, refDate, now)) return "Today"
    return n === 1 ? "1 day left" : "0 days left"
  }
  const grain = period === "week" ? "week" : period === "month" ? "month" : "season"
  const unit = n === 1 ? "day" : "days"
  return `${n} ${unit} left in ${grain}`
}

/** Days in the period strictly after today. A future period counts every one of its days. */
export function futureDaysInPeriod(period: TodoViewPeriod, refDate: Date, now: Date = new Date()): number {
  const { start, end } = periodDayBounds(period, refDate)
  const tomorrow = startOfLocalDay(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const from = tomorrow.getTime() < start.getTime() ? start : tomorrow
  return inclusiveDays(from, end)
}

/** Fractional hours from now until 11:00pm. Zero at and after 11pm. */
export function hoursLeftBeforeDayEnd(now: Date = new Date()): number {
  const minutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  return Math.max(0, (WORKING_DAY_END_MINUTES - minutes) / 60)
}

/** Fractional hours from now until midnight. */
export function hoursLeftUntilMidnight(now: Date = new Date()): number {
  const minutes = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60
  return Math.max(0, (24 * 60 - minutes) / 60)
}

/**
 * Clock hours left in the period: future days × 24, plus hours left today
 * before midnight when today falls inside the period. Comfort does not use this.
 */
export function hoursLeftInPeriod(period: TodoViewPeriod, refDate: Date, now: Date = new Date()): number {
  const future = futureDaysInPeriod(period, refDate, now) * 24
  const todayHours = todayIsInPeriod(period, refDate, now) ? hoursLeftUntilMidnight(now) : 0
  return future + todayHours
}

/**
 * Working hours left in the period: future days × 10, plus hours left today
 * before 11pm when today falls inside the period.
 */
export function workingHoursLeft(period: TodoViewPeriod, refDate: Date, now: Date = new Date()): number {
  const future = futureDaysInPeriod(period, refDate, now) * WORKING_HOURS_PER_FUTURE_DAY
  const todayHours = todayIsInPeriod(period, refDate, now) ? hoursLeftBeforeDayEnd(now) : 0
  return future + todayHours
}

export function formatMinutesAsHours(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "0m"
  const rounded = Math.round(minutes)
  const hours = Math.floor(rounded / 60)
  const mins = rounded % 60
  if (hours === 0) return `${mins}m`
  if (mins === 0) return `${hours}h`
  return `${hours}h ${mins}m`
}

export function formatWorkingHours(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) return "0h"
  const rounded = Math.round(hours * 10) / 10
  return Number.isInteger(rounded) ? `${rounded}h` : `${rounded.toFixed(1)}h`
}

export function summedEstimate(
  todos: readonly { id: string; estimatedDuration?: number }[],
  tasks: readonly Task[],
  period: TodoViewPeriod,
  periodKey: string,
  scope: EstimateScope,
  ritualPriorityIds?: readonly string[],
): { minutes: number; included: number; unestimated: number } {
  const byId = new Map(tasks.map((task) => [task.id, task]))
  let minutes = 0
  let included = 0
  let unestimated = 0
  for (const todo of todos) {
    const task = byId.get(todo.id)
    if (!task) continue
    const required = taskIsRequired(task, period, periodKey)
    const prioritized = taskIsPrioritized(task, period, periodKey, ritualPriorityIds)
    const match =
      scope === "all" ||
      (scope === "required" && required) ||
      (scope === "required-prioritized" && (required || prioritized))
    if (!match) continue
    included += 1
    const mins = effectiveDurationMinutes(task.estimatedDuration, task.subtasks)
    if (mins == null || mins <= 0) unestimated += 1
    else minutes += mins
  }
  return { minutes, included, unestimated }
}

/** Estimated hours × 2 ÷ working hours. Infinite when work remains and no hours are left. */
export function comfortRatio(estimateMinutes: number, workingHours: number): number {
  const estimatedHours = estimateMinutes / 60
  if (workingHours <= 0) return estimatedHours <= 0 ? 0 : Number.POSITIVE_INFINITY
  return (estimatedHours * HOFSTADTER_PADDING) / workingHours
}

export function comfortBand(ratio: number): ComfortBand {
  if (ratio < 1) return "manageable"
  if (ratio > 10) return "behind"
  return "overfilled"
}

export function formatComfortRatio(ratio: number): string {
  if (!Number.isFinite(ratio)) return "∞"
  if (ratio === 0) return "0"
  if (ratio < 10) return ratio.toFixed(2)
  return ratio.toFixed(1)
}

export interface CommitmentSlot {
  period: TodoMarkPeriod
  key: string
  label: string
}

function weekLabel(weekKey: string): string {
  const range = parseWeekString(weekKey)
  if (!range) return `Week ${weekKey}`
  const endFmt = range.start.getMonth() === range.end.getMonth() ? "d" : "MMM d"
  return `Week of ${format(range.start, "MMM d")}–${format(range.end, endFmt)}`
}

/**
 * Day / week / month rows this task already appears on, so item detail can
 * mark each one. Quarter and year marks already stored are listed too.
 */
export function assignedCommitmentSlots(task: Task): CommitmentSlot[] {
  const slots: CommitmentSlot[] = []
  const day = task.scheduledDate
    ? parseLocalDate(task.scheduledDate)
    : task.deadline
      ? parseLocalDate(task.deadline)
      : null
  if (day) {
    slots.push({ period: "day", key: formatLocalDateKey(day), label: format(day, "EEE, MMM d") })
  }

  const weekKey = task.scheduledWeek
    ? canonicalWeekKey(task.scheduledWeek)
    : day
      ? getWeekString(day)
      : undefined
  if (weekKey) slots.push({ period: "week", key: weekKey, label: weekLabel(weekKey) })

  let monthKey = task.scheduledMonth
  if (!monthKey && day) monthKey = formatLocalMonthKey(day)
  if (!monthKey && weekKey) {
    const range = parseWeekString(weekKey)
    if (range) monthKey = formatLocalMonthKey(range.start)
  }
  if (monthKey) {
    const parsed = parseLocalDate(`${monthKey}-01`)
    slots.push({
      period: "month",
      key: monthKey,
      label: parsed ? format(parsed, "MMMM yyyy") : monthKey,
    })
  }

  for (const mark of task.todoMarks ?? []) {
    if (mark.period !== "quarter" && mark.period !== "year") continue
    if (slots.some((slot) => slot.period === mark.period && slot.key === mark.periodKey)) continue
    slots.push({
      period: mark.period,
      key: mark.periodKey,
      label: `${mark.period} ${mark.periodKey}`,
    })
  }
  return slots
}

export function splitByCommitment<T>(items: readonly T[], isRequired: (item: T) => boolean): {
  required: T[]
  assigned: T[]
} {
  const required: T[] = []
  const assigned: T[] = []
  for (const item of items) {
    if (isRequired(item)) required.push(item)
    else assigned.push(item)
  }
  return { required, assigned }
}
