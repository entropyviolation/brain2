/**
 * lib/habit-period-pace.ts — How much of a habit period has already happened
 *
 * Coverage cells keep the full-period occupancy on the top line. The line under
 * it is that occupancy divided by the fraction of the period that has passed:
 * the share of time already lived that has been logged. Only the period that
 * contains `now` has a pace; a finished period is the top number alone.
 */
import {
  formatLocalDateKey,
  getWeekStartDate,
  isSameLocalMonth,
  isSameLocalWeek,
  startOfLocalDay,
} from "./date-utils"
import { quarterKey, quarterStartDate, shiftQuarter } from "./seasons"
import type { HabitFrequency } from "./types"

const DAY_MS = 86_400_000

export function isCurrentHabitPeriod(
  frequency: HabitFrequency | undefined,
  periodDate: Date,
  now: Date = new Date(),
): boolean {
  const freq = frequency || "daily"
  if (freq === "weekly") return isSameLocalWeek(periodDate, now)
  if (freq === "monthly") return isSameLocalMonth(periodDate, now)
  if (freq === "quarterly") return quarterKey(periodDate) === quarterKey(now)
  return formatLocalDateKey(periodDate) === formatLocalDateKey(now)
}

/** 0–1 of the full period that has elapsed by `now`. Finished periods are 1. */
export function periodElapsedFraction(
  frequency: HabitFrequency | undefined,
  periodDate: Date,
  now: Date = new Date(),
): number {
  const freq = frequency || "daily"
  if (freq === "weekly") {
    const start = getWeekStartDate(periodDate)
    const span = 7 * DAY_MS
    return clampFraction((now.getTime() - start.getTime()) / span)
  }
  if (freq === "monthly") {
    const start = new Date(periodDate.getFullYear(), periodDate.getMonth(), 1)
    const end = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, 1)
    return clampFraction((now.getTime() - start.getTime()) / (end.getTime() - start.getTime()))
  }
  if (freq === "quarterly") {
    const start = quarterStartDate(periodDate)
    const end = shiftQuarter(start, 1)
    return clampFraction((now.getTime() - start.getTime()) / (end.getTime() - start.getTime()))
  }
  const start = startOfLocalDay(periodDate)
  if (formatLocalDateKey(periodDate) !== formatLocalDateKey(now)) {
    return formatLocalDateKey(periodDate) < formatLocalDateKey(now) ? 1 : 0
  }
  return clampFraction((now.getTime() - start.getTime()) / DAY_MS)
}

/**
 * Full-period occupancy (already a percent) divided by how far the period has
 * come. `null` when the period has not started, so the cell can hide the line.
 */
export function loggedShareOfElapsed(fullPeriodPercent: number, elapsedFraction: number): number | null {
  if (!(elapsedFraction > 0.001)) return null
  if (!Number.isFinite(fullPeriodPercent)) return null
  const share = fullPeriodPercent / elapsedFraction
  if (!Number.isFinite(share)) return null
  return Math.max(0, share)
}

function clampFraction(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.min(1, Math.max(0, value))
}
