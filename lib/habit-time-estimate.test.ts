import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import {
  describeHabitTimeEstimate,
  habitDurationEstimate,
  habitLoggedAmount,
  habitUnitMinutes,
  isTimeMeasuredHabit,
} from "@/lib/habit-time-estimate"

const writing: WeeklyTask = {
  id: "write",
  name: "Write at least 3 pages per day",
  type: TaskType.GOAL,
  goal: 3,
  unit: "pages",
  frequency: "daily",
  timeEstimate: { minutesPerUnit: 10 },
}

const stretch: WeeklyTask = {
  id: "stretch",
  name: "Stretch",
  type: TaskType.BOOLEAN,
  frequency: "daily",
  timeEstimate: { minutes: 12 },
}

describe("habit time estimates", () => {
  it("scales the logged amount by the per-unit rate and flags it", () => {
    const duration = habitDurationEstimate(writing, { value: 4, completed: true })
    expect(duration).toMatchObject({ minutes: 40, kind: "rate", estimated: true })
    expect(duration?.basis).toBe("4 pages × 10 min each")
  })

  it("credits what was logged, not the goal", () => {
    expect(habitDurationEstimate(writing, { value: 3, completed: true })?.minutes).toBe(30)
    expect(habitDurationEstimate(writing, { value: 6, completed: true })?.minutes).toBe(60)
  })

  it("does not flag a definite length", () => {
    const definite: WeeklyTask = { ...writing, timeEstimate: { minutesPerUnit: 10, precision: "definite" } }
    expect(habitDurationEstimate(definite, { value: 4, completed: true })?.estimated).toBe(false)
  })

  it("treats a habit already measured in time as observed", () => {
    const work: WeeklyTask = { id: "work", name: "Work for 5 hours", type: TaskType.GOAL, goal: 5, unit: "hours" }
    const duration = habitDurationEstimate(work, { value: 4, completed: true })
    expect(duration).toMatchObject({ minutes: 240, kind: "logged", estimated: false })

    const clean: WeeklyTask = { id: "clean", name: "Clean 15 minutes", type: TaskType.GOAL, goal: 15, unit: "minutes" }
    expect(habitDurationEstimate(clean, { value: 20, completed: true })?.minutes).toBe(20)
  })

  it("prefers painted Tracking minutes over the rate, and does not flag them", () => {
    const duration = habitDurationEstimate(writing, { value: 4, completed: true, trackedValue: 0, manualValue: 0 }, 45)
    expect(duration).toMatchObject({ minutes: 45, kind: "tracked", estimated: false })
    expect(duration?.basis).toBe("45m painted in Tracking")
  })

  it("tops painted time up with a rate for the hand-logged remainder", () => {
    const duration = habitDurationEstimate(writing, { value: 4, manualValue: 2, trackedValue: 2 }, 30)
    expect(duration).toMatchObject({ minutes: 50, kind: "rate", estimated: true })
    expect(duration?.basis).toBe("30m painted in Tracking + 2 pages × 10 min each")
  })

  it("uses a flat length for Yes/No habits", () => {
    expect(habitDurationEstimate(stretch, { completed: true })).toMatchObject({
      minutes: 12,
      kind: "flat",
      estimated: true,
    })
    expect(habitDurationEstimate(stretch, { completed: false })).toBeNull()
  })

  it("returns nothing when the habit has no time component", () => {
    const plain: WeeklyTask = { id: "water", name: "Drink water", type: TaskType.BOOLEAN }
    expect(habitDurationEstimate(plain, { completed: true })).toBeNull()
  })

  it("reads the unit scale and the logged amount per habit type", () => {
    expect(habitUnitMinutes({ unit: "Minutes" })).toBe(1)
    expect(habitUnitMinutes({ unit: "hrs" })).toBe(60)
    expect(habitUnitMinutes({ unit: "pages" })).toBeNull()
    expect(isTimeMeasuredHabit(stretch)).toBe(false)
    expect(habitLoggedAmount(stretch, { completed: true })).toBe(1)
    expect(habitLoggedAmount(writing, { value: 4 })).toBe(4)
  })

  it("describes what a habit's estimate will produce", () => {
    expect(describeHabitTimeEstimate(writing)).toContain("A goal day (3) works out to 30m")
    expect(describeHabitTimeEstimate(writing)).toContain("flagged for confirmation")
    expect(describeHabitTimeEstimate(stretch)).toContain("12m per completion")
    expect(describeHabitTimeEstimate({ id: "x", name: "x", type: TaskType.BOOLEAN })).toContain("No time component")
  })
})
