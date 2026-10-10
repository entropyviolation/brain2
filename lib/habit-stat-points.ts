/**
 * lib/habit-stat-points.ts — Habits stats picker
 *
 * A Habits stats row chooses a set (daily, weekly, or monthly habits) and
 * one or more points. Engine points (floor, total, average) still turn on
 * those source ids. The other points are readings. “Better than last week”
 * stores the three week points, a previous-period compare, and 2 of 3 on
 * `HabitCompletionPipeline.stats`. It does not create a habit.
 */
import {
  calculateDayPercentageAV,
  calculatePeriodColumnPercentage,
  calculatePeriodOutputGrade,
  calculatePeriodTaskPercentage,
  calculateTaskPercentage,
  calculateWeekToDateGrade,
  calculateWeekToDateOutputGrade,
  type HabitExemptFn,
  type HabitPeriod,
} from "./calculations"
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  getMonthDates,
  getWeekDates,
  getWeekStartDate,
  getWeekString,
} from "./date-utils"
import { rawDailyCompletionAverage } from "./habit-daily-completion-average"
import { sumHabitValuesOverDays } from "./habit-value-sync"
import type {
  HabitCompletionPipeline,
  HabitCompletionSourceId,
  HabitStatPoint,
  HabitStatPointKind,
  HabitStatSet,
  HabitStatsConfig,
  WeeklyData,
  WeeklyTask,
} from "./types"

export const BETTER_THAN_LAST_WEEK_CHOICE = "betterThanLastWeek"

export const HABIT_STAT_SET_LABELS: Record<HabitStatSet, string> = {
  daily: "Daily habits",
  weekly: "Weekly habits",
  monthly: "Monthly habits",
}

const DAILY_KINDS = new Set<HabitStatPointKind>([
  "weekGrade",
  "perfectOutput",
  "dayPercent",
  "dayPercents",
  "habitWeekPercent",
  "habitWeekPercents",
  "dailyFloor",
  "habitValue",
  "dailyCompletionAverage",
])

const PERIOD_KINDS = new Set<HabitStatPointKind>([
  "periodGrade",
  "periodOutput",
  "habitCompletion",
  "habitCompletions",
])

const POINT_KINDS = new Set<string>([...DAILY_KINDS, ...PERIOD_KINDS])
const SETS = new Set<string>(["daily", "weekly", "monthly"])

export function betterThanLastWeekStats(): HabitStatsConfig {
  return {
    set: "daily",
    points: [{ kind: "dailyCompletionAverage" }, { kind: "weekGrade" }, { kind: "perfectOutput" }],
    comparePrevious: true,
    mustBeHigher: 2,
  }
}

export function statPointKey(point: HabitStatPoint): string {
  return point.ref ? `${point.kind}:${point.ref}` : point.kind
}

export function pointFitsSet(kind: HabitStatPointKind, set: HabitStatSet): boolean {
  return set === "daily" ? DAILY_KINDS.has(kind) : PERIOD_KINDS.has(kind)
}

export function engineSourceForPoint(kind: HabitStatPointKind): HabitCompletionSourceId | null {
  if (kind === "dailyFloor") return "dailyFloor"
  if (kind === "habitValue") return "habitValue"
  if (kind === "dailyCompletionAverage") return "dailyCompletionAverage"
  return null
}

export function pointKindForEngine(id: HabitCompletionSourceId): HabitStatPointKind | null {
  if (id === "dailyFloor") return "dailyFloor"
  if (id === "habitValue") return "habitValue"
  if (id === "dailyCompletionAverage") return "dailyCompletionAverage"
  return null
}

export function listedStatPoints(row: Pick<HabitCompletionPipeline, "sources" | "stats">): HabitStatPoint[] {
  const set = row.stats?.set ?? "daily"
  const points = (row.stats?.points ?? []).filter((point) => pointFitsSet(point.kind, set))
  if (set !== "daily") return points
  for (const id of row.sources) {
    const kind = pointKindForEngine(id)
    if (kind && !points.some((point) => point.kind === kind)) points.push({ kind })
  }
  return points
}

export function withBetterThanLastWeek(row: HabitCompletionPipeline): HabitCompletionPipeline {
  const preset = betterThanLastWeekStats()
  const kept = (row.stats?.points ?? []).filter(
    (point) => pointFitsSet(point.kind, "daily") && !preset.points.some((item) => item.kind === point.kind && !point.ref),
  )
  return {
    ...row,
    stats: {
      set: "daily",
      points: [...preset.points, ...kept],
      comparePrevious: true,
      mustBeHigher: row.stats?.comparePrevious ? (row.stats.mustBeHigher ?? 2) : 2,
    },
  }
}

