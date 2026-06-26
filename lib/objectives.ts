/**
 * lib/objectives.ts — Objectives layer pure helpers (Feature 1, Worker A)
 *
 * Pure, unit-tested helpers behind the Objectives & Goals layer. An `Objective`
 * is an all-time aspirational direction that can be *prioritized* per period
 * (day/week/month/year) with a points multiplier. A `Goal` is a quantifiable
 * metric serving one or more objectives. Actions (tasks) connect to
 * goals/objectives via contribution fields / typed links.
 *
 * This module computes, all from data passed in (no store access, so it stays
 * pure + testable):
 *  1. Period keys + prioritization checks for objectives.
 *  2. Goal progress fractions/percents.
 *  3. "Direction in life" coverage — recomputed on read from links:
 *       • goals with no recent linked action (drift / neglected goals)
 *       • days whose completed tasks served no goal/objective at all
 *
 * IMPORTANT: coverage is derived on read; nothing here hooks the completeTask
 * path (that lives in the task-store, owned by another worker).
 */
import type { Goal, Objective, PriorityPeriod, ItemLink } from "@/lib/types"
import { formatLocalDateKey, getWeekString } from "@/lib/date-utils"

// --- Action model ----------------------------------------------------------
//
// Helpers operate on a minimal, normalized view of a completed/active task so
// they never depend on the full Task shape or the task-store. Callers (the
// panel/report components) map real tasks → ActionRecord, deriving the
// completion date from whatever the task carries (completionReview, chunks,
// scheduledDate, …).

export interface ActionRecord {
  id: string
  completed: boolean
  /** When the action was completed (Date or ISO/Y-M-D string). */
  completedDate?: Date | string | null
  /** Typed links to the goals/objectives this action serves. */
  links?: ItemLink[]
}

/**
 * Relations that mean "this action serves the linked goal/objective". Stored on
 * the action (task) side, so the forward reading is `action-of`; we also accept
 * the inverse ids defensively in case a link was recorded the other way.
 */
export const SERVING_RELATIONS = new Set([
  "action-of",
  "goal-of",
  "objective-of",
  "has-objective",
])

function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Distinct target ids an action links to via a serving relation. */
export function servedTargetIds(action: ActionRecord): Set<string> {
  const ids = new Set<string>()
  for (const link of action.links ?? []) {
    if (SERVING_RELATIONS.has(link.relation) && link.targetId) ids.add(link.targetId)
  }
  return ids
}

/** True if the action links (via a serving relation) to `targetId`. */
export function actionServesTarget(action: ActionRecord, targetId: string): boolean {
  return servedTargetIds(action).has(targetId)
}

/** Actions that serve `targetId` (any serving relation). */
export function actionsForTarget(actions: ActionRecord[], targetId: string): ActionRecord[] {
  return actions.filter((a) => actionServesTarget(a, targetId))
}

// --- Period keys & prioritization ------------------------------------------

/**
 * Canonical period key for a date:
 *   day   → YYYY-MM-DD (local)
 *   week  → getWeekString (Monday-start range)
 *   month → YYYY-MM
 *   year  → YYYY
 */
export function periodKeyFor(period: PriorityPeriod, date = new Date()): string {
  switch (period) {
    case "day":
      return formatLocalDateKey(date)
    case "week":
      return getWeekString(date)
    case "month":
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    case "year":
      return `${date.getFullYear()}`
  }
}

/** Max number of objectives that may be prioritized for a period. */
export const MAX_PRIORITIES_PER_PERIOD: Record<PriorityPeriod, number> = {
  day: 3,
  week: 3,
  month: 3,
  year: 5,
}

/** Whether an objective is prioritized for the period containing `date`. */
export function isObjectivePrioritized(
  objective: Objective,
  period: PriorityPeriod,
  date = new Date(),
): boolean {
  const key = periodKeyFor(period, date)
  return (objective.priorities ?? []).some((p) => p.period === period && p.periodKey === key)
}

/** Objectives prioritized for the period containing `date`. */
export function prioritizedObjectives(
  objectives: Objective[],
  period: PriorityPeriod,
  date = new Date(),
): Objective[] {
  return objectives.filter((o) => isObjectivePrioritized(o, period, date))
}

// --- Goal progress ---------------------------------------------------------

/** Raw goal progress fraction (current / target); boolean = 0|1. Uncapped. */
export function goalProgressFraction(goal: Goal): number {
  if (goal.type === "boolean") return goal.current >= 1 ? 1 : 0
  if (goal.target <= 0) return 0
  return goal.current / goal.target
}

/** Goal progress as a clamped 0-100 integer percent. */
export function goalProgressPercent(goal: Goal): number {
  return Math.round(Math.min(1, Math.max(0, goalProgressFraction(goal))) * 100)
}

// --- Direction-in-life coverage --------------------------------------------

/** All ids that count as "direction targets": every goal and objective. */
export function directionTargetIds(goals: Goal[], objectives: Objective[]): Set<string> {
  const ids = new Set<string>()
  for (const g of goals) ids.add(g.id)
  for (const o of objectives) ids.add(o.id)
  return ids
}

/** Latest completion date among completed actions serving `goalId` (or null). */
export function goalLastActionDate(goalId: string, actions: ActionRecord[]): Date | null {
  let latest: Date | null = null
  for (const action of actions) {
    if (!action.completed || !actionServesTarget(action, goalId)) continue
    const d = toDate(action.completedDate)
    if (d && (!latest || d.getTime() > latest.getTime())) latest = d
  }
  return latest
}

export interface StaleGoal {
  goal: Goal
  lastActionDate: Date | null
  daysSinceLastAction: number | null
  hasAnyAction: boolean
  /** True when there is no recent (within staleDays) completed linked action. */
  stale: boolean
}

