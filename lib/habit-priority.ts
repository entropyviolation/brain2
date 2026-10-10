/**
 * lib/habit-priority.ts — Habit pin, missed-period auto-weight, sort, grade blend
 *
 * A habit can be **pinned** by the user until they unpin it. Missed periods
 * (a fully empty week for daily habits, an empty prior week/month for those
 * frequencies) add an **auto** weight that compounds: two empty weeks in a
 * row → weight 2. Mute (`priorityMuted`) drops the auto term so an undone
 * habit can be deprioritized by hand. Sort and optional grade / Good-day
 * math read `effectivePriorityWeight`.
 *
 * The Priority button is a separate mark. `priorityLog` is an optional list of
 * lines (oldest first; missing means none). `priorityRefreshedOn` is the local
 * calendar day of the last refresh. The star and the green sheet wash use
 * `priorityStarFade`: day 0 is 100, then −10 points per calendar day, and day
 * 10 is 0. `priorityPermanent` holds both at 100 until it is turned off.
 * Neglect red still follows the empty-period count and does not use this fade.
 *
 * Grade blend (default floor 50): displayed = floor% × prioritized + rest% × overall.
 * Completing 100% of prioritized habits therefore floors the grade at 50%
 * even if everything else is empty; 100% of everything is still 100%.
 */
import { dailyHabitCompletionRatio } from "./habit-points"
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  getPrecedingMonthStarts,
  getPrecedingWeekStarts,
  getWeekDates,
  getWeekStartDate,
  getWeekString,
} from "./date-utils"
import { precedingQuarterStarts, quarterKey } from "./seasons"
import type { HabitFrequency, TaskCompletion, WeeklyData, WeeklyTask } from "./types"

/** Points multiplier a morning-ritual habit displays. Missing store value is ×5. */
export const DEFAULT_MORNING_RITUAL_POINT_MULTIPLIER = 5
export const MAX_MORNING_RITUAL_POINT_MULTIPLIER = 99

export const PRIORITY_GRADE_FLOOR = 50
export const MAX_AUTO_PRIORITY = 52

export function habitCellRatio(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  data: WeeklyData,
  date: Date,
): number {
  return dailyHabitCompletionRatio(task, completion, data, date)
}

export function periodHasAnyProgress(
  task: WeeklyTask,
  data: WeeklyData,
  dates: Date[],
  keyFor?: (date: Date) => string,
): boolean {
  for (const date of dates) {
    const key = keyFor ? keyFor(date) : formatLocalDateKey(date)
    if (habitCellRatio(task, data[key]?.[task.id], data, date) > 0) return true
  }
  return false
}

function dailyWeekDates(weekStart: Date): Date[] {
  return getWeekDates(getWeekStartDate(weekStart))
}

/** Consecutive fully empty periods immediately before the current one. */
export function autoPriorityWeight(
  task: WeeklyTask,
  data: WeeklyData,
  asOf: Date,
  frequency: HabitFrequency = task.frequency || "daily",
): number {
  if (task.priorityMuted) return 0

  if (frequency === "weekly") {
    const weeks = getPrecedingWeekStarts(getWeekStartDate(asOf), MAX_AUTO_PRIORITY + 1)
    const prior = weeks.slice(0, -1).reverse()
    let n = 0
    for (const start of prior) {
      const key = getWeekString(start)
      if (habitCellRatio(task, data[key]?.[task.id], data, start) > 0) break
      n++
    }
    return n
  }

  if (frequency === "monthly") {
    const months = getPrecedingMonthStarts(asOf, MAX_AUTO_PRIORITY + 1)
    const prior = months.slice(0, -1).reverse()
    let n = 0
    for (const start of prior) {
      const key = formatLocalMonthKey(start)
      if (habitCellRatio(task, data[key]?.[task.id], data, start) > 0) break
      n++
    }
    return n
  }

  if (frequency === "quarterly") {
    const seasons = precedingQuarterStarts(asOf, MAX_AUTO_PRIORITY + 1)
    const prior = seasons.slice(0, -1).reverse()
    let n = 0
    for (const start of prior) {
      const key = quarterKey(start)
      if (habitCellRatio(task, data[key]?.[task.id], data, start) > 0) break
      n++
    }
    return n
  }

  const current = getWeekStartDate(asOf)
  let n = 0
  for (let i = 1; i <= MAX_AUTO_PRIORITY; i++) {
    const start = new Date(current)
    start.setDate(current.getDate() - 7 * i)
    start.setHours(0, 0, 0, 0)
    if (periodHasAnyProgress(task, data, dailyWeekDates(start))) break
    n++
  }
  return n
}

