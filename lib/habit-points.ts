/**
 * lib/habit-points.ts — Daily habit points and week-grade bonuses (pure)
 *
 * Each daily habit is worth `DAILY_HABIT_COMPLETION_POINTS` (50) for a full day,
 * scaled by that day's completion ratio (partial goals/climbs count).
 * Each elapsed day can also earn a grade bonus: 100 if either Week grade or
 * Perfect output is 75%+ (after its curve), 300 if both are; plus the user
 * accomplishment bonus when that day's raw column score meets
 * `accomplishmentThreshold` (`lib/habit-accomplishment.ts`, default 80% → 50).
 * A further editable bonus pays once when raw daily-habit completion beats
 * yesterday (`dayGradeLiftBonus`), and once per rail grade (Week grade and
 * Perfect output) that beats the prior full calendar week
 * (`weeklyGradeLiftBonus`). Two more pay once each when that day's raw
 * completion is above the prior 7-day average (`weeklyAverageBeatBonus`)
 * and above the prior 30-day average (`monthlyAverageBeatBonus`). Defaults
 * are 5. Both can apply on the same day. 0 turns a rule off.
 *
 * Spec: §9, §14.
 */
import { pointsRuleValue } from "@/lib/points-rules-live"
import { TaskType, type TaskCompletion, type WeeklyData, type WeeklyTask } from "./types"
import { incrementalDayPercentage } from "./incremental-habits"
import {
  accomplishmentBonusDescription,
  accomplishmentBonusPoints,
  clampAccomplishmentBonus,
  DEFAULT_ACCOMPLISHMENT_BONUS,
  DEFAULT_ACCOMPLISHMENT_THRESHOLD,
} from "./habit-accomplishment"

export const DAILY_HABIT_COMPLETION_POINTS = 50
export const GRADE_BONUS_EITHER = 100
export const GRADE_BONUS_BOTH = 300
export const GRADE_BONUS_THRESHOLD = 75
export const RAW_DAY_BONUS = DEFAULT_ACCOMPLISHMENT_BONUS
export const RAW_DAY_BONUS_THRESHOLD = DEFAULT_ACCOMPLISHMENT_THRESHOLD
/** Points when raw daily-habit completion beats yesterday. */
export const DEFAULT_DAY_GRADE_LIFT_BONUS = 25
/** Points per rail grade (Week grade, Perfect output) that beats last week. */
export const DEFAULT_WEEKLY_GRADE_LIFT_BONUS = 25
/** Points when raw daily completion is above the prior 7-day average. */
export const DEFAULT_WEEKLY_AVERAGE_BEAT_BONUS = 5
/** Points when raw daily completion is above the prior 30-day average. */
export const DEFAULT_MONTHLY_AVERAGE_BEAT_BONUS = 5

export function habitDayPointTaskId(taskId: string, dateKey: string): string {
  return `habit-day:${taskId}:${dateKey}`
}

export function gradeBonusTaskId(dateKey: string): string {
  return `habit-grade-bonus:${dateKey}`
}

export function rawDayBonusTaskId(dateKey: string): string {
  return `habit-raw-day-bonus:${dateKey}`
}

export function dayGradeLiftTaskId(dateKey: string): string {
  return `habit-day-grade-lift:${dateKey}`
}

export function weeklyGradeLiftTaskId(weekKey: string): string {
  return `habit-weekly-grade-lift:${weekKey}`
}

export function weeklyAverageBeatTaskId(dateKey: string): string {
  return `habit-weekly-avg-beat:${dateKey}`
}

export function monthlyAverageBeatTaskId(dateKey: string): string {
  return `habit-monthly-avg-beat:${dateKey}`
}

/** Ledger line for finishing a habit or task. */
export function habitCompletionReason(name: string): string {
  const trimmed = name.trim() || "task"
  return /^completed\b/i.test(trimmed) ? trimmed : `Completed ${trimmed}`
}

export function isDailyHabit(task: WeeklyTask): boolean {
  return (task.frequency || "daily") === "daily"
}

export function dailyHabitCompletionRatio(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  weeklyData: WeeklyData,
  date: Date,
): number {
  if (!completion) return 0
  switch (task.type) {
    case TaskType.BOOLEAN:
      return completion.completed ? 1 : 0
    case TaskType.TEXT:
      return completion.text?.trim() ? 1 : 0
    case TaskType.GOAL:
    case TaskType.TIME:
    case TaskType.COUNT: {
      if (!task.goal) return 0
      return Math.min(1, Math.max(0, (completion.value ?? 0) / task.goal))
    }
    case TaskType.INCREMENTAL: {
      const pct = incrementalDayPercentage(task, completion, weeklyData, date)
      if (pct === null) return 0
      return Math.min(1, Math.max(0, pct / 100))
    }
    default:
      return 0
  }
}

