/**
 * components/Home/Habits/habits-period-cursor.ts — Habits period lens adapter
 *
 * Period truth is the shared Home day (`lib/use-current-date.ts`). These
 * helpers only adapt that day into week / month / season anchors for Habits
 * milled chrome. They are not a second shell day.
 *
 * First paint (SSR + hydrate) must ignore localStorage so the week/month/
 * season label matches the server. Pass a stored date only after mount, and
 * only when it is a lens offset (a period other than Home day's). Cursor
 * setState compares `habitsCalendarKey` (YYYY-MM-DD). A new `Date` is never
 * `Object.is` to the one already on screen.
 */
import {
  monthAnchorFromDay,
  quarterAnchorFromDay,
  weekAnchorFromDay,
} from "@/lib/use-current-date"
import { formatLocalDateKey, getWeekDates } from "@/lib/date-utils"

/** Local calendar day (`YYYY-MM-DD`). */
export function habitsCalendarKey(date: Date): string {
  return formatLocalDateKey(date)
}

/** Keep `current` when `next` is the same calendar day. */
export function retainHabitsCursorDate(current: Date, next: Date): Date {
  return habitsCalendarKey(current) === habitsCalendarKey(next) ? current : next
}

/** Keep the week already on screen when `weekStart` is that week's Monday. */
export function retainHabitsWeekDates(current: Date[], weekStart: Date): Date[] {
  if (current.length > 0 && habitsCalendarKey(current[0]) === habitsCalendarKey(weekStart)) return current
  return getWeekDates(weekStart)
}

/** Week containing `asOf`, or the week of `stored` when provided (post-mount lens). */
export function habitsViewedWeekStart(asOf: Date, stored?: Date | null): Date {
  return weekAnchorFromDay(stored ?? asOf)
}

/** First-of-month for `asOf`, or for `stored` when provided (post-mount lens). */
export function habitsViewedMonth(asOf: Date, stored?: Date | null): Date {
  return monthAnchorFromDay(stored ?? asOf)
}

/** Season (quarter) start for `asOf`, or for `stored` when provided (post-mount lens). */
export function habitsViewedQuarter(asOf: Date, stored?: Date | null): Date {
  return quarterAnchorFromDay(stored ?? asOf)
}

/**
 * Restore a stored Habits period only when it is a real lens offset — a period
 * other than the one that contains Home `asOf`. Same period → follow the day.
 */
export function habitsLensFromStored(asOf: Date, stored: Date | null | undefined, kind: "week" | "month" | "quarter"): Date | null {
  if (!stored) return null
  const home =
    kind === "week"
      ? habitsViewedWeekStart(asOf)
      : kind === "month"
        ? habitsViewedMonth(asOf)
        : habitsViewedQuarter(asOf)
  const lens =
    kind === "week"
      ? habitsViewedWeekStart(asOf, stored)
      : kind === "month"
        ? habitsViewedMonth(asOf, stored)
        : habitsViewedQuarter(asOf, stored)
  return habitsCalendarKey(lens) === habitsCalendarKey(home) ? null : lens
}
