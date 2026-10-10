/**
 * lib/tracking-summaries.ts — Period keys for retrospective summaries
 *
 * Day summaries stay on the calendar-day key inside `brain2-tracking-day-notes`
 * (`lib/day-notes-persist.ts`), so an existing jot becomes the day summary.
 * Week, month, season, and year summaries use the same map, with a prefix the
 * day keys never use. The shape follows Plan’s period keys (`weekPlan-`,
 * `monthPlan-`, `quarterPlan-`) but the data stays here — a summary is what
 * happened, and it is not the plan log.
 *
 * Tracking has day and week boards. Month, season, and year have no grid;
 * their summaries are still stored, and the summary well edits them.
 * A season is a calendar quarter (`YYYY-Qn`), the same key rituals already use.
 */
import { getWeekDates, getWeekStartDate, getWeekString } from "@/lib/date-utils"
import { quarterKey, seasonOfDate } from "@/lib/seasons"

export type SummaryPeriod = "day" | "week" | "month" | "season" | "year"

export const SUMMARY_PERIODS: SummaryPeriod[] = ["day", "week", "month", "season", "year"]

export function weekSummaryKey(weekStart: Date): string {
  return `week:${getWeekString(getWeekStartDate(weekStart))}`
}

export function monthSummaryKey(year: number, monthIndex: number): string {
  return `month:${year}-${String(monthIndex + 1).padStart(2, "0")}`
}

export function monthSummaryKeyFromDate(date: Date): string {
  return monthSummaryKey(date.getFullYear(), date.getMonth())
}

/** Season storage uses the quarter key. The label in the UI says Season. */
export function seasonSummaryKey(date: Date): string {
  return `quarter:${quarterKey(date)}`
}

export function yearSummaryKey(year: number): string {
  return `year:${year}`
}

/** Monday weeks that contain at least one day of the month. Oldest first. */
export function weeksTouchingMonth(year: number, monthIndex: number): Date[] {
  const first = new Date(year, monthIndex, 1)
  const last = new Date(year, monthIndex + 1, 0)
  const weeks: Date[] = []
  const cursor = getWeekStartDate(first)
  while (cursor <= last) {
    weeks.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 7)
  }
  return weeks
}

export function daysOfWeek(anchor: Date): Date[] {
  return getWeekDates(getWeekStartDate(anchor))
}

export function monthsOfSeason(anchor: Date): Date[] {
  const start = new Date(anchor.getFullYear(), Math.floor(anchor.getMonth() / 3) * 3, 1)
  return [0, 1, 2].map((i) => new Date(start.getFullYear(), start.getMonth() + i, 1))
}

export function seasonsOfYear(year: number): { anchor: Date; label: string; storageKey: string }[] {
  return [0, 1, 2, 3].map((quarter) => {
    const anchor = new Date(year, quarter * 3, 1)
    return {
      anchor,
      label: `${seasonOfDate(anchor)} ${year}`,
      storageKey: seasonSummaryKey(anchor),
    }
  })
}