export function dailyHabitDayPoints(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  weeklyData: WeeklyData,
  date: Date,
): number {
  const full = pointsRuleValue("habit.dailyFullMark")
  const raw = dailyHabitCompletionRatio(task, completion, weeklyData, date) * full
  return Math.round(raw * 10) / 10
}

/** Both-rails bonus if both grades clear the threshold, else the one-rail bonus, else 0. */
export function gradeBonusPoints(weekGrade: number, outputGrade: number): number {
  const threshold = pointsRuleValue("habit.gradeBonusThreshold")
  const weekOk = weekGrade >= threshold
  const outputOk = outputGrade >= threshold
  if (weekOk && outputOk) return pointsRuleValue("habit.gradeBonusBoth")
  if (weekOk || outputOk) return pointsRuleValue("habit.gradeBonusEither")
  return 0
}

export function gradeBonusDescription(points: number, weekGrade?: number, outputGrade?: number): string {
  const threshold = pointsRuleValue("habit.gradeBonusThreshold")
  if (typeof weekGrade === "number" && typeof outputGrade === "number") {
    const weekOk = weekGrade >= threshold
    const outputOk = outputGrade >= threshold
    if (weekOk && outputOk) return `Grade bonus (both ${threshold}%+)`
    if (weekOk || outputOk) return `Grade bonus (either ${threshold}%+)`
    return "Grade bonus"
  }
  const both = pointsRuleValue("habit.gradeBonusBoth")
  const either = pointsRuleValue("habit.gradeBonusEither")
  if (points > 0 && points === both) return `Grade bonus (both ${threshold}%+)`
  if (points > 0 && points === either) return `Grade bonus (either ${threshold}%+)`
  return "Grade bonus"
}

/** Accomplishment bonus when that day's raw column completion meets the threshold. */
export function rawDayBonusPoints(
  rawDayScore: number,
  threshold: number = RAW_DAY_BONUS_THRESHOLD,
  bonus: number = RAW_DAY_BONUS,
): number {
  return accomplishmentBonusPoints(rawDayScore, threshold, bonus)
}

export function rawDayBonusDescription(
  points: number,
  threshold: number = RAW_DAY_BONUS_THRESHOLD,
): string {
  return accomplishmentBonusDescription(points, threshold)
}

export interface GradePair {
  week: number
  output: number
}

/** Signed percentage-point delta (whole percents, same rounding as the tubes). */
export function gradeLiftDelta(current: number, prior: number): number {
  const a = Math.round(Number.isFinite(current) ? current : 0)
  const b = Math.round(Number.isFinite(prior) ? prior : 0)
  return a - b
}

/** Compact signed readout: +10, −10, or 0. Uses a true minus for under. */
export function formatGradeLiftDelta(delta: number | null | undefined): string {
  if (delta === null || delta === undefined || !Number.isFinite(delta)) return "—"
  const n = Math.round(delta)
  if (n > 0) return `+${n}`
  if (n < 0) return `−${Math.abs(n)}`
  return "0"
}

export function formatGradeLiftYesterdayCaption(raw: number | null | undefined): string {
  if (raw === null || raw === undefined || !Number.isFinite(raw)) return "No prior day yet"
  return `Yesterday — ${Math.round(raw)}% daily completion`
}

export function formatGradeLiftLastWeekCaption(prior: GradePair | null | undefined): string {
  if (!prior) return "No prior week yet"
  const week = Math.round(Number.isFinite(prior.week) ? prior.week : 0)
  const output = Math.round(Number.isFinite(prior.output) ? prior.output : 0)
  return `Last week — week grade ${week}% · perfect output ${output}%`
}

/** "Prior 7 days — 42% average", or a quiet empty line when that window has no days yet. */
export function formatGradeLiftAverageCaption(
  label: string,
  average: number | null | undefined,
): string {
  if (average === null || average === undefined || !Number.isFinite(average)) return `No ${label.toLowerCase()} yet`
  return `${label} — ${Math.round(average)}% average`
}

/** Completion points a new habit starts with, per period. Existing habits keep their own `rewardValue`. */
export const DEFAULT_HABIT_PERIOD_POINTS = 10

export type HabitPeriodPointDefaults = {
  daily: number
  weekly: number
  monthly: number
  seasonal: number
}

export function defaultHabitPeriodPoints(): HabitPeriodPointDefaults {
  const n = DEFAULT_HABIT_PERIOD_POINTS
  return { daily: n, weekly: n, monthly: n, seasonal: n }
}

export function clampHabitPeriodPoints(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_HABIT_PERIOD_POINTS
  return Math.min(10_000, Math.max(0, Math.round(value)))
}

export function sanitizeHabitPeriodPoints(value: unknown): HabitPeriodPointDefaults {
  const base = defaultHabitPeriodPoints()
  if (!value || typeof value !== "object") return base
  const row = value as Record<string, unknown>
  for (const key of ["daily", "weekly", "monthly", "seasonal"] as const) {
    if (typeof row[key] === "number") base[key] = clampHabitPeriodPoints(row[key])
  }
  return base
}

