import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import {
  awardFace,
  awardReason,
  DAILY_HABIT_COMPLETION_POINTS,
  dailyHabitDayPoints,
  GRADE_BONUS_BOTH,
  GRADE_BONUS_EITHER,
  gradeBonusPoints,
  formatGradeLiftDelta,
  formatGradeLiftLastWeekCaption,
  formatGradeLiftYesterdayCaption,
  gradeLiftDelta,
  gradesBeatPrior,
  latestPointAward,
  RAW_DAY_BONUS,
  rawDayBeatsAverage,
  rawDayBeatsPrior,
  rawDayBonusPoints,
} from "./habit-points"

const date = new Date(2026, 8, 17)

describe("dailyHabitDayPoints", () => {
  it("awards 50 for a completed boolean and 0 when unchecked", () => {
    const task: WeeklyTask = { id: "a", name: "Water", type: TaskType.BOOLEAN, frequency: "daily" }
    expect(dailyHabitDayPoints(task, { completed: true }, {}, date)).toBe(DAILY_HABIT_COMPLETION_POINTS)
    expect(dailyHabitDayPoints(task, { completed: false }, {}, date)).toBe(0)
  })

  it("awards a fraction of 50 for a partial goal", () => {
    const task: WeeklyTask = { id: "g", name: "Pages", type: TaskType.GOAL, goal: 10, frequency: "daily" }
    expect(dailyHabitDayPoints(task, { value: 5 }, {}, date)).toBe(25)
    expect(dailyHabitDayPoints(task, { value: 10 }, {}, date)).toBe(50)
  })
})

describe("gradeBonusPoints", () => {
  it("awards 100 if either grade is 75%+ and 300 if both are", () => {
    expect(gradeBonusPoints(74, 74)).toBe(0)
    expect(gradeBonusPoints(75, 10)).toBe(GRADE_BONUS_EITHER)
    expect(gradeBonusPoints(10, 80)).toBe(GRADE_BONUS_EITHER)
    expect(gradeBonusPoints(75, 75)).toBe(GRADE_BONUS_BOTH)
  })
})

describe("rawDayBeatsAverage", () => {
  it("pays the edited amount only when today is strictly above that average", () => {
    expect(rawDayBeatsAverage(80, 70, 5, "week")).toEqual({
      points: 5,
      description: "Higher daily completion than the prior 7 days",
    })
    expect(rawDayBeatsAverage(80, 70, 12, "month")).toEqual({
      points: 12,
      description: "Higher daily completion than the last 30 days",
    })
    expect(rawDayBeatsAverage(70, 70, 5, "week").points).toBe(0)
    expect(rawDayBeatsAverage(60, 70, 5, "month").points).toBe(0)
    expect(rawDayBeatsAverage(80.4, 79.6, 5, "week").points).toBe(0)
    expect(rawDayBeatsAverage(90, 10, 0, "week").points).toBe(0)
  })
})

describe("rawDayBeatsPrior", () => {
  it("pays once when raw daily completion rises", () => {
    expect(rawDayBeatsPrior(40, 40, 25).points).toBe(0)
    expect(rawDayBeatsPrior(50, 40, 25)).toEqual({
      points: 25,
      description: "Higher daily completion than yesterday",
    })
    expect(rawDayBeatsPrior(39.4, 40.4, 25).points).toBe(0)
  })
})

describe("gradesBeatPrior", () => {
  it("pays once per rail grade that rose vs last week", () => {
    expect(gradesBeatPrior({ week: 10, output: 10 }, { week: 10, output: 10 }, 25, "week").points).toBe(0)
    expect(gradesBeatPrior({ week: 80, output: 10 }, { week: 40, output: 10 }, 25, "week")).toEqual({
      points: 25,
      description: "Higher week grade than last week",
    })
    expect(gradesBeatPrior({ week: 80, output: 90 }, { week: 40, output: 10 }, 25, "week")).toEqual({
      points: 50,
      description: "Higher habit grades than last week",
    })
    expect(gradesBeatPrior({ week: 70, output: 40 }, { week: 80, output: 10 }, 40, "week")).toEqual({
      points: 40,
      description: "Higher output grade than last week",
    })
    expect(gradesBeatPrior({ week: 74.6, output: 0 }, { week: 75.4, output: 0 }, 25, "week").points).toBe(0)
    expect(gradesBeatPrior({ week: 1, output: 1 }, { week: 0, output: 0 }, 0, "week").points).toBe(0)
  })
})

describe("grade-lift captions and deltas", () => {
  it("shows yesterday as one raw daily completion percent", () => {
    expect(formatGradeLiftYesterdayCaption(40.4)).toBe("Yesterday — 40% daily completion")
    expect(formatGradeLiftYesterdayCaption(null)).toBe("No prior day yet")
  })

  it("shows last week as week grade and perfect output", () => {
    expect(formatGradeLiftLastWeekCaption({ week: 51.2, output: 57.4 })).toBe(
      "Last week — week grade 51% · perfect output 57%",
    )
    expect(formatGradeLiftLastWeekCaption(null)).toBe("No prior week yet")
  })

  it("formats signed deltas with over / under / even", () => {
    expect(gradeLiftDelta(50, 40)).toBe(10)
    expect(gradeLiftDelta(30, 40)).toBe(-10)
    expect(formatGradeLiftDelta(10)).toBe("+10")
    expect(formatGradeLiftDelta(-10)).toBe("−10")
    expect(formatGradeLiftDelta(0)).toBe("0")
  })
})

describe("latestPointAward", () => {
  it("keeps the newest day and explains a plain title as a completion", () => {
    const latest = latestPointAward([
      { date: "2026-09-22", taskId: "a", points: 10, taskDescription: "Old" },
      { date: "2026-09-23", taskId: "b", points: 4, taskDescription: "Early" },
      { date: "2026-09-23", taskId: "habit-day:water:2026-09-23", points: 50, taskDescription: "Drink water" },
    ])
    expect(latest?.taskDescription).toBe("Drink water")
    expect(awardReason(latest!)).toBe("Completed Drink water")
    expect(awardFace(latest)).toEqual({ crt: "+50", footer: "Completed Drink water" })
    expect(awardFace(undefined)).toEqual({ crt: "—", footer: "No points yet" })
    expect(awardReason({ taskId: "habit-raw-day-bonus:2026-09-23", taskDescription: "Accomplishment bonus (80%+)" })).toBe(
      "Accomplishment bonus (80%+)",
    )
    expect(
      awardReason({
        taskId: "habit-weekly-avg-beat:2026-09-23",
        taskDescription: "Higher daily completion than the prior 7 days",
      }),
    ).toBe("Higher daily completion than the prior 7 days")
  })
})

describe("rawDayBonusPoints", () => {
  it("awards the bonus when raw day score meets the threshold (default 80%)", () => {
    expect(rawDayBonusPoints(80)).toBe(RAW_DAY_BONUS)
    expect(rawDayBonusPoints(79.9)).toBe(0)
    expect(rawDayBonusPoints(100)).toBe(RAW_DAY_BONUS)
    expect(rawDayBonusPoints(0)).toBe(0)
    expect(rawDayBonusPoints(90, 90, 25)).toBe(25)
    expect(rawDayBonusPoints(89, 90, 25)).toBe(0)
  })
})
