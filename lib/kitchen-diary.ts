/**
 * lib/kitchen-diary.ts — Days logged, and a per-day trend
 *
 * Days logged is a count of consecutive local days that have an accepted
 * plate, walking back from today. A gap stops the count. The number is not
 * a judgment. The trend is the same plate totals, one row per day.
 */

import { formatLocalDateKey } from "@/lib/date-utils"

/** Consecutive days with an accepted plate, ending today or yesterday. */
export function daysLogged(dates: readonly string[], today: Date): number {
  const set = new Set(dates.filter((day) => /^\d{4}-\d{2}-\d{2}$/.test(day)))
  const cursor = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  if (!set.has(formatLocalDateKey(cursor))) cursor.setDate(cursor.getDate() - 1)
  let count = 0
  while (set.has(formatLocalDateKey(cursor))) {
    count += 1
    cursor.setDate(cursor.getDate() - 1)
    if (count > 3660) break
  }
  return count
}
