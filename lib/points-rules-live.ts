/**
 * lib/points-rules-live.ts — Read and write the points-rule catalog
 *
 * Stores register readers and writers when they load. Award code calls
 * `pointsRuleValue` and gets today's default until that registration, and the
 * saved number after it. This file does not import the stores, so habit
 * points and the habits store can both use it without a cycle.
 */
import { POINTS_RULES, clampPointsRule, pointsRuleDef, type PointsRuleId } from "@/lib/points-rules"

type UserState = {
  pointsRules?: Partial<Record<string, number>>
  ritualSectionPoints?: number
  ritualCompletionBonus?: number
  goalFocusMultiplier?: number
}

type HabitPeriodPoints = {
  daily?: number
  weekly?: number
  monthly?: number
  seasonal?: number
}

type HabitState = {
  accomplishmentThreshold?: number
  accomplishmentBonus?: number
  dayGradeLiftBonus?: number
  weeklyGradeLiftBonus?: number
  weeklyAverageBeatBonus?: number
  monthlyAverageBeatBonus?: number
  morningRitualPointMultiplier?: number
  defaultHabitPoints?: HabitPeriodPoints
}

type HabitPeriod = "daily" | "weekly" | "monthly" | "seasonal"

let readUser: (() => UserState) | null = null
let readHabits: (() => HabitState) | null = null
const writers = new Map<PointsRuleId, (value: number) => void>()
const clearers = new Map<PointsRuleId, () => void>()

export function bindUserPointsRules(api: {
  get: () => UserState
  setMap: (id: PointsRuleId, value: number) => void
  clearMap: (id: PointsRuleId) => void
  setRitualSectionPoints: (value: number) => void
  setRitualCompletionBonus: (value: number) => void
  setGoalFocusMultiplier: (value: number) => void
}): void {
  readUser = api.get
  const fields: Record<string, (value: number) => void> = {
    ritualSectionPoints: api.setRitualSectionPoints,
    ritualCompletionBonus: api.setRitualCompletionBonus,
    goalFocusMultiplier: api.setGoalFocusMultiplier,
  }
  for (const rule of POINTS_RULES) {
    if (rule.home === "pointsRules") {
      writers.set(rule.id, (value) => api.setMap(rule.id, value))
      clearers.set(rule.id, () => api.clearMap(rule.id))
    } else if (rule.home === "userSettings") {
      const write = fields[rule.stateKey]
      if (write) writers.set(rule.id, write)
    }
  }
}

export function bindHabitPointsRules(api: {
  get: () => HabitState
  setAccomplishmentThreshold: (value: number) => void
  setAccomplishmentBonus: (value: number) => void
  setDayGradeLiftBonus: (value: number) => void
  setWeeklyGradeLiftBonus: (value: number) => void
  setWeeklyAverageBeatBonus: (value: number) => void
  setMonthlyAverageBeatBonus: (value: number) => void
  setMorningRitualPointMultiplier: (value: number) => void
  setDefaultHabitPoints: (period: HabitPeriod, value: number) => void
}): void {
  readHabits = api.get
  const direct: Record<string, (value: number) => void> = {
    accomplishmentThreshold: api.setAccomplishmentThreshold,
    accomplishmentBonus: api.setAccomplishmentBonus,
    dayGradeLiftBonus: api.setDayGradeLiftBonus,
    weeklyGradeLiftBonus: api.setWeeklyGradeLiftBonus,
    weeklyAverageBeatBonus: api.setWeeklyAverageBeatBonus,
    monthlyAverageBeatBonus: api.setMonthlyAverageBeatBonus,
    morningRitualPointMultiplier: api.setMorningRitualPointMultiplier,
  }
  for (const rule of POINTS_RULES) {
    if (rule.home !== "habits") continue
    if (rule.stateKey.startsWith("defaultHabitPoints.")) {
      const period = rule.stateKey.slice("defaultHabitPoints.".length) as HabitPeriod
      writers.set(rule.id, (value) => api.setDefaultHabitPoints(period, value))
    } else {
      const write = direct[rule.stateKey]
      if (write) writers.set(rule.id, write)
    }
  }
}

function readRaw(id: PointsRuleId): number | undefined {
  const rule = pointsRuleDef(id)
  if (rule.home === "pointsRules") {
    const value = readUser?.().pointsRules?.[id]
    return typeof value === "number" ? value : undefined
  }
  if (rule.home === "userSettings") {
    const state = readUser?.()
    if (!state) return undefined
    const value = state[rule.stateKey as keyof UserState]
    return typeof value === "number" ? value : undefined
  }
  const state = readHabits?.()
  if (!state) return undefined
  if (rule.stateKey.startsWith("defaultHabitPoints.")) {
    const period = rule.stateKey.slice("defaultHabitPoints.".length) as keyof HabitPeriodPoints
    const value = state.defaultHabitPoints?.[period]
    return typeof value === "number" ? value : undefined
  }
  const value = state[rule.stateKey as keyof HabitState]
  return typeof value === "number" ? value : undefined
}

/** Live rule, or the catalog default when the key was never saved. */
export function pointsRuleValue(id: PointsRuleId): number {
  const raw = readRaw(id)
  if (raw === undefined) return pointsRuleDef(id).defaultValue
  return clampPointsRule(id, raw)
}

export function commitPointsRule(id: PointsRuleId, value: number): void {
  const next = clampPointsRule(id, value)
  const rule = pointsRuleDef(id)
  if (rule.home === "pointsRules" && next === rule.defaultValue) {
    clearers.get(id)?.()
    return
  }
  writers.get(id)?.(next)
}

export function resetPointsRule(id: PointsRuleId): void {
  const rule = pointsRuleDef(id)
  if (rule.home === "pointsRules") {
    clearers.get(id)?.()
    return
  }
  writers.get(id)?.(rule.defaultValue)
}

export function currentRitualPointSettings(): { sectionPoints: number; completionBonus: number } {
  return {
    sectionPoints: pointsRuleValue("ritual.sectionPoints"),
    completionBonus: pointsRuleValue("ritual.completionBonus"),
  }
}
