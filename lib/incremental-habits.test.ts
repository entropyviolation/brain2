import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyData, type WeeklyTask } from "./types"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "./date-utils"
import {
  WEEKLY_INCREMENT_MIN_DAYS,
  dailyCommittedBefore,
  dailyGoalOn,
  incrementalDayPercentage,
  incrementalLoggedValue,
  incrementalWeekPercentage,
  isIncrementalCompleteOn,
  migrateIncrementalHabits,
  normalizeIncrementalData,
  weeklyGoalOn,
} from "./incremental-habits"

function day(year: number, monthIndex: number, date: number): Date {
  return new Date(year, monthIndex, date)
}

function data(entries: Array<[Date, number]>, taskId = "h1"): WeeklyData {
  const weekly: WeeklyData = {}
  for (const [date, value] of entries) {
    const key = formatLocalDateKey(date)
    weekly[key] = { ...(weekly[key] || {}), [taskId]: { value } }
  }
  return weekly
}

const monday = day(2026, 8, 14) // 14 Sep 2026
const week = getWeekDates(getWeekStartDate(monday))

describe("normalizeIncrementalData", () => {
  it("keeps the new cadence shape", () => {
    expect(
      normalizeIncrementalData({ cadence: "weekly", startValue: 2, increment: 1, unit: "minutes" }),
    ).toEqual({ cadence: "weekly", startValue: 2, increment: 1, unit: "minutes", startedOn: undefined })
  })

  it("maps legacy meditation-style maps to weekly cadence", () => {
    expect(
      normalizeIncrementalData({ currentValues: { meditation: 4 }, weeklyIncrement: { meditation: 1 } }),
    ).toMatchObject({ cadence: "weekly", startValue: 4, increment: 1, unit: "minutes" })
  })

  it("maps legacy chess-style maps to daily cadence", () => {
    expect(
      normalizeIncrementalData({ currentValues: { match: 265 }, weeklyIncrement: { match: 10 } }),
    ).toMatchObject({ cadence: "daily", startValue: 265, increment: 10 })
  })
})

describe("weekly cadence (meditation)", () => {
  const task: WeeklyTask = {
    id: "h1",
    name: "Meditate",
    type: TaskType.INCREMENTAL,
    rewardValue: 10,
    incrementalData: { cadence: "weekly", startValue: 2, increment: 1, unit: "minutes", startedOn: "2026-09-14" },
  }

  it("keeps the same goal when fewer than 4 days hit last week", () => {
    const weeklyData = data([
      [week[0], 2],
      [week[1], 2],
      [week[2], 2],
    ])
    expect(weeklyGoalOn(task, weeklyData, addDays(monday, 7))).toBe(2)
  })

  it("increments on the next Monday after 4 completed days, ignoring overshoot", () => {
    const weeklyData = data([
      [week[0], 20],
      [week[1], 2],
      [week[2], 2],
      [week[3], 2],
    ])
    expect(WEEKLY_INCREMENT_MIN_DAYS).toBe(4)
    expect(weeklyGoalOn(task, weeklyData, week[3])).toBe(2)
    expect(weeklyGoalOn(task, weeklyData, addDays(monday, 7))).toBe(3)
  })

  it("treats a day as done when logged minutes meet that week's goal", () => {
    const weeklyData = data([[week[0], 2]])
    expect(isIncrementalCompleteOn(task, { value: 2 }, weeklyData, week[0])).toBe(true)
    expect(isIncrementalCompleteOn(task, { value: 1 }, weeklyData, week[0])).toBe(false)
  })
})

describe("daily cadence (chess score)", () => {
  const task: WeeklyTask = {
    id: "h1",
    name: "Chess",
    type: TaskType.INCREMENTAL,
    rewardValue: 10,
    incrementalData: { cadence: "daily", startValue: 200, increment: 10, unit: "rating", startedOn: "2026-09-14" },
  }

  it("holds the same daily goal when the user does not play", () => {
    expect(dailyGoalOn(task, {}, week[0])).toBe(210)
    expect(dailyGoalOn(task, {}, week[1])).toBe(210)
  })

  it("uses the last logged score as the next day's base, including drops", () => {
    const weeklyData = data([
      [week[0], 300],
      [week[1], 310],
    ])
    expect(dailyCommittedBefore(task, weeklyData, week[0])).toBe(200)
    expect(dailyGoalOn(task, weeklyData, week[0])).toBe(210)
    expect(dailyCommittedBefore(task, weeklyData, week[1])).toBe(300)
    expect(dailyGoalOn(task, weeklyData, week[1])).toBe(310)
    expect(isIncrementalCompleteOn(task, { value: 300 }, weeklyData, week[0])).toBe(true)
    expect(isIncrementalCompleteOn(task, { value: 310 }, weeklyData, week[1])).toBe(true)
  })

  it("lowers the next day's target when today's log is below the previous score", () => {
    const chess: WeeklyTask = {
      ...task,
      incrementalData: { cadence: "daily", startValue: 305, increment: 10, unit: "rating", startedOn: "2026-09-14" },
    }
    const weeklyData = data([[week[0], 300]])
    expect(dailyGoalOn(chess, weeklyData, week[0])).toBe(315)
    expect(isIncrementalCompleteOn(chess, { value: 300 }, weeklyData, week[0])).toBe(false)
    expect(dailyGoalOn(chess, weeklyData, week[1])).toBe(310)
  })

  it("does not move the target on a skipped day", () => {
    const weeklyData = data([[week[0], 250]])
    expect(dailyGoalOn(task, weeklyData, week[1])).toBe(260)
    expect(dailyGoalOn(task, weeklyData, week[2])).toBe(260)
  })

  it("scores the week as gain vs increment × 7", () => {
    const weeklyData = data([[week[1], 250]])
    const pct = incrementalWeekPercentage(task, weeklyData, week)
    expect(pct).toBeCloseTo((50 / 70) * 100, 5)
  })

  it("treats a day that does not beat last score + increment as 0% when at or below last score", () => {
    const weeklyData = data([
      [week[1], 250],
      [week[2], 240],
    ])
    expect(incrementalDayPercentage(task, { value: 240 }, weeklyData, week[2])).toBe(0)
    expect(incrementalDayPercentage(task, { value: 250 }, weeklyData, week[1])).toBe(100)
    expect(dailyGoalOn(task, weeklyData, week[3])).toBe(250)
  })
})

describe("legacy values", () => {
  it("reads incrementalValues when value is missing", () => {
    expect(incrementalLoggedValue({ incrementalValues: { match: 265 } })).toBe(265)
  })

  it("splits multi-metric habits and copies per-key logs", () => {
    const { tasks, weeklyData } = migrateIncrementalHabits(
      [
        {
          id: "task-7",
          name: "Chess",
          type: TaskType.INCREMENTAL,
          rewardValue: 40,
          incrementalData: {
            currentValues: { match: 265, puzzle: 850 },
            weeklyIncrement: { match: 10, puzzle: 10 },
          },
        },
      ],
      {
        "2026-09-14": { "task-7": { incrementalValues: { match: 270, puzzle: 860 } } },
      },
    )
    expect(tasks).toHaveLength(2)
    expect(tasks[0].incrementalData).toMatchObject({ cadence: "daily", startValue: 265, increment: 10 })
    expect(tasks[1].id).toBe("task-7-puzzle")
    expect(weeklyData["2026-09-14"]["task-7"].value).toBe(270)
    expect(weeklyData["2026-09-14"]["task-7-puzzle"].value).toBe(860)
  })
})

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
