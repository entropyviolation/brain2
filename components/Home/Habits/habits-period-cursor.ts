/**
 * components/Home/Habits/habits-period-cursor.ts — Habits period nav cursor
 *
 * First paint (SSR + hydrate) must ignore localStorage so the week/month/
 * season label matches the server. Pass a stored date only after mount.
 * Cursor setState compares `habitsCalendarKey` (YYYY-MM-DD). A new `Date`
 * is never `Object.is` to the one already on screen.
 */
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "@/lib/date-utils"
import { quarterStartDate } from "@/lib/seasons"

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

/** Week containing `asOf`, or the week of `stored` when provided (post-mount). */
export function habitsViewedWeekStart(asOf: Date, stored?: Date | null): Date {
  return getWeekStartDate(stored ?? asOf)
}

/** First-of-month for `asOf`, or for `stored` when provided (post-mount). */
export function habitsViewedMonth(asOf: Date, stored?: Date | null): Date {
  const d = stored ?? asOf
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

/** Season (quarter) start for `asOf`, or for `stored` when provided (post-mount). */
export function habitsViewedQuarter(asOf: Date, stored?: Date | null): Date {
  return quarterStartDate(stored ?? asOf)
}
