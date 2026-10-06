import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { formatLocalDateKey, getWeekDates } from "@/lib/date-utils"
import {
  accomplishmentBonusPoints,
  clampAccomplishmentBonus,
  clampAccomplishmentThreshold,
  collectAccomplishedDateKeys,
  DEFAULT_ACCOMPLISHMENT_BONUS,
  DEFAULT_ACCOMPLISHMENT_THRESHOLD,
  GOOD_DAYS_LOOKBACK,
  goodDaySummary,
  goodPeriodSummary,
  isAccomplishedDay,
  localCalendarDaysEndingOn,
  monthRawAverage,
  olderAverageComparedToToday,
  pointsStillNeeded,
  pointsStillNeededPhrase,
  priorCalendarDays,
  priorRawAverage,
  PRIOR_WEEK_DAYS,
  rawDayCompletionPercent,
  seasonRawAverage,
  weekRawAverage,
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

describe("pointsStillNeeded", () => {
  it("says 10 needed when raw completion is 40 and the line is 50", () => {
    expect(pointsStillNeeded(40, 50)).toEqual({ needed: 10, met: false })
    expect(pointsStillNeededPhrase(40, 50)).toContain("10 needed")
    expect(pointsStillNeededPhrase(40, 50, "week")).toContain("10 needed")
    expect(pointsStillNeededPhrase(40, 50, "week")).toContain("good week")
  })

  it("says met when raw completion is 50 and the line is 50", () => {
    expect(pointsStillNeeded(50, 50)).toEqual({ needed: 0, met: true })
    expect(pointsStillNeededPhrase(50, 50).toLowerCase()).toContain("met")
    expect(pointsStillNeededPhrase(50, 50)).toContain("good day")
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

  it("compares an older average to today as higher, same, or lower", () => {
    expect(olderAverageComparedToToday(40, 80)).toBe("lower")
    expect(olderAverageComparedToToday(80, 80)).toBe("same")
    expect(olderAverageComparedToToday(90, 40)).toBe("higher")
    expect(olderAverageComparedToToday(80.4, 79.6)).toBe("same")
    expect(olderAverageComparedToToday(80.6, 79.4)).toBe("higher")
  })

  it("averages raw completion for the 7 and 30 days before today", () => {
    const asOf = day(2026, 8, 17)
    expect(priorCalendarDays(asOf, PRIOR_WEEK_DAYS).map((d) => formatLocalDateKey(d))).toEqual([
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
    ])
    const weeklyData: Record<string, Record<string, { completed?: boolean; value?: number }>> = {}
    for (const d of priorCalendarDays(asOf, PRIOR_WEEK_DAYS)) {
      weeklyData[formatLocalDateKey(d)] = { water: { completed: true }, pages: { value: 0 } }
    }
    weeklyData[formatLocalDateKey(asOf)] = { water: { completed: true }, pages: { value: 10 } }
    expect(priorRawAverage(daily, weeklyData, asOf, PRIOR_WEEK_DAYS)).toBe(50)
    expect(priorRawAverage(daily, weeklyData, asOf, GOOD_DAYS_LOOKBACK)).toBeCloseTo((7 * 50) / 30)

    const ahead = goodDaySummary(daily, weeklyData, asOf, 80, 50)
    expect(ahead.todayCompletionRaw).toBe(100)
    expect(ahead.prior7Average).toBe(50)
    expect(ahead.prior7VsToday).toBe("lower")
    expect(ahead.prior30VsToday).toBe("lower")

    const evenData = { ...weeklyData, [formatLocalDateKey(asOf)]: { water: { completed: true }, pages: { value: 0 } } }
    const even = goodDaySummary(daily, evenData, asOf, 80, 50)
    expect(even.todayCompletionRaw).toBe(50)
    expect(even.prior7VsToday).toBe("same")

    const behind = goodDaySummary(daily, weeklyData, asOf, 80, 50, () => 0)
    expect(behind.todayRaw).toBe(0)
    expect(behind.todayCompletionRaw).toBe(100)
    expect(behind.prior7VsToday).toBe("lower")

    const emptyToday = { ...weeklyData }
    delete emptyToday[formatLocalDateKey(asOf)]
    for (const d of priorCalendarDays(asOf, PRIOR_WEEK_DAYS)) {
      emptyToday[formatLocalDateKey(d)] = { water: { completed: true }, pages: { value: 10 } }
    }
    const trailing = goodDaySummary(daily, emptyToday, asOf, 80, 50)
    expect(trailing.todayCompletionRaw).toBe(0)
    expect(trailing.prior7Average).toBe(100)
    expect(trailing.prior7VsToday).toBe("higher")
  })
})

describe("weekRawAverage", () => {
  it("divides an in-progress week by the days that have happened", () => {
    const monday = day(2026, 8, 14)
    const wednesday = day(2026, 8, 16)
    const weeklyData = {
      [formatLocalDateKey(monday)]: { water: { completed: true }, pages: { value: 10 } },
    }
    expect(weekRawAverage(daily, weeklyData, monday, wednesday)).toBeCloseTo(100 / 3, 5)
    const summary = goodDaySummary(daily, weeklyData, wednesday, 80, 50)
    expect(summary.weeks.thisWeek).toBeCloseTo(100 / 3, 5)
    expect(summary.yesterdayCompletionRaw).toBe(0)
  })

  it("divides a finished week by 7", () => {
    const monday = day(2026, 8, 7)
    const later = day(2026, 8, 20)
    const weeklyData = {
      [formatLocalDateKey(monday)]: { water: { completed: true }, pages: { value: 10 } },
    }
    expect(weekRawAverage(daily, weeklyData, monday, later)).toBeCloseTo(100 / 7, 5)
  })
})

describe("monthRawAverage and seasonRawAverage", () => {
  it("divides an in-progress month and season by the days that have happened", () => {
    const first = day(2026, 8, 1)
    const third = day(2026, 8, 3)
    const weeklyData = {
      [formatLocalDateKey(first)]: { water: { completed: true }, pages: { value: 10 } },
    }
    expect(monthRawAverage(daily, weeklyData, first, third)).toBeCloseTo(100 / 3, 5)
    const july = day(2026, 6, 1)
    const julyThird = day(2026, 6, 3)
    const seasonData = {
      [formatLocalDateKey(july)]: { water: { completed: true }, pages: { value: 10 } },
    }
    expect(seasonRawAverage(daily, seasonData, july, julyThird)).toBeCloseTo(100 / 3, 5)
  })
})

describe("goodPeriodSummary", () => {
  const full = { water: { completed: true }, pages: { value: 10 } }
  const half = { water: { completed: true }, pages: { value: 0 } }

  function fillWeek(weeklyData: Record<string, Record<string, { completed?: boolean; value?: number }>>, monday: Date, cell: { completed?: boolean; value?: number } | Record<string, { completed?: boolean; value?: number }>) {
    for (const date of getWeekDates(monday)) {
      weeklyData[formatLocalDateKey(date)] = cell as Record<string, { completed?: boolean; value?: number }>
    }
  }

  it("counts a week whose raw average equals the line as good", () => {
    const monday = day(2026, 8, 7)
    const sunday = day(2026, 8, 13)
    const weeklyData: Record<string, Record<string, { completed?: boolean; value?: number }>> = {}
    fillWeek(weeklyData, monday, half)
    expect(weekRawAverage(daily, weeklyData, monday, sunday)).toBe(50)
    const summary = goodPeriodSummary(daily, weeklyData, sunday, "week", 50)
    expect(summary.currentRaw).toBe(50)
    expect(summary.currentGood).toBe(true)
    expect(summary.pointsMet).toBe(true)
    expect(summary.lookback.find((row) => row.dateKey === "2026-09-07")?.good).toBe(true)
  })

  it("stops a streak of two good weeks at a bad one", () => {
    const weeklyData: Record<string, Record<string, { completed?: boolean; value?: number }>> = {}
    fillWeek(weeklyData, day(2026, 7, 31), full)
    fillWeek(weeklyData, day(2026, 8, 14), full)
    fillWeek(weeklyData, day(2026, 8, 21), full)
    const summary = goodPeriodSummary(daily, weeklyData, day(2026, 8, 27), "week", 80)
    expect(summary.currentGood).toBe(true)
    expect(summary.streak).toBe(2)
    expect(summary.longestStreak).toBe(2)
  })

  it("keeps two finished good weeks when this week is not yet good", () => {
    const weeklyData: Record<string, Record<string, { completed?: boolean; value?: number }>> = {}
    fillWeek(weeklyData, day(2026, 8, 14), full)
    fillWeek(weeklyData, day(2026, 8, 21), full)
    const summary = goodPeriodSummary(daily, weeklyData, day(2026, 8, 30), "week", 80)
    expect(summary.currentGood).toBe(false)
    expect(summary.streak).toBe(2)
    expect(summary.pointsPhrase).toContain("needed")
  })
})
