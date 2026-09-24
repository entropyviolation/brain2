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
  gradesBeatPrior,
  latestPointAward,
  RAW_DAY_BONUS,
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

describe("gradesBeatPrior", () => {
  it("pays once per grade that rose, and names which one", () => {
    expect(gradesBeatPrior({ week: 10, output: 10 }, { week: 10, output: 10 }, 25, "day").points).toBe(0)
    expect(gradesBeatPrior({ week: 80, output: 10 }, { week: 40, output: 10 }, 25, "day")).toEqual({
      points: 25,
      description: "Higher week grade than yesterday",
    })
    expect(gradesBeatPrior({ week: 80, output: 90 }, { week: 40, output: 10 }, 25, "day")).toEqual({
      points: 50,
      description: "Higher habit grades than yesterday",
    })
    expect(gradesBeatPrior({ week: 70, output: 40 }, { week: 80, output: 10 }, 40, "week")).toEqual({
      points: 40,
      description: "Higher weekly output than last week",
    })
    expect(gradesBeatPrior({ week: 74.6, output: 0 }, { week: 75.4, output: 0 }, 25, "day").points).toBe(0)
    expect(gradesBeatPrior({ week: 1, output: 1 }, { week: 0, output: 0 }, 0, "week").points).toBe(0)
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