export function sanitizeHabitStats(value: unknown): HabitStatsConfig | undefined {
  if (!value || typeof value !== "object") return undefined
  const raw = value as Partial<HabitStatsConfig>
  if (typeof raw.set !== "string" || !SETS.has(raw.set)) return undefined
  const set = raw.set as HabitStatSet
  const points: HabitStatPoint[] = []
  const seen = new Set<string>()
  for (const item of raw.points ?? []) {
    if (!item || typeof item !== "object") continue
    const kind = (item as HabitStatPoint).kind
    if (typeof kind !== "string" || !POINT_KINDS.has(kind) || !pointFitsSet(kind, set)) continue
    const ref = typeof (item as HabitStatPoint).ref === "string" ? (item as HabitStatPoint).ref : undefined
    const point: HabitStatPoint = ref ? { kind, ref } : { kind }
    const key = statPointKey(point)
    if (seen.has(key)) continue
    seen.add(key)
    points.push(point)
  }
  const must = raw.mustBeHigher
  const mustBeHigher = typeof must === "number" && Number.isFinite(must) ? Math.max(0, Math.round(must)) : undefined
  return {
    set,
    points,
    ...(raw.comparePrevious ? { comparePrevious: true } : {}),
    ...(mustBeHigher !== undefined && raw.comparePrevious ? { mustBeHigher } : {}),
  }
}

