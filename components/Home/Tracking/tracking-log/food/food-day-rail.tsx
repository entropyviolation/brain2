"use client"

/**
 * components/Home/Tracking/tracking-log/food/food-day-rail.tsx — Days inside a food range
 *
 * A week lists every day. A longer range lists days that already have food.
 * One day, and Today, stay on the range bar alone.
 */

import { format } from "date-fns"
import type { LogShelfRange } from "@/components/Home/Tracking/tracking-log-model"
import { formatLocalDateKey, getWeekDates, getWeekStartDate, parseLocalDate } from "@/lib/date-utils"

export function foodRangeLabel(range: LogShelfRange, bounds: { fromKey: string; toKey: string } | null): string {
  if (range === "week") return "This week"
  if (range === "month") return "This month"
  if (range === "all") return "All"
  if (range === "custom" && bounds && bounds.fromKey !== bounds.toKey) return "Custom"
  return "Day"
}

export function foodRangeIsSingleDay(range: LogShelfRange, bounds: { fromKey: string; toKey: string } | null): boolean {
  if (range === "today") return true
  if (range === "week" || range === "month" || range === "all") return false
  if (!bounds) return false
  return bounds.fromKey === bounds.toKey
}

/** Monday of the week that contains `YYYY-MM-DD`. */
export function mondayKey(dateKey: string): string {
  const date = parseLocalDate(dateKey)
  if (!date) return dateKey
  return formatLocalDateKey(getWeekStartDate(date))
}

export function foodDayLabel(key: string): string {
  const date = parseLocalDate(key)
  if (!date) return key
  return format(date, "EEE d")
}

export function foodRailDays(
  range: LogShelfRange,
  bounds: { fromKey: string; toKey: string } | null,
  dates: readonly string[],
): string[] {
  if (foodRangeIsSingleDay(range, bounds)) return []
  if (range === "week" && bounds) {
    const start = parseLocalDate(bounds.fromKey)
    if (!start) return []
    return getWeekDates(getWeekStartDate(start)).map((day) => formatLocalDateKey(day))
  }
  return [...new Set(dates)]
    .filter((day) => !bounds || (day >= bounds.fromKey && day <= bounds.toKey))
    .sort()
}

export function FoodDayRail({
  days,
  selected,
  onSelect,
}: {
  days: { key: string; label: string; kcal: number }[]
  selected: string | null
  onSelect: (key: string) => void
}) {
  if (days.length === 0) return null
  return (
    <div className="trk-food-days">
      <div className="trk-span-switch" role="toolbar" aria-label="Days">
        {days.map((day) => (
          <button
            key={day.key}
            type="button"
            aria-pressed={selected === day.key}
            aria-label={`${day.label}, ${day.kcal} kcal`}
            onClick={() => onSelect(day.key)}
          >
            <span>{day.label}</span>
            <span>{day.kcal}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
