import { describe, expect, it } from "vitest"
import { phaseInstantsNear } from "./lunar"
import {
  DEFAULT_HABIT_WEEK_WINDOW,
  habitWeekMoonSpan,
  habitWeekWindowStarts,
  parseHabitWeekWindowMode,
} from "./habit-week-window"

function keys(dates: Date[]): string[] {
  return dates.map(
    (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
  )
}

const oct6 = new Date(2026, 9, 6)

describe("habitWeekWindowStarts", () => {
  it("seven weeks ends on the week of 5 Oct 2026 and has 7 starts", () => {
    const starts = habitWeekWindowStarts(oct6, "sevenWeeks")
    expect(starts).toHaveLength(7)
    expect(keys(starts)).toEqual([
      "2026-08-24",
      "2026-08-31",
      "2026-09-07",
      "2026-09-14",
      "2026-09-21",
      "2026-09-28",
      "2026-10-05",
    ])
    expect(starts.every((d) => d.getDay() === 1)).toBe(true)
    expect(keys(starts).at(-1)).toBe("2026-10-05")
  })

  it("thisMonth for 6 Oct 2026 is the four October Mondays", () => {
    expect(keys(habitWeekWindowStarts(oct6, "thisMonth"))).toEqual([
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
      "2026-10-26",
    ])
  })

  it("thisSeason for 6 Oct 2026 starts at Oct 5 and skips September and January", () => {
    const starts = habitWeekWindowStarts(oct6, "thisSeason")
    expect(keys(starts)).toEqual(["2026-10-05"])
    expect(keys(starts).some((key) => key.startsWith("2026-09"))).toBe(false)
    expect(keys(starts).some((key) => key.startsWith("2027-01") || key.startsWith("2026-01"))).toBe(false)
  })

  it("four weeks has 4 and ends on Oct 5", () => {
    const starts = habitWeekWindowStarts(oct6, "fourWeeks")
    expect(starts).toHaveLength(4)
    expect(keys(starts)).toEqual(["2026-09-14", "2026-09-21", "2026-09-28", "2026-10-05"])
  })

  it("thisMoon's span is about 29–30 days and contains 6 Oct 2026", () => {
    const span = habitWeekMoonSpan(oct6)
    const days = (span.end.getTime() - span.start.getTime()) / 86_400_000
    expect(days).toBeGreaterThan(29)
    expect(days).toBeLessThan(30)
    expect(span.start.getTime()).toBeLessThanOrEqual(oct6.getTime())
    expect(span.end.getTime()).toBeGreaterThan(oct6.getTime())

    const starts = habitWeekWindowStarts(oct6, "thisMoon")
    expect(starts.length).toBeGreaterThan(0)
    expect(starts.every((d) => d.getDay() === 1)).toBe(true)
    expect(starts.every((d) => d.getTime() <= new Date(2026, 9, 5).getTime())).toBe(true)
    expect(keys(starts)).toContain("2026-10-05")
    for (const monday of starts) {
      const weekEnd = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 7)
      expect(monday.getTime() < span.end.getTime() && weekEnd.getTime() > span.start.getTime()).toBe(true)
    }
  })

  it("opens this moon on the app's new moon, including 8 April 2024", () => {
    const day = new Date(2024, 3, 10)
    const span = habitWeekMoonSpan(day)
    const near = phaseInstantsNear(day, "new")
    expect(near.some((instant) => instant.getTime() === span.start.getTime())).toBe(true)
    expect(span.start.getUTCFullYear()).toBe(2024)
    expect(span.start.getUTCMonth()).toBe(3)
    expect(span.start.getUTCDate()).toBe(8)
    expect(span.start.getTime()).toBeLessThanOrEqual(day.getTime())
    expect(span.end.getTime()).toBeGreaterThan(day.getTime())
  })

  it("span input uses the same list as the sheet columns", () => {
    for (const mode of ["sevenWeeks", "thisMonth", "thisSeason", "fourWeeks", "thisMoon"] as const) {
      const columns = habitWeekWindowStarts(oct6, mode)
      const spanInput = habitWeekWindowStarts(oct6, mode)
      expect(spanInput.map((d) => d.getTime())).toEqual(columns.map((d) => d.getTime()))
    }
    expect(keys(habitWeekWindowStarts(oct6, "sevenWeeks")).at(-1)).toBe("2026-10-05")
  })

  it("fills a missing mode with seven weeks", () => {
    expect(parseHabitWeekWindowMode(undefined)).toBe(DEFAULT_HABIT_WEEK_WINDOW)
    expect(parseHabitWeekWindowMode("trailing12")).toBe("sevenWeeks")
    expect(keys(habitWeekWindowStarts(oct6, parseHabitWeekWindowMode(null)))).toEqual(
      keys(habitWeekWindowStarts(oct6, "sevenWeeks")),
    )
  })
})
