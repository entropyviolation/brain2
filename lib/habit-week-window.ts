/**
 * lib/habit-week-window.ts — Weekly Habits sheet window
 *
 * One list of Monday week-starts (oldest first) for the weekly spreadsheet
 * columns and the weekly span grade. Both call `habitWeekWindowStarts` so the
 * columns and the grade cannot drift. The week that contains `asOf` is included.
 * A week whose Monday is after that week is not a column, except **This month**,
 * which keeps every Monday that falls in the civil month.
 *
 * Seasons are the app quarters (Spring Jan–Mar, Summer Apr–Jun, Fall Jul–Sep,
 * Winter Oct–Dec), not the equinox. **This moon** is one synodic month from the
 * app's new-moon instant (`lib/lunar.ts`) to the next.
 */
import { getPrecedingWeekStarts, getWeekStartDate } from "@/lib/date-utils"
import { phaseInstantsNear } from "@/lib/lunar"
import { quarterKey, quarterStartDate } from "@/lib/seasons"

export const HABIT_WEEK_WINDOW_MODES = [
  "sevenWeeks",
  "thisMonth",
  "thisSeason",
  "fourWeeks",
  "thisMoon",
] as const

export type HabitWeekWindowMode = (typeof HABIT_WEEK_WINDOW_MODES)[number]

export const DEFAULT_HABIT_WEEK_WINDOW: HabitWeekWindowMode = "sevenWeeks"

export const HABIT_WEEK_WINDOW_LABELS: Record<HabitWeekWindowMode, string> = {
  sevenWeeks: "7 weeks",
  thisMonth: "This month",
  thisSeason: "This season",
  fourWeeks: "4 weeks",
  thisMoon: "This moon",
}

/** One line under the plate. The longer reading lives in the Habits README. */
export const HABIT_WEEK_WINDOW_HINTS: Record<HabitWeekWindowMode, string> = {
  sevenWeeks: "Forty-nine days",
  thisMonth: "Civil month",
  thisSeason: "App quarter",
  fourWeeks: "28 days",
  thisMoon: "New moon to new moon",
}

export function parseHabitWeekWindowMode(raw: unknown): HabitWeekWindowMode {
  return HABIT_WEEK_WINDOW_MODES.includes(raw as HabitWeekWindowMode)
    ? (raw as HabitWeekWindowMode)
    : DEFAULT_HABIT_WEEK_WINDOW
}

function atMidnight(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
}

/** New moon that opens the synodic month containing `asOf`, and the next new moon. */
export function habitWeekMoonSpan(asOf: Date): { start: Date; end: Date } {
  const t = asOf.getTime()
  const day = atMidnight(asOf)
  const seeds = [asOf, addDays(day, -40), addDays(day, 40)]
  const instants = seeds.flatMap((seed) => phaseInstantsNear(seed, "new"))
  const unique = [...new Map(instants.map((instant) => [instant.getTime(), instant])).values()].sort(
    (a, b) => a.getTime() - b.getTime(),
  )
  let start = unique[0]
  if (!start) throw new Error("habitWeekMoonSpan: no new moon")
  for (const instant of unique) {
    if (instant.getTime() <= t) start = instant
  }
  const end = unique.find((instant) => instant.getTime() > start.getTime())
  if (end) return { start, end }
  const later = phaseInstantsNear(new Date(start.getTime() + 40 * 86_400_000), "new").find(
    (instant) => instant.getTime() > start.getTime(),
  )
  if (!later) throw new Error("habitWeekMoonSpan: no following new moon")
  return { start, end: later }
}

/** Mondays that fall inside the civil month of `asOf`. Oldest first. */
function monthMondays(asOf: Date): Date[] {
  const year = asOf.getFullYear()
  const month = asOf.getMonth()
  let cursor = getWeekStartDate(new Date(year, month, 1))
  if (cursor.getFullYear() !== year || cursor.getMonth() !== month) cursor = addDays(cursor, 7)
  const out: Date[] = []
  while (cursor.getFullYear() === year && cursor.getMonth() === month) {
    out.push(cursor)
    cursor = addDays(cursor, 7)
  }
  return out
}

/**
 * Mondays that fall in the app quarter of `asOf`, through the week that
 * contains `asOf`. A Monday in the previous or next quarter is not included.
 */
function seasonMondays(asOf: Date): Date[] {
  const start = quarterStartDate(asOf)
  const cap = getWeekStartDate(asOf).getTime()
  const key = quarterKey(start)
  let cursor = getWeekStartDate(start)
  if (cursor.getTime() < start.getTime()) cursor = addDays(cursor, 7)
  const out: Date[] = []
  while (cursor.getTime() <= cap) {
    if (quarterKey(cursor) === key) out.push(cursor)
    else if (cursor.getTime() > start.getTime()) break
    cursor = addDays(cursor, 7)
  }
  return out
}

/**
 * Monday-weeks that overlap `[start, end)` and whose Monday is on or before
 * the week of `asOf`.
 */
function moonMondays(asOf: Date): Date[] {
  const span = habitWeekMoonSpan(asOf)
  const cap = getWeekStartDate(asOf).getTime()
  const newMoonDay = atMidnight(span.start)
  let cursor = getWeekStartDate(addDays(newMoonDay, -6))
  const out: Date[] = []
  while (cursor.getTime() <= cap) {
    const weekEnd = addDays(cursor, 7)
    if (cursor.getTime() < span.end.getTime() && weekEnd.getTime() > span.start.getTime()) {
      out.push(cursor)
    }
    cursor = addDays(cursor, 7)
  }
  return out
}

/**
 * Monday week-starts for the weekly sheet and the span-grade window.
 * Oldest first. Includes the week that contains `asOf`.
 */
export function habitWeekWindowStarts(asOf: Date, mode: HabitWeekWindowMode): Date[] {
  const resolved = parseHabitWeekWindowMode(mode)
  const monday = getWeekStartDate(asOf)
  if (resolved === "fourWeeks") return getPrecedingWeekStarts(monday, 4)
  if (resolved === "thisMonth") return monthMondays(asOf)
  if (resolved === "thisSeason") return seasonMondays(asOf)
  if (resolved === "thisMoon") return moonMondays(asOf)
  return getPrecedingWeekStarts(monday, 7)
}
