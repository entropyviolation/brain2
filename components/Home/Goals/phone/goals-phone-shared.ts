/**
 * components/Home/Goals/phone/goals-phone-shared.ts — period labels for the phone tree
 *
 * Same periods and words as the desktop wells. Kept here so the phone files
 * can share them without editing `ObjectivesPanel` or `GoalsContainer`.
 */
import { periodKeyFor } from "@/lib/objectives"
import type { GoalPeriodKind, Objective, ObjectivePriority, PriorityPeriod } from "@/lib/types"

export const PRIORITY_PERIODS: PriorityPeriod[] = ["day", "week", "month", "quarter", "year"]

export const PERIOD_LABELS: Record<PriorityPeriod, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Season",
  year: "Year",
}

export const VIEW_MODES = ["day", "week", "month", "quarter", "year", "all"] as const
export type ViewMode = (typeof VIEW_MODES)[number]

export const PERIOD_KINDS: GoalPeriodKind[] = ["day", "week", "month", "quarter", "year", "custom", "aspirational"]
export const GOAL_FILTERS = ["all", ...PERIOD_KINDS] as const
export type GoalFilter = (typeof GOAL_FILTERS)[number]

export const GOAL_PERIOD_LABELS: Record<GoalPeriodKind, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  quarter: "Season",
  year: "Year",
  custom: "Custom range",
  aspirational: "Aspirational",
}

export function goalFilterLabel(filter: GoalFilter) {
  return filter === "all" ? "All" : GOAL_PERIOD_LABELS[filter]
}

/** Priorities currently in effect (matching the period key for now). */
export function activePriorities(objective: Objective): ObjectivePriority[] {
  return (objective.priorities ?? []).filter((p) => p.periodKey === periodKeyFor(p.period))
}
