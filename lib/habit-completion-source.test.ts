/**
 * lib/habit-completion-source.test.ts
 */
import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "./types"
import {
  applyLinkedFlag,
  clampCoverageThreshold,
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

  it("treats a missing allowance as 0 and lets one daily habit sit at 0 when the allowance is 1", () => {
    const a: WeeklyTask = { id: "a", name: "A", type: TaskType.BOOLEAN, frequency: "daily" }
    const b: WeeklyTask = { id: "b", name: "B", type: TaskType.BOOLEAN, frequency: "daily" }
    const mon = formatLocalDateKey(weekDates[0])
    const oneZero = { [mon]: { a: { completed: true } } }
    expect(dailyHabitsClearFloor([a, b], oneZero, weekDates, 0, undefined, 0)).toBe(false)
    expect(dailyHabitsClearFloor([a, b], oneZero, weekDates, 0)).toBe(false)
    expect(dailyHabitsClearFloor([a, b], oneZero, weekDates, 0, undefined, 1)).toBe(true)
    expect(dailyHabitsClearFloor([a, b], {}, weekDates, 0, undefined, 1)).toBe(false)
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

  it("keeps a partial value and a text note, and hides a met goal or a 100% row", () => {
    const pages: WeeklyTask = {
      id: "pages",
      name: "Read 30 pages",
      type: TaskType.GOAL,
      goal: 30,
      frequency: "weekly",
    }
    expect(habitHiddenWhenComplete(pages, { value: 2, goal: 30 }, { periodPercent: 7 })).toBe(false)
    expect(habitHiddenWhenComplete(pages, { value: 30, goal: 30 }, { periodPercent: 7 })).toBe(true)
    const coverage: WeeklyTask = {
      id: "coverage",
      name: "log 75% of the week",
      type: TaskType.GOAL,
      goal: 75,
      frequency: "weekly",
    }
    expect(habitHiddenWhenComplete(coverage, { value: 30, goal: 75 }, { periodPercent: 61 })).toBe(false)
    expect(habitHiddenWhenComplete(coverage, { value: 75, goal: 75 }, { periodPercent: 61 })).toBe(true)
    const note: WeeklyTask = { id: "social", name: "Something social", type: TaskType.TEXT, frequency: "weekly" }
    expect(habitHiddenWhenComplete(note, { text: "elijah comin home" }, { periodPercent: 67 })).toBe(false)
    expect(habitHiddenWhenComplete(note, { text: "Margot" }, { periodPercent: 100 })).toBe(true)
    const done: WeeklyTask = { id: "laundry", name: "laundry", type: TaskType.BOOLEAN, frequency: "weekly" }
    expect(habitHiddenWhenComplete(done, { completed: true }, { periodPercent: 33 })).toBe(true)
    expect(habitHiddenWhenComplete(done, { completed: false }, { periodPercent: 33 })).toBe(false)
  })
})
