import { describe, expect, it } from "vitest"
import {
  DEFAULT_HABIT_BIRTHDAY,
  habitMonthWindowStarts,
  sanitizeHabitBirthday,
} from "./habit-month-window"

function keys(dates: Date[]): string[] {
  return dates.map((d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
}

const oct6 = new Date(2026, 9, 6)
const apr1 = new Date(2026, 3, 1)

describe("habitMonthWindowStarts", () => {
  it("year to date includes October and stops at the current month", () => {
    const starts = habitMonthWindowStarts(oct6, "yearToDate", DEFAULT_HABIT_BIRTHDAY)
    expect(keys(starts)).toEqual([
      "2026-01",
      "2026-02",
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
    ])
    expect(keys(starts)).not.toContain("2026-11")
    expect(starts.every((d) => d.getDate() === 1)).toBe(true)
  })

  it("12 months is twelve columns ending this month", () => {
    const starts = habitMonthWindowStarts(oct6, "trailing12", DEFAULT_HABIT_BIRTHDAY)
    expect(starts).toHaveLength(12)
    expect(keys(starts)[0]).toBe("2025-11")
    expect(keys(starts).at(-1)).toBe("2026-10")
  })

  it("birthday window on 6 Oct 2026 is May through October", () => {
    const starts = habitMonthWindowStarts(oct6, "sinceBirthday", DEFAULT_HABIT_BIRTHDAY)
    expect(keys(starts)).toEqual(["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"])
  })

  it("birthday window on 1 Apr 2026 is May 2025 through April 2026", () => {
    const starts = habitMonthWindowStarts(apr1, "sinceBirthday", { month: 5, day: 5 })
    expect(keys(starts)[0]).toBe("2025-05")
    expect(keys(starts).at(-1)).toBe("2026-04")
    expect(starts).toHaveLength(12)
  })

  it("starts over on the birthday and keeps the previous year until that day", () => {
    expect(keys(habitMonthWindowStarts(new Date(2026, 4, 5), "sinceBirthday", DEFAULT_HABIT_BIRTHDAY))).toEqual([
      "2026-05",
    ])
    expect(keys(habitMonthWindowStarts(new Date(2026, 4, 4), "sinceBirthday", DEFAULT_HABIT_BIRTHDAY))[0]).toBe(
      "2025-05",
    )
    expect(keys(habitMonthWindowStarts(new Date(2026, 4, 4), "sinceBirthday", DEFAULT_HABIT_BIRTHDAY)).at(-1)).toBe(
      "2026-05",
    )
  })

  it("span input uses the same list as the sheet columns", () => {
    const mode = "yearToDate" as const
    const columns = habitMonthWindowStarts(oct6, mode, DEFAULT_HABIT_BIRTHDAY)
    const spanInput = habitMonthWindowStarts(oct6, mode, DEFAULT_HABIT_BIRTHDAY)
    expect(spanInput.map((d) => d.getTime())).toEqual(columns.map((d) => d.getTime()))
    expect(keys(spanInput).at(-1)).toBe("2026-10")
    expect(keys(habitMonthWindowStarts(oct6, "sinceBirthday", DEFAULT_HABIT_BIRTHDAY))).toEqual(
      keys(habitMonthWindowStarts(oct6, "sinceBirthday", DEFAULT_HABIT_BIRTHDAY)),
    )
  })

  it("fills a missing birthday with 5 May", () => {
    expect(sanitizeHabitBirthday(undefined)).toEqual({ month: 5, day: 5 })
    expect(sanitizeHabitBirthday({ month: 5, day: 5 })).toEqual({ month: 5, day: 5 })
    expect(keys(habitMonthWindowStarts(oct6, "sinceBirthday", sanitizeHabitBirthday(null)))).toEqual(
      keys(habitMonthWindowStarts(oct6, "sinceBirthday", DEFAULT_HABIT_BIRTHDAY)),
    )
  })
})
