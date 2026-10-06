import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { getWeekString } from "./date-utils"
import { readingsFromCell } from "./habit-completion-trust"
import { applyHabitSum, childHabitAmount, sumHabitValuesOverDays, syncHabitValueLinks, startHabitValueSync } from "./habit-value-sync"
import { useHabitsStore } from "./habits-store"
import { quarterKey } from "./seasons"
import { TaskType, type WeeklyTask } from "./types"
import { resetAllStores } from "@/tests/test-utils"

const daily: WeeklyTask = {
  id: "read-day",
  name: "Read at least 10 pages",
  type: TaskType.GOAL,
  goal: 10,
  unit: "pages",
  frequency: "daily",
}

const weekly: WeeklyTask = {
  id: "read-week",
  name: "Read 30 pages",
  type: TaskType.GOAL,
  goal: 30,
  unit: "pages",
  frequency: "weekly",
  habitValueLink: { habitId: "read-day", enabled: true },
  completionSources: ["manual", "habitValue"],
}

const monthly: WeeklyTask = {
  ...weekly,
  id: "read-month",
  name: "Read 30 pages this month",
  frequency: "monthly",
}

const season: WeeklyTask = {
  ...weekly,
  id: "read-season",
  name: "Read 30 pages this season",
  frequency: "quarterly",
}

const checks: WeeklyTask = {
  id: "stretch-day",
  name: "Stretch",
  type: TaskType.BOOLEAN,
  frequency: "daily",
}

const weeklyChecks: WeeklyTask = {
  id: "stretch-week",
  name: "Stretch this week",
  type: TaskType.GOAL,
  goal: 7,
  frequency: "weekly",
  habitValueLink: { habitId: "stretch-day", enabled: true },
  completionSources: ["manual", "habitValue"],
}

/** Tuesday 6 Oct 2026, afternoon. The week of 5 Oct is Mon 5 – Sun 11. */
const OCT_6 = new Date(2026, 9, 6, 15, 0, 0)

function weekCell(taskId = "read-week") {
  const weekKey = getWeekString(new Date(2026, 9, 5))
  return useHabitsStore.getState().weeklyHabitData[weekKey]?.[taskId]
}

let stopSync: (() => void) | null = null

async function hydrated() {
  const persist = useHabitsStore.persist
  if (persist.hasHydrated()) return
  await new Promise<void>((resolve) => {
    const stop = persist.onFinishHydration(() => {
      stop()
      resolve()
    })
  })
}