export interface HabitStatChoice {
  id: string
  label: string
  point?: HabitStatPoint
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export function dayPointLabel(date: Date): string {
  return `${WEEKDAYS[date.getDay()]} ${date.getMonth() + 1}/${date.getDate()}`
}

export function habitStatChoices(
  set: HabitStatSet,
  periodDays: readonly Date[],
  habits: readonly WeeklyTask[],
): HabitStatChoice[] {
  if (set === "daily") {
    const choices: HabitStatChoice[] = [
      { id: BETTER_THAN_LAST_WEEK_CHOICE, label: "Better than last week" },
      { id: "weekGrade", label: "Week grade", point: { kind: "weekGrade" } },
      { id: "perfectOutput", label: "Perfect output", point: { kind: "perfectOutput" } },
    ]
    for (const date of periodDays) {
      const ref = formatLocalDateKey(date)
      choices.push({ id: `dayPercent:${ref}`, label: dayPointLabel(date), point: { kind: "dayPercent", ref } })
    }
    choices.push({ id: "dayPercents", label: "All days", point: { kind: "dayPercents" } })
    for (const habit of habits) {
      choices.push({
        id: `habitWeekPercent:${habit.id}`,
        label: habit.name || "Untitled",
        point: { kind: "habitWeekPercent", ref: habit.id },
      })
    }
    choices.push({ id: "habitWeekPercents", label: "All daily habits", point: { kind: "habitWeekPercents" } })
    choices.push(
      { id: "dailyFloor", label: "Daily habits floor", point: { kind: "dailyFloor" } },
      { id: "habitValue", label: "Daily habit total", point: { kind: "habitValue" } },
      { id: "dailyCompletionAverage", label: "Daily completion average", point: { kind: "dailyCompletionAverage" } },
    )
    return choices
  }
  const grade = set === "monthly" ? "Month grade" : "Week grade"
  const choices: HabitStatChoice[] = [
    { id: "periodGrade", label: grade, point: { kind: "periodGrade" } },
    { id: "periodOutput", label: "Perfect output", point: { kind: "periodOutput" } },
  ]
  for (const habit of habits) {
    choices.push({
      id: `habitCompletion:${habit.id}`,
      label: habit.name || "Untitled",
      point: { kind: "habitCompletion", ref: habit.id },
    })
  }
  choices.push({ id: "habitCompletions", label: "All habits", point: { kind: "habitCompletions" } })
  return choices
}

export interface HabitStatContext {
  today: Date
  weekStart: Date
  monthStart: Date
  periodDays: Date[]
  set: HabitStatSet
  subject?: WeeklyTask
  dailyTasks: WeeklyTask[]
  weeklyTasks: WeeklyTask[]
  monthlyTasks: WeeklyTask[]
  weeklyData: WeeklyData
  weeklyHabitData: WeeklyData
  monthlyHabitData: WeeklyData
  gradeTolerance: number
  outputGradeTolerance: number
  isExempt?: HabitExemptFn
}

export interface StatMember {
  id: string
  name: string
  pct: number
}

export interface StatReading {
  key: string
  label: string
  value: number | null
  valueText: string
  members?: StatMember[]
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  next.setHours(0, 0, 0, 0)
  return next
}

function pctText(value: number | null): string {
  return value == null || !Number.isFinite(value) ? "—" : `${Math.round(value)}%`
}

function asOfForWeek(weekStart: Date, today: Date): Date {
  const dates = getWeekDates(getWeekStartDate(weekStart))
  const todayKey = formatLocalDateKey(today)
  if (todayKey < formatLocalDateKey(dates[0])) return dates[0]
  if (todayKey > formatLocalDateKey(dates[6])) return dates[6]
  return today
}

function habitName(tasks: readonly WeeklyTask[], id: string | undefined): string {
  if (!id) return "Habit"
  return tasks.find((habit) => habit.id === id)?.name || "Habit"
}

function dailyRows(ctx: HabitStatContext): StatMember[] {
  return ctx.dailyTasks.map((habit) => ({
    id: habit.id,
    name: habit.name || "Untitled",
    pct: ctx.periodDays.length
      ? calculateTaskPercentage(habit.id, ctx.dailyTasks, ctx.weeklyData, ctx.periodDays, ctx.isExempt)
      : 0,
  }))
}

function periodOf(ctx: HabitStatContext): HabitPeriod {
  if (ctx.set === "monthly") return { key: formatLocalMonthKey(ctx.monthStart), date: ctx.monthStart }
  return { key: getWeekString(ctx.weekStart), date: getWeekStartDate(ctx.weekStart) }
}

function periodTasks(ctx: HabitStatContext): WeeklyTask[] {
  return ctx.set === "monthly" ? ctx.monthlyTasks : ctx.weeklyTasks
}

function periodData(ctx: HabitStatContext): WeeklyData {
  return ctx.set === "monthly" ? ctx.monthlyHabitData : ctx.weeklyHabitData
}

export function previousStatContext(ctx: HabitStatContext): HabitStatContext {
  const weekStart = addDays(getWeekStartDate(ctx.weekStart), -7)
  const monthStart = new Date(ctx.monthStart.getFullYear(), ctx.monthStart.getMonth() - 1, 1)
  monthStart.setHours(0, 0, 0, 0)
  const weekKeys = getWeekDates(getWeekStartDate(ctx.weekStart)).map((date) => formatLocalDateKey(date))
  const sameWeek =
    ctx.periodDays.length === weekKeys.length &&
    ctx.periodDays.every((date, index) => formatLocalDateKey(date) === weekKeys[index])
  const periodDays = sameWeek ? getWeekDates(weekStart) : getMonthDates(monthStart)
  return { ...ctx, weekStart, monthStart, periodDays }
}

export function readStatPoint(point: HabitStatPoint, ctx: HabitStatContext): StatReading {
  const key = statPointKey(point)
  const weekDates = getWeekDates(getWeekStartDate(ctx.weekStart))
  const asOf = asOfForWeek(ctx.weekStart, ctx.today)

  if (point.kind === "weekGrade") {
    const grade = calculateWeekToDateGrade(
      ctx.dailyTasks,
      ctx.weeklyData,
      weekDates,
      asOf,
      ctx.gradeTolerance,
      ctx.isExempt,
    ).grade
    return { key, label: "Week grade", value: grade, valueText: pctText(grade) }
  }
  if (point.kind === "perfectOutput") {
    const grade = calculateWeekToDateOutputGrade(
      ctx.dailyTasks,
      ctx.weeklyData,
      weekDates,
      asOf,
      ctx.outputGradeTolerance,
      ctx.isExempt,
    ).grade
    return { key, label: "Perfect output", value: grade, valueText: pctText(grade) }
  }
  if (point.kind === "dayPercent" && point.ref) {
    const index = weekDates.findIndex((date) => formatLocalDateKey(date) === point.ref)
    const date = weekDates[index] ?? ctx.periodDays.find((item) => formatLocalDateKey(item) === point.ref)
    const value = date
      ? calculateDayPercentageAV(point.ref, ctx.dailyTasks, ctx.weeklyData, Math.max(0, index), ctx.isExempt)
      : null
    return {
      key,
      label: date ? dayPointLabel(date) : point.ref,
      value,
      valueText: pctText(value),
    }
  }
  if (point.kind === "dayPercents") {
    const members = ctx.periodDays.map((date, index) => ({
      id: formatLocalDateKey(date),
      name: dayPointLabel(date),
      pct: calculateDayPercentageAV(formatLocalDateKey(date), ctx.dailyTasks, ctx.weeklyData, index, ctx.isExempt),
    }))
    const value = members.length ? members.reduce((sum, member) => sum + member.pct, 0) / members.length : null
    return { key, label: "All days", value, valueText: pctText(value), members }
  }
  if (point.kind === "habitWeekPercent") {
    const rows = dailyRows(ctx)
    const row = rows.find((item) => item.id === point.ref)
    return {
      key,
      label: row?.name || habitName(ctx.dailyTasks, point.ref),
      value: row ? row.pct : null,
      valueText: pctText(row ? row.pct : null),
    }
  }
  if (point.kind === "habitWeekPercents" || point.kind === "dailyFloor") {
    const members = dailyRows(ctx)
    const value =
      point.kind === "dailyFloor"
        ? members.filter((member) => member.pct <= 0).length <= (ctx.subject?.dailyFloorLink?.allowAtZero ?? 0)
          ? 100
          : 0
        : members.length
          ? members.reduce((sum, member) => sum + member.pct, 0) / members.length
          : null
    return {
      key,
      label: point.kind === "dailyFloor" ? "Daily habits floor" : "All daily habits",
      value,
      valueText: pctText(value),
      members,
    }
  }
  if (point.kind === "habitValue") {
    const habitId = ctx.subject?.habitValueLink?.habitId
    const keys = ctx.periodDays
      .map((date) => formatLocalDateKey(date))
      .filter((day) => day <= formatLocalDateKey(ctx.today))
    const value = habitId ? sumHabitValuesOverDays(ctx.weeklyData, habitId, keys) : null
    const name = habitName(ctx.dailyTasks, habitId)
    return {
      key,
      label: habitId ? `Daily habit total · ${name}` : "Daily habit total",
      value,
      valueText: value == null ? "—" : String(Math.round(value)),
    }
  }
  if (point.kind === "dailyCompletionAverage") {
    const active = ctx.dailyTasks.filter((habit) =>
      ctx.periodDays.some((date) => !ctx.isExempt?.(habit, formatLocalDateKey(date))),
    )
    const activeIds = new Set(active.map((habit) => habit.id))
    const mean = rawDailyCompletionAverage(active, ctx.weeklyData, ctx.periodDays, ctx.isExempt)
    return {
      key,
      label: "Daily completion average",
      value: mean,
      valueText: pctText(mean),
      members: dailyRows(ctx).filter((row) => activeIds.has(row.id)),
    }
  }

  const period = periodOf(ctx)
  const tasks = periodTasks(ctx)
  const data = periodData(ctx)
  if (point.kind === "periodGrade") {
    const grade = calculatePeriodColumnPercentage(period, tasks, data, ctx.isExempt)
    const label = ctx.set === "monthly" ? "Month grade" : "Week grade"
    return { key, label, value: grade, valueText: pctText(grade) }
  }
  if (point.kind === "periodOutput") {
    const grade = calculatePeriodOutputGrade(
      tasks,
      data,
      [period],
      ctx.set === "monthly" ? ctx.monthStart : asOf,
      ctx.outputGradeTolerance,
      ctx.isExempt,
    ).grade
    return { key, label: "Perfect output", value: grade, valueText: pctText(grade) }
  }
  if (point.kind === "habitCompletion" || point.kind === "habitCompletions") {
    const members = tasks.map((habit) => ({
      id: habit.id,
      name: habit.name || "Untitled",
      pct: calculatePeriodTaskPercentage(habit.id, tasks, data, [period], ctx.isExempt),
    }))
    if (point.kind === "habitCompletion") {
      const row = members.find((member) => member.id === point.ref)
      return {
        key,
        label: row?.name || "Habit",
        value: row ? row.pct : null,
        valueText: pctText(row ? row.pct : null),
      }
    }
    const value = members.length ? members.reduce((sum, member) => sum + member.pct, 0) / members.length : null
    return { key, label: "All habits", value, valueText: pctText(value), members }
  }

  return { key, label: point.kind, value: null, valueText: "—" }
}

/** Shift a single day back one week. Other points use `previousStatContext`. */
export function previousPoint(point: HabitStatPoint): HabitStatPoint {
  if (point.kind !== "dayPercent" || !point.ref) return point
  const [year, month, day] = point.ref.split("-").map((part) => Number.parseInt(part, 10))
  if (!year || !month || !day) return point
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() - 7)
  return { kind: "dayPercent", ref: formatLocalDateKey(date) }
}
