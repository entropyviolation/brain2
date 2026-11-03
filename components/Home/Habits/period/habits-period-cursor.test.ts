/** components/Home/Habits/period/habits-period-cursor.test.ts */
import { describe, expect, it } from "vitest"
import { formatLocalDateKey, getWeekDates } from "@/lib/date-utils"
import { monthAnchorFromDay, quarterAnchorFromDay, weekAnchorFromDay } from "@/lib/use-current-date"
import {
  habitsLensFromStored,
  habitsViewedMonth,
  habitsViewedQuarter,
  habitsViewedWeekStart,
  isOnCurrentPeriod,
  retainHabitsCursorDate,
  retainHabitsWeekDates,
} from "./habits-period-cursor"

describe("habitsViewedWeekStart", () => {
  const sunday = new Date(2026, 8, 27) // Sep 27, 2026 — current week Mon Sep 21

  it("uses the week containing asOf when storage is ignored (first paint)", () => {
    expect(formatLocalDateKey(habitsViewedWeekStart(sunday))).toBe("2026-09-21")
  })

  it("does not apply a persisted week on first paint (stored omitted)", () => {
    // Call site must omit `stored` during SSR/hydrate — same as passing nothing.
    const firstPaint = habitsViewedWeekStart(sunday)
    expect(formatLocalDateKey(firstPaint)).toBe("2026-09-21")
    expect(formatLocalDateKey(firstPaint)).not.toBe("2026-09-14")
  })

  it("restores a persisted previous week after mount", () => {
    const stored = new Date(2026, 8, 14) // Sep 14 — prior week
    expect(formatLocalDateKey(habitsViewedWeekStart(sunday, stored))).toBe("2026-09-14")
  })

  it("falls back to asOf when stored is null after mount", () => {
    expect(formatLocalDateKey(habitsViewedWeekStart(sunday, null))).toBe("2026-09-21")
  })
})

describe("retainHabitsCursorDate", () => {
  it("keeps the current date when the calendar key matches", () => {
    const current = new Date(2026, 8, 21, 0, 0, 0, 0)
    const next = new Date(2026, 8, 21, 15, 30, 0, 0)
    expect(retainHabitsCursorDate(current, next)).toBe(current)
    expect(next).not.toBe(current)
  })

  it("replaces the date when the calendar key differs", () => {
    const current = new Date(2026, 8, 21)
    const next = new Date(2026, 8, 14)
    expect(retainHabitsCursorDate(current, next)).toBe(next)
    expect(formatLocalDateKey(next)).toBe("2026-09-14")
  })

  it("does not allocate a new week when that Monday is already on screen", () => {
    const monday = new Date(2026, 8, 21)
    const week = getWeekDates(monday)
    const again = new Date(2026, 8, 21, 8, 0, 0, 0)
    expect(retainHabitsWeekDates(week, again)).toBe(week)
  })

  it("allocates a week when the Monday changes", () => {
    const week = getWeekDates(new Date(2026, 8, 21))
    const next = retainHabitsWeekDates(week, new Date(2026, 8, 14))
    expect(next).not.toBe(week)
    expect(formatLocalDateKey(next[0])).toBe("2026-09-14")
  })
})

describe("habitsViewedMonth / habitsViewedQuarter", () => {
  const asOf = new Date(2026, 8, 27)

  it("defaults month and season to asOf on first paint", () => {
    expect(formatLocalDateKey(habitsViewedMonth(asOf))).toBe("2026-09-01")
    expect(formatLocalDateKey(habitsViewedQuarter(asOf))).toBe("2026-07-01")
  })

  it("restores stored month and season after mount", () => {
    expect(formatLocalDateKey(habitsViewedMonth(asOf, new Date(2026, 7, 15)))).toBe("2026-08-01")
    expect(formatLocalDateKey(habitsViewedQuarter(asOf, new Date(2026, 3, 1)))).toBe("2026-04-01")
  })

  it("adapts shared Home-day anchors (not a second truth)", () => {
    expect(formatLocalDateKey(habitsViewedWeekStart(asOf))).toBe(formatLocalDateKey(weekAnchorFromDay(asOf)))
    expect(formatLocalDateKey(habitsViewedMonth(asOf))).toBe(formatLocalDateKey(monthAnchorFromDay(asOf)))
    expect(formatLocalDateKey(habitsViewedQuarter(asOf))).toBe(formatLocalDateKey(quarterAnchorFromDay(asOf)))
  })
})

describe("habitsLensFromStored", () => {
  const asOf = new Date(2026, 8, 27)

  it("returns null when stored is Home day's period", () => {
    expect(habitsLensFromStored(asOf, habitsViewedWeekStart(asOf), "week")).toBeNull()
    expect(habitsLensFromStored(asOf, habitsViewedMonth(asOf), "month")).toBeNull()
    expect(habitsLensFromStored(asOf, habitsViewedQuarter(asOf), "quarter")).toBeNull()
  })

  it("returns the offset when stored is another period", () => {
    const priorWeek = new Date(2026, 8, 14)
    const lens = habitsLensFromStored(asOf, priorWeek, "week")
    expect(lens).not.toBeNull()
    expect(formatLocalDateKey(lens!)).toBe("2026-09-14")
  })
})

describe("isOnCurrentPeriod", () => {
  const today = new Date(2026, 10, 1, 15, 30) // Sun Nov 1, 2026 — week of Mon Oct 26, Q4

  it("day: same calendar day only, whatever the clock", () => {
    expect(isOnCurrentPeriod(new Date(2026, 10, 1), "day", today)).toBe(true)
    expect(isOnCurrentPeriod(new Date(2026, 10, 1, 23, 59), "day", today)).toBe(true)
    expect(isOnCurrentPeriod(new Date(2026, 9, 31), "day", today)).toBe(false)
  })

  it("week: any day of the Monday week that holds today", () => {
    expect(isOnCurrentPeriod(new Date(2026, 9, 26), "week", today)).toBe(true)
    expect(isOnCurrentPeriod(new Date(2026, 9, 29), "week", today)).toBe(true)
    expect(isOnCurrentPeriod(new Date(2026, 10, 2), "week", today)).toBe(false)
    expect(isOnCurrentPeriod(new Date(2026, 9, 25), "week", today)).toBe(false)
  })

  it("month: the same month, not the same month of another year", () => {
    expect(isOnCurrentPeriod(new Date(2026, 10, 1), "month", today)).toBe(true)
    expect(isOnCurrentPeriod(new Date(2026, 10, 30), "month", today)).toBe(true)
    expect(isOnCurrentPeriod(new Date(2026, 9, 31), "month", today)).toBe(false)
    expect(isOnCurrentPeriod(new Date(2025, 10, 1), "month", today)).toBe(false)
  })

  it("season: the calendar quarter that holds today", () => {
    expect(isOnCurrentPeriod(new Date(2026, 9, 1), "season", today)).toBe(true)
    expect(isOnCurrentPeriod(new Date(2026, 11, 31), "season", today)).toBe(true)
    expect(isOnCurrentPeriod(new Date(2026, 8, 30), "season", today)).toBe(false)
    expect(isOnCurrentPeriod(new Date(2027, 0, 1), "season", today)).toBe(false)
  })
})
