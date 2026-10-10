/**
 * lib/tracking-summaries.test.ts — Period keys for retrospective summaries
 */
import { describe, expect, it } from "vitest"
import {
  daysOfWeek,
  monthSummaryKey,
  monthsOfSeason,
  seasonSummaryKey,
  seasonsOfYear,
  weekSummaryKey,
  weeksTouchingMonth,
  yearSummaryKey,
} from "./tracking-summaries"

describe("tracking summaries", () => {
  it("keys a week, month, season, and year apart from the day and from plan", () => {
    const monday = new Date(2026, 9, 5)
    expect(weekSummaryKey(monday)).toBe("week:2026-10-05_2026-10-11")
    expect(monthSummaryKey(2026, 9)).toBe("month:2026-10")
    expect(seasonSummaryKey(new Date(2026, 9, 10))).toBe("quarter:2026-Q4")
    expect(yearSummaryKey(2026)).toBe("year:2026")
    expect(weekSummaryKey(monday).startsWith("weekPlan-")).toBe(false)
  })

  it("lists the Monday weeks that touch October 2026", () => {
    const weeks = weeksTouchingMonth(2026, 9)
    expect(weeks.map((week) => week.getDate())).toEqual([28, 5, 12, 19, 26])
    expect(weeks[0]?.getMonth()).toBe(8)
    expect(weeks[1]?.getMonth()).toBe(9)
  })

  it("nests days under a week, months under a season, and seasons under a year", () => {
    const days = daysOfWeek(new Date(2026, 9, 7))
    expect(days).toHaveLength(7)
    expect(days[0]?.getDay()).toBe(1)
    const months = monthsOfSeason(new Date(2026, 9, 10))
    expect(months.map((month) => month.getMonth())).toEqual([9, 10, 11])
    expect(seasonsOfYear(2026).map((season) => season.label)).toEqual([
      "Spring 2026",
      "Summer 2026",
      "Fall 2026",
      "Winter 2026",
    ])
  })
})