/** Store key for a habit frequency. Season habits are stored as `quarterly`. */
export function habitPeriodPointsKey(frequency: string | undefined): keyof HabitPeriodPointDefaults {
  if (frequency === "weekly" || frequency === "monthly") return frequency
  if (frequency === "quarterly" || frequency === "seasonal") return "seasonal"
  return "daily"
}

/**
 * @deprecated Prefer {@link formatGradeLiftYesterdayCaption} /
 * {@link formatGradeLiftLastWeekCaption}. Kept for older call sites.
 */
export function formatGradeLiftPriorCaption(
  prior: GradePair | null | undefined,
  scope: "day" | "week",
): string {
  if (scope === "day") {
    if (!prior) return formatGradeLiftYesterdayCaption(null)
    return formatGradeLiftYesterdayCaption(prior.week)
  }
  return formatGradeLiftLastWeekCaption(prior)
}

/**
 * One editable amount when today's raw daily completion is strictly above an
 * older average. Whole percents match the Good days sheet. Equal pays nothing.
 */
export function rawDayBeatsAverage(
  currentRaw: number,
  averageRaw: number,
  bonus: number,
  window: "week" | "month",
): { points: number; description: string } {
  const each = clampAccomplishmentBonus(bonus)
  const up = Math.round(currentRaw) > Math.round(averageRaw)
  const description =
    window === "week"
      ? "Higher daily completion than the prior 7 days"
      : "Higher daily completion than the last 30 days"
  return { points: up ? each : 0, description }
}

/** One editable amount when today's raw daily-habit completion beats yesterday. */
export function rawDayBeatsPrior(
  currentRaw: number,
  priorRaw: number,
  bonus: number,
): { points: number; description: string } {
  const each = clampAccomplishmentBonus(bonus)
  const up = Math.round(currentRaw) > Math.round(priorRaw)
  return {
    points: up ? each : 0,
    description: "Higher daily completion than yesterday",
  }
}

/**
 * One editable amount, paid once for each rail grade that rose vs last week.
 * Whole percents match the tubes, so 74.6 and 75.4 are not a lift.
 */
export function gradesBeatPrior(
  current: GradePair,
  prior: GradePair,
  bonusEach: number,
  scope: "day" | "week" = "week",
): { points: number; description: string } {
  if (scope === "day") {
    // Legacy: day lift now uses rawDayBeatsPrior. Still accept GradePair.week as the raw %.
    return rawDayBeatsPrior(current.week, prior.week, bonusEach)
  }
  const each = clampAccomplishmentBonus(bonusEach)
  const weekUp = Math.round(current.week) > Math.round(prior.week)
  const outputUp = Math.round(current.output) > Math.round(prior.output)
  const points = ((weekUp ? 1 : 0) + (outputUp ? 1 : 0)) * each
  if (weekUp && outputUp) return { points, description: "Higher habit grades than last week" }
  if (weekUp) return { points, description: "Higher week grade than last week" }
  if (outputUp) return { points, description: "Higher output grade than last week" }
  return { points: 0, description: "Higher habit grades than last week" }
}

export interface LedgerAward {
  date: string
  taskId: string
  points: number
  taskDescription: string
}

/** Why a ledger row paid, including older rows that stored only a title. */
export function awardReason(entry: Pick<LedgerAward, "taskId" | "taskDescription">): string {
  const text = entry.taskDescription.trim()
  if (!text) return "Points"
  if (/bonus|completed|goal |friend:|inbox/i.test(text)) return text
  if (
    entry.taskId.startsWith("habit-grade") ||
    entry.taskId.startsWith("habit-raw") ||
    entry.taskId.includes("lift") ||
    entry.taskId.includes("avg-beat")
  ) {
    return text
  }
  return habitCompletionReason(text)
}

export function formatAwardPoints(points: number): string {
  const rounded = Math.round(points * 10) / 10
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
  return `+${text}`
}

/** Newest positive row: later calendar day wins; same day keeps the later write. */
export function latestPointAward(history: LedgerAward[]): LedgerAward | undefined {
  let best: LedgerAward | undefined
  for (const entry of history) {
    if (!(entry.points > 0)) continue
    if (!best || entry.date > best.date || entry.date === best.date) best = entry
  }
  return best
}

export function recentPointAwards(history: LedgerAward[], limit = 8): LedgerAward[] {
  return history
    .map((entry, index) => ({ entry, index }))
    .filter(({ entry }) => entry.points > 0)
    .sort((a, b) => (a.entry.date < b.entry.date ? 1 : a.entry.date > b.entry.date ? -1 : b.index - a.index))
    .slice(0, Math.max(0, limit))
    .map(({ entry }) => entry)
}

export function awardFace(entry: LedgerAward | undefined): { crt: string; footer: string } {
  if (!entry || !(entry.points > 0)) return { crt: "—", footer: "No points yet" }
  return { crt: formatAwardPoints(entry.points), footer: awardReason(entry) }
}
