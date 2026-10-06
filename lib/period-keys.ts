/**
 * lib/period-keys.ts — Canonical period-key identity
 *
 * Day / week / month / quarter / year keys used by Objectives, To Do marks,
 * Analytics windows, and Plan-vs-Reality. Lives beside `date-utils` (not inside
 * it) because quarter keys need `seasons.quarterKey`, and `seasons` already
 * imports date-utils — putting both in one file would cycle.
 *
 * Display labels (nav chrome, week ranges) stay at their call sites; they
 * intentionally differ by surface.
 */
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  getWeekString,
  parseLocalDate,
} from "@/lib/date-utils"
import { quarterKey } from "@/lib/seasons"

/** Periods that have a stable string key for a calendar date. */
export type PeriodKeyKind = "day" | "week" | "month" | "quarter" | "year"

/**
 * Canonical period key for a date:
 *   day     → YYYY-MM-DD (local)
 *   week    → getWeekString (Monday-start range)
 *   month   → YYYY-MM
 *   quarter → YYYY-Qn
 *   year    → YYYY
 */
export function periodKeyFor(period: PeriodKeyKind, date: Date = new Date()): string {
  switch (period) {
    case "day":
      return formatLocalDateKey(date)
    case "week":
      return getWeekString(date)
    case "month":
      return formatLocalMonthKey(date)
    case "quarter":
      return quarterKey(date)
    case "year":
      return `${date.getFullYear()}`
  }
}

/**
 * Unique period keys covering an inclusive list of local date keys, in first-
 * seen order. Month uses the `YYYY-MM` prefix of the day key (same as
 * `formatLocalMonthKey` for a parsed day).
 */
export function periodKeysFromDateKeys(
  period: Exclude<PeriodKeyKind, "year">,
  dateKeys: readonly string[],
): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const key of dateKeys) {
    let periodKey = key
    if (period === "week") {
      const d = parseLocalDate(key)
      if (!d) continue
      periodKey = getWeekString(d)
    } else if (period === "month") {
      periodKey = key.slice(0, 7)
    } else if (period === "quarter") {
      const d = parseLocalDate(key)
      if (!d) continue
      periodKey = quarterKey(d)
    }
    if (seen.has(periodKey)) continue
    seen.add(periodKey)
    out.push(periodKey)
  }
  return out
}
