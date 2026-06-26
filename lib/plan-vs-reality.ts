/**
 * lib/plan-vs-reality.ts — Plan-vs-reality comparison (Brain2 #33)
 *
 * Pure helpers that compare what was *planned* for a period against what
 * actually *happened*, across three measurable dimensions, and roll the gap up
 * into a single "intention → outcome variance score" (0-100).
 *
 * Inputs (all derivable from existing data, no new types needed):
 *  - plan free-text the user wrote (lib/plan-text.ts: dayPlan / weekPlan / monthPlan keys)
 *  - tasks scheduled in the period (the planned workload) and their completion
 *  - points earned in the period (lib/points-store ledger)
 *
 * --- Variance scoring (documented) -----------------------------------------
 * For each applicable dimension we compute an *attainment* in [0,1]:
 *   tasks:  completed / planned                                 (capped at 1)
 *   time:   min(actual, planned) / max(actual, planned)         (1 = identical;
 *           both under- and over-running reduce attainment)
 *   points: actual / planned                                    (capped at 1)
 * A dimension is only "applicable" when its planned value is > 0 (you can't
 * diverge from a plan you didn't make). The applicable dimensions are combined
 * with fixed weights (tasks 0.5, time 0.3, points 0.2), renormalized over the
 * applicable set, into an overall attainment. Then:
 *   alignmentScore = round(attainment * 100)
 *   varianceScore  = 100 - alignmentScore
 * 0 variance = reality matched the plan; 100 = total divergence. When nothing
 * was planned the score is 0 and `hasPlan` is false (nothing to compare).
 */
import type { Task, ReviewPeriod } from "@/lib/types"
import {
  taskScheduledOnDay,
  taskScheduledInWeek,
  taskScheduledInMonth,
  parseLocalDate,
  formatLocalDateKey,
  getWeekString,
} from "@/lib/date-utils"

export type PlanPeriod = Extract<ReviewPeriod, "day" | "week" | "month">

export interface PointsLedgerEntry {
  date: string // YYYY-MM-DD
  points: number
}

export interface PlanMetric {
  key: "tasks" | "time" | "points"
  label: string
  planned: number
  actual: number
  /** 0-1 attainment for this dimension. */
  attainment: number
  /** Whether this dimension factors into the score (planned > 0). */
  applicable: boolean
  /** Display unit suffix, e.g. "min", "pts", or "". */
  unit: string
}

export interface PlanVsRealityComparison {
  period: PlanPeriod
  periodKey: string
  /** Non-empty plan lines the user wrote for the period. */
  intentions: string[]
  intentionCount: number
  plannedTaskCount: number
  completedTaskCount: number
  plannedMinutes: number
  actualMinutes: number
  plannedPoints: number
  actualPoints: number
  metrics: PlanMetric[]
  /** 0-100, higher = better alignment with the plan. */
  alignmentScore: number
  /** 0-100, higher = bigger gap between intention and outcome. */
  varianceScore: number
  /** True when there was something planned (text, tasks, or points). */
  hasPlan: boolean
}

const WEIGHTS: Record<PlanMetric["key"], number> = { tasks: 0.5, time: 0.3, points: 0.2 }

/**
 * Extract discrete "intentions" from free-text plan content: one per non-empty
 * line, with common bullet/numbering prefixes stripped.
 */
export function parsePlanIntentions(planText: string | null | undefined): string[] {
  if (!planText) return []
  return planText
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length > 0)
}

function taskInPeriod(task: Task, period: PlanPeriod, periodKey: string): boolean {
  switch (period) {
    case "day":
      return taskScheduledOnDay(task, periodKey)
    case "week":
      return taskScheduledInWeek(task, periodKey)
    case "month":
      return taskScheduledInMonth(task, periodKey)
  }
}

function dateInPeriod(date: Date, period: PlanPeriod, periodKey: string): boolean {
  switch (period) {
    case "day":
      return formatLocalDateKey(date) === periodKey
    case "week":
      return getWeekString(date) === periodKey
    case "month":
      return formatLocalDateKey(date).slice(0, 7) === periodKey
  }
}

