/**
 * lib/habit-completion-source.test.ts
 */
import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "./types"
import {
  applyLinkedFlag,
  clampCoverageThreshold,
  coverageDisplayAmount,
  coverageMeetsThreshold,
  dailyHabitsClearFloor,
  effectiveCoverageLink,
  effectiveDailyFloorLink,
  habitHiddenWhenComplete,
  presetCoverageLink,
  presetDailyFloorLink,
} from "./habit-completion-source"
import { formatLocalDateKey, getWeekDates, getWeekStartDate } from "./date-utils"

const weekStart = getWeekStartDate(new Date(2026, 8, 21))
const weekDates = getWeekDates(weekStart)

describe("coverage link", () => {
  it("presets log-75% habits and clamps the threshold", () => {
    expect(presetCoverageLink({ name: "Log 75% of the week", frequency: "weekly", type: TaskType.GOAL })).toEqual({
      threshold: 75,
      enabled: true,
    })
    expect(presetCoverageLink({ name: "Log 75% of the day", frequency: "daily", type: TaskType.GOAL })).toEqual({
      threshold: 75,
      enabled: true,
    })
    expect(clampCoverageThreshold(0)).toBe(1)
    expect(clampCoverageThreshold(140)).toBe(100)
    expect(coverageMeetsThreshold(75, 75)).toBe(true)
    expect(coverageMeetsThreshold(74.9, 75)).toBe(false)
    expect(effectiveCoverageLink({ name: "x", frequency: "weekly", type: TaskType.GOAL, coverageLink: null })).toBeNull()
  })

  it("autofill flag writes value and completes at threshold", () => {
    const next = applyLinkedFlag(undefined, "coverageCompleted", true, { value: 82, goal: 75 })
    expect(next).toEqual({
      completed: true,
      coverageCompleted: true,
      value: 82,
      goal: 75,
    })
    expect(applyLinkedFlag(next!, "coverageCompleted", true, { value: 82, goal: 75 })).toBeNull()
  })

  it("caps the coverage cell label at the threshold", () => {
    expect(coverageDisplayAmount(0, 75)).toBe(0)
    expect(coverageDisplayAmount(40, 75)).toBe(40)
    expect(coverageDisplayAmount(75, 75)).toBe(75)
    expect(coverageDisplayAmount(100, 75)).toBe(75)
    expect(coverageDisplayAmount(100, 50)).toBe(50)
    expect(coverageDisplayAmount(undefined, 75)).toBeUndefined()
  })
})

describe("daily floor link", () => {
  it("presets the no-0% weekly habit", () => {
    expect(
      presetDailyFloorLink({
        name: "No 0% completed daily tasks",
        frequency: "weekly",
        type: TaskType.BOOLEAN,
      }),
    ).toEqual({ floorPercent: 0, enabled: true })
    expect(
      effectiveDailyFloorLink({
        name: "No 0% completed daily tasks",
        frequency: "weekly",
        type: TaskType.BOOLEAN,
        dailyFloorLink: null,
      }),
    ).toBeNull()
  })

  it("is complete only when every daily habit has some week completion", () => {
    const a: WeeklyTask = { id: "a", name: "A", type: TaskType.BOOLEAN, frequency: "daily" }
    const b: WeeklyTask = { id: "b", name: "B", type: TaskType.BOOLEAN, frequency: "daily" }
    const mon = formatLocalDateKey(weekDates[0])
    const tue = formatLocalDateKey(weekDates[1])
    expect(
      dailyHabitsClearFloor(
        [a, b],
        {
          [mon]: { a: { completed: true }, b: { completed: true } },
        },
        weekDates,
        0,
      ),
    ).toBe(true)
    expect(
      dailyHabitsClearFloor(
        [a, b],
        {
          [mon]: { a: { completed: true } },
          [tue]: { a: { completed: true } },
        },
        weekDates,
        0,
      ),
    ).toBe(false)
  })
})

describe("hide completed", () => {
  it("hides sleep-linked and numeric habits that are met, including wake-before-9 shapes", () => {
    const wake: WeeklyTask = {
      id: "wake",
      name: "wake up before 9",
      type: TaskType.BOOLEAN,
      frequency: "daily",
      sleepLink: { end: "wake", beforeMinutes: 9 * 60 },
    }
    expect(
      habitHiddenWhenComplete(wake, { completed: true, sleepCompleted: true }, { date: weekDates[0] }),
    ).toBe(true)
    expect(habitHiddenWhenComplete(wake, { sleepCompleted: true, completed: false }, {})).toBe(true)
    const pages: WeeklyTask = {
      id: "pages",
      name: "Read",
      type: TaskType.GOAL,
      goal: 10,
      frequency: "daily",
    }
    expect(habitHiddenWhenComplete(pages, { value: 10, goal: 10 }, {})).toBe(true)
    expect(habitHiddenWhenComplete(pages, { value: 9, goal: 10 }, {})).toBe(false)
    expect(habitHiddenWhenComplete(wake, undefined, { exempt: true })).toBe(true)
  })
})
