import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import {
  DAILY_HABIT_COMPLETION_POINTS,
  dailyHabitDayPoints,
  GRADE_BONUS_BOTH,
  GRADE_BONUS_EITHER,
  gradeBonusPoints,
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

describe("rawDayBonusPoints", () => {
  it("awards 50 only when raw day score is strictly above 80%", () => {
    expect(rawDayBonusPoints(80)).toBe(0)
    expect(rawDayBonusPoints(80.1)).toBe(RAW_DAY_BONUS)
    expect(rawDayBonusPoints(100)).toBe(RAW_DAY_BONUS)
    expect(rawDayBonusPoints(0)).toBe(0)
  })
})
