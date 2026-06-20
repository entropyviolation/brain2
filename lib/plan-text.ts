/**
 * lib/plan-text.ts — Plan text localStorage helpers
 *
 * Reads/writes free-text plan areas from the Plan panel (day/week/month).
 * Used by plan views and period reviews. Interim storage only — target is
 * MongoDB `plans` collection documents (see docs/SPEC_MAPPING.md §3/§7).
 */
import type { ReviewPeriod } from "@/lib/types"

export function dayPlanKey(dayKey: string): string {
  return `dayPlan-${dayKey}`
}

export function weekPlanKey(weekKey: string): string {
  return `weekPlan-${weekKey}`
}

export function monthPlanKey(monthKey: string): string {
  return `monthPlan-${monthKey}`
}

export function getStoredPlanText(period: ReviewPeriod, periodKey: string): string | null {
  if (typeof window === "undefined") return null
  switch (period) {
    case "day":
      return localStorage.getItem(dayPlanKey(periodKey))
    case "week":
      return localStorage.getItem(weekPlanKey(periodKey))
    case "month":
      return localStorage.getItem(monthPlanKey(periodKey))
    default:
      return null
  }
}

export function saveStoredPlanText(period: "day" | "week" | "month", periodKey: string, text: string): void {
  if (typeof window === "undefined") return
  switch (period) {
    case "day":
      localStorage.setItem(dayPlanKey(periodKey), text)
      break
    case "week":
      localStorage.setItem(weekPlanKey(periodKey), text)
      break
    case "month":
      localStorage.setItem(monthPlanKey(periodKey), text)
      break
  }
}
