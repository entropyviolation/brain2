/**
 * lib/start-plans.ts — Start rituals write to the Plan tab's plan logs
 *
 * A start ritual's plan is not a private note. Morning appends to that day's
 * Day Plan. Week, month, and season starts append to their own Week, Month, and
 * Season Plan. Each start can also plan the smaller periods inside it: week →
 * days, month → weeks, season → months, year → seasons. Every entry is a normal
 * plan-log entry (`lib/plan-text.ts`) whose stamp suffix names the ritual that
 * wrote it, e.g. `9/20 9pm WEEK START PLAN`. A week planned at month start reads
 * `MONTH START PLAN` in that week's own log. The year has no plan log of its own,
 * so a year start's own plan stays on the ritual (its seasons are planned).
 *
 * Nothing is written for blank text, and the same text is not written twice:
 * `logged` remembers the last text appended per target.
 */
import { getWeekString } from "@/lib/date-utils"
import { formatLocalDateKey, formatLocalMonthKey } from "@/lib/date-utils"
import { appendPlanEntry, type PlanTextPeriod } from "@/lib/plan-text"
import { quarterKey, seasonOfDate } from "@/lib/seasons"
import { dateFromPeriodKey } from "@/lib/reviews-store"
import { daysOfWeek, monthsOfSeason, seasonsOfYear, weeksTouchingMonth } from "@/lib/tracking-summaries"
import type { ReviewPeriod } from "@/lib/types"

export interface StartPlanTarget {
  /** `${plan period}:${plan key}`, the key `logged` and `childPlans` use. */
  id: string
  period: PlanTextPeriod
  key: string
  label: string
}

export const MORNING_PLAN_LABEL = "MORNING PLAN"

/** `WEEK START PLAN` etc. The stamp suffix on entries a start ritual wrote. */
export function startPlanLabel(period: ReviewPeriod): string {
  switch (period) {
    case "day":
      return MORNING_PLAN_LABEL
    case "week":
      return "WEEK START PLAN"
    case "month":
      return "MONTH START PLAN"
    case "quarter":
      return "SEASON START PLAN"
    case "year":
      return "YEAR START PLAN"
  }
}

function target(period: PlanTextPeriod, key: string, label: string): StartPlanTarget {
  return { id: `${period}:${key}`, period, key, label }
}

/** The ritual period's own plan log. The year has none. */
export function ownPlanTarget(period: ReviewPeriod, periodKey: string): StartPlanTarget | null {
  switch (period) {
    case "day":
      return target("day", periodKey, "Day Plan")
    case "week":
      return target("week", periodKey, "Week Plan")
    case "month":
      return target("month", periodKey, "Month Plan")
    case "quarter":
      return target("quarter", periodKey, "Season Plan")
    case "year":
      return null
  }
}

/** The smaller periods inside a start ritual's period. */
export function childPlanTargets(period: ReviewPeriod, periodKey: string): StartPlanTarget[] {
  const anchor = dateFromPeriodKey(period, periodKey)
  switch (period) {
    case "week":
      return daysOfWeek(anchor).map((day) =>
        target(
          "day",
          formatLocalDateKey(day),
          day.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" }),
        ),
      )
    case "month":
      return weeksTouchingMonth(anchor.getFullYear(), anchor.getMonth()).map((monday) => {
        const sunday = new Date(monday)
        sunday.setDate(monday.getDate() + 6)
        const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" })
        return target("week", getWeekString(monday), `Week ${fmt(monday)} – ${fmt(sunday)}`)
      })
    case "quarter":
      return monthsOfSeason(anchor).map((month) =>
        target(
          "month",
          formatLocalMonthKey(month),
          month.toLocaleDateString(undefined, { month: "long", year: "numeric" }),
        ),
      )
    case "year":
      return seasonsOfYear(anchor.getFullYear()).map((season) =>
        target("quarter", quarterKey(season.anchor), `${seasonOfDate(season.anchor)} ${anchor.getFullYear()}`),
      )
    default:
      return []
  }
}

/**
 * Append each non-blank, changed plan to its log. Returns the new `logged` map
 * (the old one when nothing was written).
 */
export function logStartPlans(input: {
  period: ReviewPeriod
  periodKey: string
  own: string
  children: Record<string, string>
  logged: Record<string, string> | undefined
  now?: Date
}): Record<string, string> {
  const now = input.now ?? new Date()
  const suffix = startPlanLabel(input.period)
  const next = { ...(input.logged ?? {}) }
  const write = (t: StartPlanTarget, raw: string) => {
    const text = raw.trim()
    if (!text || next[t.id] === text) return
    if (appendPlanEntry(t.period, t.key, text, now, { stampSuffix: suffix })) next[t.id] = text
  }
  const own = ownPlanTarget(input.period, input.periodKey)
  if (own) write(own, input.own)
  for (const child of childPlanTargets(input.period, input.periodKey)) {
    write(child, input.children[child.id] ?? "")
  }
  return next
}