/** Minutes actually logged against a task within the period. */
function loggedMinutesInPeriod(task: Task, period: PlanPeriod, periodKey: string): number {
  let minutes = 0
  let sawLog = false

  for (const chunk of task.completedChunks ?? []) {
    const d = chunk.date instanceof Date ? chunk.date : parseLocalDate(chunk.date as unknown as string)
    if (d && dateInPeriod(d, period, periodKey)) {
      minutes += chunk.duration || 0
      sawLog = true
    }
  }
  for (const log of task.timeLogs ?? []) {
    const d = parseLocalDate(log.date)
    if (d && dateInPeriod(d, period, periodKey)) {
      minutes += log.durationMinutes || 0
      sawLog = true
    }
  }

  // Fall back to actualDuration for a completed task with no granular logs.
  if (!sawLog && task.completed && task.actualDuration) minutes = task.actualDuration
  return minutes
}

function clamp01(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0
  return n > 1 ? 1 : n
}

/**
 * Compute the full plan-vs-reality comparison for a single period.
 */
export function computePlanVsReality(
  period: PlanPeriod,
  periodKey: string,
  tasks: Task[],
  pointsHistory: PointsLedgerEntry[],
  planText: string | null | undefined,
): PlanVsRealityComparison {
  const intentions = parsePlanIntentions(planText)

  const plannedTasks = tasks.filter((t) => taskInPeriod(t, period, periodKey))
  const completedTasks = plannedTasks.filter((t) => t.completed)

  const plannedTaskCount = plannedTasks.length
  const completedTaskCount = completedTasks.length

  const plannedMinutes = plannedTasks.reduce((s, t) => s + (t.estimatedDuration || 0), 0)
  const actualMinutes = plannedTasks.reduce((s, t) => s + loggedMinutesInPeriod(t, period, periodKey), 0)

  const plannedPoints = plannedTasks.reduce((s, t) => s + (t.rewardValue || 0), 0)
  const actualPoints = pointsHistory.reduce((s, e) => {
    const d = parseLocalDate(e.date)
    return d && dateInPeriod(d, period, periodKey) ? s + (e.points || 0) : s
  }, 0)

  const metrics: PlanMetric[] = [
    {
      key: "tasks",
      label: "Tasks",
      planned: plannedTaskCount,
      actual: completedTaskCount,
      applicable: plannedTaskCount > 0,
      attainment: plannedTaskCount > 0 ? clamp01(completedTaskCount / plannedTaskCount) : 0,
      unit: "",
    },
    {
      key: "time",
      label: "Time",
      planned: plannedMinutes,
      actual: actualMinutes,
      applicable: plannedMinutes > 0,
      attainment:
        plannedMinutes > 0
          ? clamp01(Math.min(actualMinutes, plannedMinutes) / Math.max(actualMinutes, plannedMinutes || 1))
          : 0,
      unit: "min",
    },
    {
      key: "points",
      label: "Points",
      planned: plannedPoints,
      actual: actualPoints,
      applicable: plannedPoints > 0,
      attainment: plannedPoints > 0 ? clamp01(actualPoints / plannedPoints) : 0,
      unit: "pts",
    },
  ]

  const applicable = metrics.filter((m) => m.applicable)
  const totalWeight = applicable.reduce((s, m) => s + WEIGHTS[m.key], 0)
  const attainment =
    totalWeight > 0 ? applicable.reduce((s, m) => s + m.attainment * WEIGHTS[m.key], 0) / totalWeight : 0

  const hasPlan = intentions.length > 0 || plannedTaskCount > 0 || plannedPoints > 0
  const alignmentScore = applicable.length > 0 ? Math.round(attainment * 100) : 0
  const varianceScore = applicable.length > 0 ? 100 - alignmentScore : 0

  return {
    period,
    periodKey,
    intentions,
    intentionCount: intentions.length,
    plannedTaskCount,
    completedTaskCount,
    plannedMinutes,
    actualMinutes,
    plannedPoints,
    actualPoints,
    metrics,
    alignmentScore,
    varianceScore,
    hasPlan,
  }
}

/** Recent period keys (most recent last), for populating a period picker. */
export function recentPeriodKeys(period: PlanPeriod, count: number, today = new Date()): string[] {
  const keys: string[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(today)
    if (period === "day") {
      d.setDate(d.getDate() - i)
      keys.push(formatLocalDateKey(d))
    } else if (period === "week") {
      d.setDate(d.getDate() - i * 7)
      keys.push(getWeekString(d))
    } else {
      d.setMonth(d.getMonth() - i)
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
    }
  }
  return keys
}
