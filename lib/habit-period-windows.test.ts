import { describe, expect, it } from "vitest"
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  getMonthDates,
  getWeekDates,
  getWeekStartDate,
  getWeekString,
  parseLocalDate,
} from "./date-utils"
import { periodWindowsForFrequency } from "./habit-period-windows"
import { monthKeysInQuarter, quarterKey, quarterStartDate } from "./seasons"

const DAY = "2026-09-17"
const date = new Date(2026, 8, 17)

describe("periodWindowsForFrequency", () => {
  it("daily: one window per unique day key", () => {
    const windows = periodWindowsForFrequency("daily", [DAY, DAY, "2026-09-18"])
    expect(windows.map((w) => w.periodKey)).toEqual([DAY, "2026-09-18"])
    expect(windows[0]).toMatchObject({ keys: [DAY], periodKey: DAY })
    expect(formatLocalDateKey(windows[0].anchor)).toBe(DAY)
  })

  it("weekly: week string + seven day keys (byte-identical to date-utils)", () => {
    const start = getWeekStartDate(date)
    const weekKey = getWeekString(start)
    const windows = periodWindowsForFrequency("weekly", [DAY, "2026-09-18"])
    expect(windows).toHaveLength(1)
    expect(windows[0].periodKey).toBe(weekKey)
    expect(windows[0].keys).toEqual(getWeekDates(start).map(formatLocalDateKey))
    expect(getWeekString(windows[0].anchor)).toBe(weekKey)
  })

  it("monthly: YYYY-MM + month day keys", () => {
    const monthKey = formatLocalMonthKey(date)
    const monthStart = new Date(2026, 8, 1)
    const windows = periodWindowsForFrequency("monthly", [DAY, "2026-09-01"])
    expect(windows).toHaveLength(1)
    expect(windows[0].periodKey).toBe(monthKey)
    expect(windows[0].keys).toEqual(getMonthDates(monthStart).map(formatLocalDateKey))
  })

  it("quarterly: YYYY-Qn + all days in the quarter", () => {
    const start = quarterStartDate(date)
    const qKey = quarterKey(start)
    const expectedKeys = monthKeysInQuarter(qKey).flatMap((month) => {
      const [y, m] = month.split("-").map(Number)
      return getMonthDates(new Date(y, m - 1, 1)).map(formatLocalDateKey)
    })
    const windows = periodWindowsForFrequency("quarterly", [DAY, "2026-08-01"])
    expect(windows).toHaveLength(1)
    expect(windows[0].periodKey).toBe(qKey)
    expect(windows[0].periodKey).toBe("2026-Q3")
    expect(windows[0].keys).toEqual(expectedKeys)
    expect(quarterKey(windows[0].anchor)).toBe(qKey)
  })

  it("skips unparseable day keys", () => {
    expect(periodWindowsForFrequency("daily", ["not-a-date", DAY]).map((w) => w.periodKey)).toEqual([DAY])
    expect(parseLocalDate("not-a-date")).toBeNull()
  })

  it("defaults undefined frequency to daily", () => {
    expect(periodWindowsForFrequency(undefined, [DAY]).map((w) => w.periodKey)).toEqual([DAY])
  })
})
