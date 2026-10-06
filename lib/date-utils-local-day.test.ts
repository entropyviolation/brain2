import { describe, expect, it } from "vitest"
import {
  canonicalWeekKey,
  dateInputValue,
  dateKeyOf,
  endOfLocalDay,
  isPastLocalCalendarDay,
  localMidnightFromUtcDateOnly,
  parseWeekString,
  sameWeekKey,
  startOfLocalDay,
  startOfLocalToday,
  toLocalCalendarDate,
} from "./date-utils"
import { periodKeyFor, periodKeysFromDateKeys } from "./period-keys"

describe("startOfLocalToday / isPastLocalCalendarDay", () => {
  const now = new Date(2026, 8, 21, 15, 30)

  it("startOfLocalDay is the canonical local midnight (same as toLocalCalendarDate)", () => {
    const afternoon = new Date(2026, 8, 21, 15, 30)
    expect(startOfLocalDay(afternoon)).toEqual(toLocalCalendarDate(afternoon))
    expect(startOfLocalDay(afternoon).getHours()).toBe(0)
    expect(startOfLocalDay("2026-09-21")).toEqual(new Date(2026, 8, 21))
  })

  it("endOfLocalDay is the last ms of that local calendar day", () => {
    const end = endOfLocalDay(new Date(2026, 8, 21, 15, 30))
    expect(end.getFullYear()).toBe(2026)
    expect(end.getMonth()).toBe(8)
    expect(end.getDate()).toBe(21)
    expect(end.getHours()).toBe(23)
    expect(end.getMinutes()).toBe(59)
    expect(end.getSeconds()).toBe(59)
    expect(end.getMilliseconds()).toBe(999)
  })

  it("localMidnightFromUtcDateOnly keeps the UTC calendar day and leaves timed instants", () => {
    const utcMidnight = new Date("2026-09-21T00:00:00.000Z")
    const local = localMidnightFromUtcDateOnly(utcMidnight)
    expect(local.getFullYear()).toBe(2026)
    expect(local.getMonth()).toBe(8)
    expect(local.getDate()).toBe(21)
    expect(local.getHours()).toBe(0)
    expect(dateInputValue(local)).toBe("2026-09-21")

    const timed = new Date("2026-09-21T15:30:00.000Z")
    expect(localMidnightFromUtcDateOnly(timed)).toBe(timed)
  })

  it("dateKeyOf returns local YYYY-MM-DD or null", () => {
    expect(dateKeyOf(new Date(2026, 8, 18, 22))).toBe("2026-09-18")
    expect(dateKeyOf("2026-09-18")).toBe("2026-09-18")
    expect(dateKeyOf(null)).toBeNull()
    expect(dateKeyOf("not-a-date")).toBeNull()
  })

  it("startOfLocalToday is local midnight of now, not a selected date", () => {
    expect(startOfLocalToday(now)).toEqual(startOfLocalDay(now))
    expect(startOfLocalToday(now).getHours()).toBe(0)
  })

  it("treats days before local today as past and today as not past", () => {
    expect(isPastLocalCalendarDay(new Date(2026, 8, 20, 23, 59), now)).toBe(true)
    expect(isPastLocalCalendarDay(new Date(2026, 8, 21, 0, 0), now)).toBe(false)
    expect(isPastLocalCalendarDay(new Date(2026, 8, 22, 0, 0), now)).toBe(false)
  })

  it("parses a week range as local midnights", () => {
    const range = parseWeekString("2026-09-21_2026-09-27")
    expect(range?.start.getFullYear()).toBe(2026)
    expect(range?.start.getMonth()).toBe(8)
    expect(range?.start.getDate()).toBe(21)
    expect(range?.start.getHours()).toBe(0)
    expect(range?.end.getDate()).toBe(27)
  })

  it("folds a Sunday-start week onto the Monday week that contains its Wednesday", () => {
    expect(canonicalWeekKey("2026-09-21_2026-09-27")).toBe("2026-09-21_2026-09-27")
    expect(sameWeekKey("2026-08-30_2026-09-05", "2026-08-31_2026-09-06")).toBe(true)
    expect(sameWeekKey("2026-08-30_2026-09-05", "2026-09-07_2026-09-13")).toBe(false)
  })

  it("does not use a later selected day as the past cutoff", () => {
    const selected = new Date(2026, 8, 25, 12)
    expect(isPastLocalCalendarDay(new Date(2026, 8, 22), selected)).toBe(true)
    expect(isPastLocalCalendarDay(new Date(2026, 8, 22), now)).toBe(false)
  })
})

describe("period-keys", () => {
  const wed = new Date(2026, 8, 16, 12)

  it("periodKeyFor matches day / week / month / quarter / year identity", () => {
    expect(periodKeyFor("day", wed)).toBe("2026-09-16")
    expect(periodKeyFor("week", wed)).toBe("2026-09-14_2026-09-20")
    expect(periodKeyFor("month", wed)).toBe("2026-09")
    expect(periodKeyFor("quarter", wed)).toBe("2026-Q3")
    expect(periodKeyFor("year", wed)).toBe("2026")
  })

  it("periodKeysFromDateKeys dedupes in first-seen order", () => {
    const days = ["2026-09-14", "2026-09-16", "2026-09-21"]
    expect(periodKeysFromDateKeys("day", days)).toEqual(days)
    expect(periodKeysFromDateKeys("week", days)).toEqual([
      "2026-09-14_2026-09-20",
      "2026-09-21_2026-09-27",
    ])
    expect(periodKeysFromDateKeys("month", days)).toEqual(["2026-09"])
    expect(periodKeysFromDateKeys("quarter", days)).toEqual(["2026-Q3"])
  })
})
