/**
 * lib/habit-period-windows.ts — Unique period windows for habit sync
 *
 * Given a habit frequency and a bag of calendar day keys, return one window
 * per week / month / season / day those keys touch. Tracking minutes and
 * coverage % both expand the same windows; only the write target differs.
 */
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  getMonthDates,
  getWeekDates,
  getWeekStartDate,
  getWeekString,
  parseLocalDate,
} from "./date-utils"
import { monthKeysInQuarter, quarterKey, quarterStartDate } from "./seasons"
import type { WeeklyTask } from "./types"

export type HabitPeriodWindow = {
  /** Period start used as the store write anchor. */
  anchor: Date
  /** Every calendar day in the period (for rollups). */
  keys: string[]
  /** Bucket key in weekly / monthly / quarterly / daily habit data. */
  periodKey: string
}

/** Unique period windows touched by `dateKeys` for the given habit frequency. */
export function periodWindowsForFrequency(
  frequency: WeeklyTask["frequency"] | undefined,
  dateKeys: string[],
): HabitPeriodWindow[] {
  const freq = frequency || "daily"
  const out: HabitPeriodWindow[] = []
  const seen = new Set<string>()

  if (freq === "weekly") {
    for (const key of dateKeys) {
      const date = parseLocalDate(key)
      if (!date) continue
      const start = getWeekStartDate(date)
      const weekKey = getWeekString(start)
      if (seen.has(weekKey)) continue
      seen.add(weekKey)
      out.push({
        anchor: start,
        keys: getWeekDates(start).map(formatLocalDateKey),
        periodKey: weekKey,
      })
    }
    return out
  }

  if (freq === "monthly") {
    for (const key of dateKeys) {
      const date = parseLocalDate(key)
      if (!date) continue
      const monthKey = formatLocalMonthKey(date)
      if (seen.has(monthKey)) continue
      seen.add(monthKey)
      const start = new Date(date.getFullYear(), date.getMonth(), 1)
      out.push({
        anchor: start,
        keys: getMonthDates(start).map(formatLocalDateKey),
        periodKey: monthKey,
      })
    }
    return out
  }

  if (freq === "quarterly") {
    for (const key of dateKeys) {
      const date = parseLocalDate(key)
      if (!date) continue
      const start = quarterStartDate(date)
      const qKey = quarterKey(start)
      if (seen.has(qKey)) continue
      seen.add(qKey)
      const keys = monthKeysInQuarter(qKey).flatMap((month) => {
        const [y, m] = month.split("-").map(Number)
        return getMonthDates(new Date(y, m - 1, 1)).map(formatLocalDateKey)
      })
      out.push({ anchor: start, keys, periodKey: qKey })
    }
    return out
  }

  for (const key of dateKeys) {
    if (seen.has(key)) continue
    seen.add(key)
    const date = parseLocalDate(key)
    if (!date) continue
    out.push({ anchor: date, keys: [key], periodKey: key })
  }
  return out
}
