/**
 * lib/habit-points.ts — Daily habit points and week-grade bonuses (pure)
 *
 * Each daily habit is worth `DAILY_HABIT_COMPLETION_POINTS` (50) for a full day,
 * scaled by that day's completion ratio (partial goals/climbs count).
 * Each elapsed day can also earn a grade bonus: 100 if either Week grade or
 * Perfect output is 75%+ (after its curve), 300 if both are; plus the user
 * accomplishment bonus when that day's raw column score meets
 * `accomplishmentThreshold` (`lib/habit-accomplishment.ts`, default 80% → 50).
 * A further editable bonus pays once per grade (Week grade and Perfect output)
 * that is higher than yesterday, and once per weekly-habit grade that is
 * higher than last week (`dayGradeLiftBonus` / `weeklyGradeLiftBonus`).
 *
 * Spec: §9, §14.
 */
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
/** Points per daily grade (Week grade, Perfect output) that beats yesterday. */
export const DEFAULT_DAY_GRADE_LIFT_BONUS = 25
/** Points per weekly-habit grade that beats last week. */
export const DEFAULT_WEEKLY_GRADE_LIFT_BONUS = 25

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
  const raw = dailyHabitCompletionRatio(task, completion, weeklyData, date) * DAILY_HABIT_COMPLETION_POINTS
  return Math.round(raw * 10) / 10
}

/** 300 if both grades are 75%+, else 100 if either is, else 0. */
export function gradeBonusPoints(weekGrade: number, outputGrade: number): number {
  const weekOk = weekGrade >= GRADE_BONUS_THRESHOLD
  const outputOk = outputGrade >= GRADE_BONUS_THRESHOLD
  if (weekOk && outputOk) return GRADE_BONUS_BOTH
  if (weekOk || outputOk) return GRADE_BONUS_EITHER
  return 0
}

export function gradeBonusDescription(points: number): string {
  if (points === GRADE_BONUS_BOTH) return "Grade bonus (both 75%+)"
  if (points === GRADE_BONUS_EITHER) return "Grade bonus (either 75%+)"
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

/**
 * One editable amount, paid once for each grade that rose.
 * Whole percents match the tubes, so 74.6 and 75.4 are not a lift.
 */
export function gradesBeatPrior(
  current: GradePair,
  prior: GradePair,
  bonusEach: number,
  scope: "day" | "week",
): { points: number; description: string } {
  const each = clampAccomplishmentBonus(bonusEach)
  const weekUp = Math.round(current.week) > Math.round(prior.week)
  const outputUp = Math.round(current.output) > Math.round(prior.output)
  const points = ((weekUp ? 1 : 0) + (outputUp ? 1 : 0)) * each
  if (scope === "day") {
    if (weekUp && outputUp) return { points, description: "Higher habit grades than yesterday" }
    if (weekUp) return { points, description: "Higher week grade than yesterday" }
    if (outputUp) return { points, description: "Higher output grade than yesterday" }
    return { points: 0, description: "Higher habit grades than yesterday" }
  }
  if (weekUp && outputUp) return { points, description: "Higher weekly habit grades than last week" }
  if (weekUp) return { points, description: "Higher weekly habit grade than last week" }
  if (outputUp) return { points, description: "Higher weekly output than last week" }
  return { points: 0, description: "Higher weekly habit grades than last week" }
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
  if (entry.taskId.startsWith("habit-grade") || entry.taskId.startsWith("habit-raw") || entry.taskId.includes("lift")) {
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