describe("habit value sum", () => {
  beforeEach(() => {
    resetAllStores()
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(OCT_6)
  })

  afterEach(() => {
    stopSync?.()
    stopSync = null
    vi.useRealTimers()
  })

  it("adds a daily habit across the days of a finished week", () => {
    const keys = ["2020-01-06", "2020-01-07", "2020-01-08"]
    const data = {
      "2020-01-06": { "read-day": { value: 5 } },
      "2020-01-07": { "read-day": { value: 7 } },
      "2020-01-08": { "read-day": { completed: true } },
    }
    expect(childHabitAmount({ completed: true })).toBe(1)
    expect(sumHabitValuesOverDays(data, "read-day", keys)).toBe(13)
  })

  it("keeps a hand-typed total and still records the sum", () => {
    const next = applyHabitSum(weekly, { value: 99, handCompleted: true }, 12)
    expect(next).toMatchObject({ value: 99, handCompleted: true, habitSumValue: 12 })
  })

  it("writes the weekly cell from the daily pages so far", () => {
    useHabitsStore.setState({
      tasks: [daily, weekly],
      weeklyData: {
        "2020-01-06": { "read-day": { value: 5 } },
        "2020-01-07": { "read-day": { value: 7 } },
      },
    })
    syncHabitValueLinks()
    const weekKey = getWeekString(new Date(2020, 0, 6))
    const cell = useHabitsStore.getState().weeklyHabitData[weekKey]?.["read-week"]
    expect(cell).toMatchObject({ value: 12, habitSumValue: 12, goal: 30 })
    expect(cell?.handCompleted).toBeUndefined()
    expect(cell?.manualValue).toBeUndefined()
  })

  it("turns Monday 2 and Tuesday 2 of the week of 5 Oct 2026 into 4, and leaves later days out", () => {
    useHabitsStore.setState({
      tasks: [daily, weekly, monthly, season],
      weeklyData: {
        "2026-10-05": { "read-day": { value: 2 } },
        "2026-10-06": { "read-day": { value: 2 } },
        "2026-10-07": { "read-day": { value: 9 } },
      },
    })
    syncHabitValueLinks()
    const cell = weekCell()
    expect(cell).toMatchObject({ value: 4, habitSumValue: 4, goal: 30 })
    expect(cell?.handCompleted).toBeUndefined()
    expect(cell?.manualValue).toBeUndefined()
    const readings = readingsFromCell(["manual", "habitValue"], cell, 30)
    expect(readings.manual?.state).toBe("empty")
    expect(readings.habitValue).toEqual({ state: "unmet", value: 4 })
    expect(useHabitsStore.getState().monthlyHabitData["2026-10"]?.["read-month"]).toMatchObject({
      value: 4,
      habitSumValue: 4,
      goal: 30,
    })
    expect(useHabitsStore.getState().quarterlyHabitData[quarterKey(new Date(2026, 9, 6))]?.["read-season"]).toMatchObject({
      value: 4,
      habitSumValue: 4,
      goal: 30,
    })
  })

  it("lets an empty day add nothing, including a logged zero that must not replace the rest", () => {
    const keys = ["2026-10-05", "2026-10-06", "2026-10-07"]
    const data = {
      "2026-10-05": { "read-day": { value: 2 } },
      "2026-10-06": { "read-day": { value: 0 } },
      "2026-10-07": { "read-day": { completed: false, goal: 10 } },
    }
    expect(childHabitAmount(undefined)).toBe(0)
    expect(childHabitAmount({ completed: false, goal: 10 })).toBe(0)
    expect(sumHabitValuesOverDays(data, "read-day", keys)).toBe(2)

    useHabitsStore.setState({
      tasks: [daily, weekly],
      weeklyData: {
        "2026-10-05": { "read-day": { value: 2 } },
        "2026-10-06": { "read-day": { goal: 10 } },
      },
    })
    syncHabitValueLinks()
    expect(weekCell()).toMatchObject({ value: 2, habitSumValue: 2 })
  })

  it("counts a checked day with no number as 1", () => {
    expect(childHabitAmount({ completed: true, value: 3 })).toBe(3)
    useHabitsStore.setState({
      tasks: [checks, weeklyChecks],
      weeklyData: {
        "2026-10-05": { "stretch-day": { completed: true } },
        "2026-10-06": { "stretch-day": { completed: true } },
        "2026-10-07": { "stretch-day": { completed: true } },
      },
    })
    syncHabitValueLinks()
    expect(weekCell("stretch-week")).toMatchObject({ value: 2, habitSumValue: 2, goal: 7 })
  })

  it("keeps a hand-owned period cell and still stores the sum", () => {
    const weekKey = getWeekString(new Date(2026, 9, 5))
    useHabitsStore.setState({
      tasks: [daily, weekly],
      weeklyData: {
        "2026-10-05": { "read-day": { value: 2 } },
        "2026-10-06": { "read-day": { value: 2 } },
      },
      weeklyHabitData: {
        [weekKey]: { "read-week": { value: 11, manualValue: 11, goal: 30 } },
      },
    })
    syncHabitValueLinks()
    expect(weekCell()).toMatchObject({ value: 11, manualValue: 11, habitSumValue: 4 })

    useHabitsStore.setState({
      weeklyHabitData: {
        [weekKey]: { "read-week": { value: 8, handCompleted: false, goal: 30 } },
      },
    })
    syncHabitValueLinks()
    expect(weekCell()).toMatchObject({ value: 8, handCompleted: false, habitSumValue: 4 })
  })

  it("updates the live week cell when a later day is logged, and does not freeze that write as a hand entry", async () => {
    await hydrated()
    useHabitsStore.setState({
      tasks: [daily, weekly],
      weeklyData: {},
      weeklyHabitData: {},
    })
    stopSync = startHabitValueSync()
    const monday = new Date(2026, 9, 5)
    const tuesday = new Date(2026, 9, 6)
    useHabitsStore.getState().updateCompletion(daily.id, monday, { value: 2, goal: 10 })
    expect(weekCell()).toMatchObject({ value: 2, habitSumValue: 2, goal: 30 })
    useHabitsStore.getState().updateCompletion(daily.id, tuesday, { value: 2, goal: 10 })
    expect(weekCell()).toMatchObject({ value: 4, habitSumValue: 4, goal: 30 })
    expect(weekCell()?.handCompleted).toBeUndefined()
    expect(weekCell()?.manualValue).toBeUndefined()
    useHabitsStore.getState().updateCompletion(daily.id, tuesday, { value: 5, goal: 10 })
    expect(weekCell()).toMatchObject({ value: 7, habitSumValue: 7 })
    vi.setSystemTime(new Date(2026, 9, 7, 15, 0, 0))
    useHabitsStore.getState().updateCompletion("read-day", new Date(2026, 9, 7), { value: 9, goal: 10 })
    expect(weekCell()).toMatchObject({ value: 16, habitSumValue: 16 })
  })
})