export interface GoalsNeedingAttentionOptions {
  now?: Date
  /** A goal is "stale" if no linked action completed within this many days. */
  staleDays?: number
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Goals with no recent linked action. Returns one entry per stale goal (no
 * completed linked action ever, or the most recent one is older than
 * `staleDays`), most-neglected first.
 */
export function goalsNeedingAttention(
  goals: Goal[],
  actions: ActionRecord[],
  options: GoalsNeedingAttentionOptions = {},
): StaleGoal[] {
  const now = options.now ?? new Date()
  const staleDays = options.staleDays ?? 14
  const result: StaleGoal[] = []
  for (const goal of goals) {
    if (goal.completed) continue
    const lastActionDate = goalLastActionDate(goal.id, actions)
    const daysSinceLastAction = lastActionDate ? daysBetween(lastActionDate, now) : null
    const stale = daysSinceLastAction === null || daysSinceLastAction > staleDays
    if (!stale) continue
    result.push({
      goal,
      lastActionDate,
      daysSinceLastAction,
      hasAnyAction: lastActionDate !== null,
      stale,
    })
  }
  return result.sort((a, b) => {
    const av = a.daysSinceLastAction ?? Number.POSITIVE_INFINITY
    const bv = b.daysSinceLastAction ?? Number.POSITIVE_INFINITY
    return bv - av
  })
}

export interface DayCoverage {
  /** YYYY-MM-DD local key. */
  key: string
  date: Date
  /** Completed actions on this day. */
  completedCount: number
  /** Completed actions on this day that served a direction target. */
  servedCount: number
}

export interface CoverageOptions {
  now?: Date
  /** Size of the trailing window in days (inclusive of today). */
  days?: number
  /** Restrict "served" to these target ids; defaults to any serving link. */
  targetIds?: Set<string>
}

/**
 * Per-day coverage over a trailing window: how many actions completed each day
 * and how many of those served a direction target. Oldest day first.
 */
export function dayCoverage(actions: ActionRecord[], options: CoverageOptions = {}): DayCoverage[] {
  const now = options.now ?? new Date()
  const windowDays = options.days ?? 30
  const targetIds = options.targetIds

  const served = (a: ActionRecord): boolean => {
    const ids = servedTargetIds(a)
    if (ids.size === 0) return false
    if (!targetIds) return true
    for (const id of ids) if (targetIds.has(id)) return true
    return false
  }

  // Seed every day in the window so gaps (no activity) are represented.
  const byKey = new Map<string, DayCoverage>()
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    const key = formatLocalDateKey(d)
    byKey.set(key, { key, date: d, completedCount: 0, servedCount: 0 })
  }

  for (const action of actions) {
    if (!action.completed) continue
    const d = toDate(action.completedDate)
    if (!d) continue
    const key = formatLocalDateKey(d)
    const bucket = byKey.get(key)
    if (!bucket) continue // outside the window
    bucket.completedCount += 1
    if (served(action)) bucket.servedCount += 1
  }

  return [...byKey.values()].sort((a, b) => a.date.getTime() - b.date.getTime())
}

/**
 * Days where the user completed work but none of it served a goal/objective
 * ("drift days"). Returns the YYYY-MM-DD keys.
 */
export function daysWithoutDirection(actions: ActionRecord[], options: CoverageOptions = {}): string[] {
  return dayCoverage(actions, options)
    .filter((d) => d.completedCount > 0 && d.servedCount === 0)
    .map((d) => d.key)
}

export interface DirectionReport {
  /** Window analysed, in days. */
  windowDays: number
  /** Per-day coverage (oldest first). */
  days: DayCoverage[]
  /** Days with completions but no goal/objective served. */
  driftDays: string[]
  /** Goals with no recent linked action. */
  staleGoals: StaleGoal[]
  totalGoals: number
  /** Goals NOT in the stale list (have a recent linked action). */
  coveredGoals: number
  /** Active days (with ≥1 completion) in the window. */
  activeDays: number
  /** Active days where ≥1 completion served a target. */
  directedDays: number
  /**
   * Fraction (0-100) of active days that served a goal/objective, or null when
   * there were no active days in the window.
   */
  coverageScore: number | null
}

export interface DirectionReportOptions {
  now?: Date
  /** Trailing window for day coverage / drift. */
  days?: number
  /** Staleness threshold for goals. */
  staleDays?: number
}

/**
 * Roll the direction-in-life signals into a single report the DirectionReport
 * component renders. Pure: everything is derived from the goals, objectives and
 * action records handed in.
 */
export function directionReport(
  goals: Goal[],
  objectives: Objective[],
  actions: ActionRecord[],
  options: DirectionReportOptions = {},
): DirectionReport {
  const now = options.now ?? new Date()
  const windowDays = options.days ?? 30
  const staleDays = options.staleDays ?? 14
  const targetIds = directionTargetIds(goals, objectives)

  const days = dayCoverage(actions, { now, days: windowDays, targetIds })
  const driftDays = days.filter((d) => d.completedCount > 0 && d.servedCount === 0).map((d) => d.key)
  const staleGoals = goalsNeedingAttention(goals, actions, { now, staleDays })

  const activeDays = days.filter((d) => d.completedCount > 0).length
  const directedDays = days.filter((d) => d.servedCount > 0).length
  const coverageScore = activeDays > 0 ? Math.round((directedDays / activeDays) * 100) : null

  return {
    windowDays,
    days,
    driftDays,
    staleGoals,
    totalGoals: goals.length,
    coveredGoals: goals.length - staleGoals.length,
    activeDays,
    directedDays,
    coverageScore,
  }
}