export function effectivePriorityWeight(
  task: WeeklyTask,
  data: WeeklyData,
  asOf: Date,
  frequency: HabitFrequency = task.frequency || "daily",
): number {
  const auto = autoPriorityWeight(task, data, asOf, frequency)
  const pin = task.priorityPinned ? 1 : 0
  return auto + pin
}

export function sortHabitsByPriority<T extends WeeklyTask>(
  tasks: T[],
  data: WeeklyData,
  asOf: Date,
  frequency: HabitFrequency = "daily",
): T[] {
  return [...tasks]
    .map((task, index) => ({ task, index, weight: effectivePriorityWeight(task, data, asOf, frequency) }))
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
    .map((row) => row.task)
}

export function prioritizedHabits<T extends WeeklyTask>(
  tasks: T[],
  data: WeeklyData,
  asOf: Date,
  frequency: HabitFrequency = "daily",
): T[] {
  return tasks.filter((task) => effectivePriorityWeight(task, data, asOf, frequency) > 0)
}

/** `floor` percent of the prioritized score plus the remainder of overall. */
export function blendPriorityScore(
  overall: number,
  priority: number | null,
  enabled: boolean,
  floor: number = PRIORITY_GRADE_FLOOR,
): number {
  if (!enabled || priority === null || !Number.isFinite(priority)) return overall
  const f = Math.min(100, Math.max(0, floor)) / 100
  return f * priority + (1 - f) * overall
}

/** Missing or non-numeric values are the ×5 morning-ritual default. 0 is an explicit off. */
export function clampMorningRitualPointMultiplier(value: unknown): number {
  if (value === undefined || value === null || value === "") return DEFAULT_MORNING_RITUAL_POINT_MULTIPLIER
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_MORNING_RITUAL_POINT_MULTIPLIER
  return Math.min(MAX_MORNING_RITUAL_POINT_MULTIPLIER, Math.max(0, Math.round(n)))
}

/**
 * The period the neglect rule counts.
 * Daily and weekly count fully empty weeks. Monthly counts months. Season counts seasons.
 */
export function neglectEmptyUnit(frequency: HabitFrequency): "week" | "month" | "season" {
  if (frequency === "monthly") return "month"
  if (frequency === "quarterly") return "season"
  return "week"
}

/** "3 empty weeks" — the count the neglect rule actually uses. */
export function neglectCountLabel(frequency: HabitFrequency, count: number): string {
  const unit = neglectEmptyUnit(frequency)
  const noun = count === 1 ? unit : `${unit}s`
  return `${count} empty ${noun}`
}

/**
 * Name-cell wash while Highlight priorities is on.
 * Selected priority is a green wash at the star's strength (0–100).
 * Neglect is a red wash that strengthens with the empty-period count and
 * does not fade with that day-count. Both together keep the green as a left
 * edge at the star's strength and the red as the wash.
 * A morning-ritual habit still carries `is-priority-ritual` (the × mark).
 */
export function priorityWash(opts: {
  highlight: boolean
  ritual: boolean
  neglect: number
  /** 0–100 star strength. Omitted: a ritual habit is full strength, otherwise none. */
  selected?: number
}): { className: string; alpha: number; star: number } {
  if (!opts.highlight) return { className: "", alpha: 0, star: 0 }
  const neglect = Math.max(0, opts.neglect)
  const selected = Math.min(100, Math.max(0, opts.selected ?? (opts.ritual ? 100 : 0)))
  const parts: string[] = []
  if (opts.ritual) parts.push("is-priority-ritual")
  if (selected > 0) parts.push("is-priority-selected")
  if (neglect > 0) parts.push("is-priority-neglect")
  const t = Math.min(1, neglect / MAX_AUTO_PRIORITY)
  const alpha = neglect > 0 ? Math.round((0.16 + t * 0.5) * 100) / 100 : 0
  return { className: parts.join(" "), alpha, star: selected / 100 }
}

