import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import {
  accomplishmentBonusPoints,
  clampAccomplishmentBonus,
  clampAccomplishmentThreshold,
  collectAccomplishedDateKeys,
  DEFAULT_ACCOMPLISHMENT_BONUS,
  DEFAULT_ACCOMPLISHMENT_THRESHOLD,
  GOOD_DAYS_LOOKBACK,
  goodDaySummary,
  isAccomplishedDay,
  localCalendarDaysEndingOn,
  rawDayCompletionPercent,
} from "./habit-accomplishment"

const water: WeeklyTask = { id: "water", name: "Water", type: TaskType.BOOLEAN, frequency: "daily" }
const pages: WeeklyTask = { id: "pages", name: "Pages", type: TaskType.GOAL, goal: 10, frequency: "daily" }
const daily = [water, pages]

function day(y: number, m: number, d: number) {
  return new Date(y, m, d)
}

describe("accomplishment clamps", () => {
  it("keeps threshold in 1–100 and bonus in 0–10000", () => {
    expect(clampAccomplishmentThreshold(80)).toBe(80)
    expect(clampAccomplishmentThreshold(0)).toBe(1)
    expect(clampAccomplishmentThreshold(140)).toBe(100)
    expect(clampAccomplishmentThreshold(Number.NaN)).toBe(DEFAULT_ACCOMPLISHMENT_THRESHOLD)
    expect(clampAccomplishmentBonus(50)).toBe(50)
    expect(clampAccomplishmentBonus(-3)).toBe(0)
    expect(clampAccomplishmentBonus(99_999)).toBe(10_000)
  })
})

describe("isAccomplishedDay", () => {
  it("treats the threshold as a minimum (80% is enough)", () => {
    expect(isAccomplishedDay(79.9, 80)).toBe(false)
    expect(isAccomplishedDay(80, 80)).toBe(true)
    expect(isAccomplishedDay(100, 80)).toBe(true)
    expect(isAccomplishedDay(0, 80)).toBe(false)
  })
})

describe("accomplishmentBonusPoints", () => {
  it("awards the configured bonus only on a good day", () => {
    expect(accomplishmentBonusPoints(80)).toBe(DEFAULT_ACCOMPLISHMENT_BONUS)
    expect(accomplishmentBonusPoints(79.9)).toBe(0)
    expect(accomplishmentBonusPoints(90, 90, 25)).toBe(25)
    expect(accomplishmentBonusPoints(89, 90, 25)).toBe(0)
  })
})

describe("rawDayCompletionPercent + good days", () => {
  const monday = day(2026, 8, 14)

  it("averages all daily habits for the column (partial goals count)", () => {
    const weeklyData = {
      [formatLocalDateKey(monday)]: {
        water: { completed: true },
        pages: { value: 5 },
      },
    }
    expect(rawDayCompletionPercent(daily, weeklyData, monday)).toBe(75)
  })

  it("counts a streak of days at or above the threshold and last-30 hits", () => {
    const asOf = day(2026, 8, 17)
    const weeklyData: Record<string, Record<string, { completed?: boolean; value?: number }>> = {}
    for (const d of [14, 15, 16, 17]) {
      const date = day(2026, 8, d)
      weeklyData[formatLocalDateKey(date)] = {
        water: { completed: true },
        pages: { value: 10 },
      }
    }
    const keys = collectAccomplishedDateKeys(daily, weeklyData, asOf, 80)
    expect(keys).toEqual(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17"])

    const summary = goodDaySummary(daily, weeklyData, asOf, 80, 50)
    expect(summary.streak).toBe(4)
    expect(summary.last30Count).toBe(4)
    expect(summary.last30).toHaveLength(GOOD_DAYS_LOOKBACK)
    expect(summary.todayGood).toBe(true)
    expect(summary.todayRaw).toBe(100)
  })

  it("does not count a day that misses the user threshold", () => {
    const asOf = day(2026, 8, 17)
    const weeklyData = {
      [formatLocalDateKey(asOf)]: {
        water: { completed: true },
        pages: { value: 5 },
      },
    }
    const summary = goodDaySummary(daily, weeklyData, asOf, 80, 50)
    expect(summary.todayRaw).toBe(75)
    expect(summary.todayGood).toBe(false)
    expect(summary.streak).toBe(0)
    expect(summary.last30Count).toBe(0)
  })

  it("walks local calendar days oldest-first ending on asOf", () => {
    const days = localCalendarDaysEndingOn(day(2026, 8, 17), 3)
    expect(days.map((d) => formatLocalDateKey(d))).toEqual(["2026-09-15", "2026-09-16", "2026-09-17"])
  })
})