/** CSS variables for the name cell. Neglect alpha is independent of the star. */
export function priorityWashVars(wash: { alpha: number; star: number }): Record<string, string> | undefined {
  if (wash.alpha <= 0 && wash.star <= 0) return undefined
  const vars: Record<string, string> = {}
  if (wash.alpha > 0) vars["--neglect-alpha"] = String(wash.alpha)
  if (wash.star > 0) vars["--priority-star"] = String(wash.star)
  return vars
}

/** Local calendar days from `fromKey` (`YYYY-MM-DD`) to `asOf`. Same day is 0. */
export function calendarDaysAfter(fromKey: string, asOf: Date): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(fromKey)
  if (!match) return 0
  const from = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  const to = Date.UTC(asOf.getFullYear(), asOf.getMonth(), asOf.getDate())
  return Math.round((to - from) / 86_400_000)
}

/** Short local calendar day, e.g. Oct 9. */
export function formatPriorityDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" })
}

/**
 * Star strength from the last refresh.
 * Day 0 is 100. Each later calendar day loses 10 points. Day 10 and after is 0.
 * A missing date is 0. Permanent is applied by `priorityMarkPercent`, not here.
 */
export function priorityStarFade(refreshedOn: string | undefined, asOf: Date): number {
  if (!refreshedOn) return 0
  const days = calendarDaysAfter(refreshedOn, asOf)
  if (days < 0) return 100
  return Math.max(0, 100 - days * 10)
}

/**
 * Strength shared by the star and the green sheet wash.
 * Permanent stays at 100. Today's ritual selection is a refresh, so it is 100
 * even before the stored date is written. Otherwise the fade from the last refresh.
 */
export function priorityMarkPercent(
  task: { priorityRefreshedOn?: string; priorityPermanent?: boolean },
  asOf: Date,
  inRitualToday = false,
): number {
  if (task.priorityPermanent || inRitualToday) return 100
  return priorityStarFade(task.priorityRefreshedOn, asOf)
}

function appendPriorityLine(log: string[] | undefined, line: string): string[] {
  return [...(log ?? []), line]
}

/** First press is "Priority set". A later press is "Priority refreshed". */
export function applyPriorityPress(task: WeeklyTask, asOf: Date = new Date()): WeeklyTask {
  const day = formatPriorityDay(asOf)
  const line = task.priorityRefreshedOn ? `Priority refreshed ${day}.` : `Priority set ${day}.`
  return {
    ...task,
    priorityRefreshedOn: formatLocalDateKey(asOf),
    priorityLog: appendPriorityLine(task.priorityLog, line),
  }
}

/**
 * Choosing the habit in a ritual refreshes it.
 * `ritual` is the ritual's name: day, week, or moon.
 */
export function applyRitualPriority(task: WeeklyTask, ritual: string, asOf: Date = new Date()): WeeklyTask {
  const line = `Selected from ${ritual} ritual ${formatPriorityDay(asOf)}`
  return {
    ...task,
    priorityRefreshedOn: formatLocalDateKey(asOf),
    priorityLog: appendPriorityLine(task.priorityLog, line),
  }
}

/** Habits newly added to a ritual selection. Already-selected ids are left as they are. */
export function ritualPriorityUpdates(
  tasks: readonly WeeklyTask[],
  nextIds: readonly string[] | undefined,
  previousIds: readonly string[] | undefined,
  ritual: string,
  asOf: Date,
): WeeklyTask[] {
  const prev = new Set(previousIds ?? [])
  const added = new Set((nextIds ?? []).filter((id) => id && !prev.has(id)))
  if (!added.size) return []
  return tasks.filter((task) => added.has(task.id)).map((task) => applyRitualPriority(task, ritual, asOf))
}

/** On holds the star at 100. Off returns to the fade from the last refresh. */
export function applyPermanentPriority(task: WeeklyTask, on: boolean, asOf: Date = new Date()): WeeklyTask {
  if (Boolean(task.priorityPermanent) === on) return task
  const day = formatPriorityDay(asOf)
  const line = on ? `Permanent priority set ${day}.` : `Permanent priority removed ${day}.`
  return {
    ...task,
    priorityPermanent: on ? true : undefined,
    priorityLog: appendPriorityLine(task.priorityLog, line),
  }
}

export function priorityMathLine(overall: number, priority: number, floor: number = PRIORITY_GRADE_FLOOR): string {
  const rest = 100 - floor
  return `${floor}% × ${priority.toFixed(0)}% prioritized + ${rest}% × ${overall.toFixed(0)}% overall`
}
