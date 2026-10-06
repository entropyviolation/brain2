import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import * as calculations from "./calculations"
import { formatLocalDateKey, getWeekDates, getWeekString } from "./date-utils"
import { readingsFromCell, trustedOutcome } from "./habit-completion-trust"
import {
  applyDailyCompletionAverage,
  datesForCompletionAverage,
  rawDailyCompletionAverage,
  startDailyCompletionAverageSync,
  syncDailyCompletionAverages,
} from "./habit-daily-completion-average"
import { periodWindowsForFrequency } from "./habit-period-windows"
import { useHabitsStore } from "./habits-store"
import { quarterKey } from "./seasons"
import { TaskType, type WeeklyData, type WeeklyTask } from "./types"
import { resetAllStores } from "@/tests/test-utils"

const full: WeeklyTask = {
  id: "full",
  name: "Full",
  type: TaskType.BOOLEAN,
  frequency: "daily",
}

const empty: WeeklyTask = {
  id: "empty",
  name: "Empty",
  type: TaskType.BOOLEAN,
  frequency: "daily",
}

const weekly: WeeklyTask = {
  id: "perfect-week",
  name: "50% Perfect output for daily tasks",
  type: TaskType.GOAL,
  goal: 50,
  unit: "%",
  frequency: "weekly",
  completionSources: ["manual", "dailyCompletionAverage"],
}

const monthly: WeeklyTask = {
  ...weekly,
  id: "perfect-month",
  name: "50% Perfect output for daily tasks",
  frequency: "monthly",
}

const season: WeeklyTask = {
  ...weekly,
  id: "perfect-season",
  name: "50% Perfect output for daily tasks",
  frequency: "quarterly",
}

/** Tuesday 6 Oct 2026. The Monday week is 5–11 Oct. */
const OCT_6 = new Date(2026, 9, 6, 15, 0, 0)
const TODAY = "2026-10-06"

function day(n: number): Date {
  return new Date(2026, 9, n)
}

function key(n: number): string {
  return formatLocalDateKey(day(n))
}

function doneOn(days: number[]): WeeklyData {
  const data: WeeklyData = {}
  for (const n of days) data[key(n)] = { full: { completed: true } }
  return data
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

describe("raw daily completion average", () => {
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

  it("averages a week of 100 and 0 to 50 and does not call the perfect-output curve", () => {
    const output = vi.spyOn(calculations, "calculateWeekToDateOutputGrade")
    const periodOutput = vi.spyOn(calculations, "calculatePeriodOutputGrade")
    output.mockClear()
    periodOutput.mockClear()
    const dates = getWeekDates(day(5))
    const data = doneOn([5, 6, 7, 8, 9, 10, 11])
    expect(rawDailyCompletionAverage([full, empty], data, dates)).toBe(50)
    expect(output).not.toHaveBeenCalled()
    expect(periodOutput).not.toHaveBeenCalled()
    output.mockRestore()
    periodOutput.mockRestore()
  })

  it("uses the week % column, so two days done in a seven-day week are not treated as finished", () => {
    const dates = getWeekDates(day(5))
    const data = doneOn([5, 6])
    const column = calculations.calculateTaskPercentage("full", [full, empty], data, dates)
    expect(column).toBeCloseTo((2 / 7) * 100)
    expect(rawDailyCompletionAverage([full, empty], data, dates)).toBeCloseTo(column / 2)
  })

  it("leaves an exempt habit out and counts an empty active habit as 0", () => {
    const dates = getWeekDates(day(5))
    const data = doneOn([5, 6, 7, 8, 9, 10, 11])
    expect(rawDailyCompletionAverage([full, empty], data, dates, (task) => task.id === "empty")).toBe(100)
    expect(rawDailyCompletionAverage([full, empty], data, dates)).toBe(50)
  })

  it("uses the goal row formula from the column, not days the goal was met", () => {
    const pages: WeeklyTask = { id: "pages", name: "Pages", type: TaskType.GOAL, goal: 10, frequency: "daily" }
    const quiet: WeeklyTask = { id: "quiet", name: "Quiet", type: TaskType.GOAL, goal: 10, frequency: "daily" }
    const dates = getWeekDates(day(5))
    const data: WeeklyData = {}
    for (const date of dates) data[formatLocalDateKey(date)] = { pages: { value: 5, goal: 10 } }
    const column = calculations.calculateTaskPercentage("pages", [pages, quiet], data, dates)
    expect(column).toBe(50)
    expect(rawDailyCompletionAverage([pages, quiet], data, dates)).toBe(25)
  })

  it("month and season use the same helper over days that have already happened", () => {
    const output = vi.spyOn(calculations, "calculateWeekToDateOutputGrade")
    const periodOutput = vi.spyOn(calculations, "calculatePeriodOutputGrade")
    output.mockClear()
    periodOutput.mockClear()
    const data = doneOn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    const monthWindow = periodWindowsForFrequency("monthly", [TODAY])[0]
    const seasonWindow = periodWindowsForFrequency("quarterly", [TODAY])[0]
    const monthDates = datesForCompletionAverage("monthly", monthWindow, TODAY)
    const seasonDates = datesForCompletionAverage("quarterly", seasonWindow, TODAY)
    expect(monthDates.map(formatLocalDateKey)).toEqual([1, 2, 3, 4, 5, 6].map(key))
    expect(seasonDates.map(formatLocalDateKey).at(-1)).toBe(TODAY)
    expect(seasonDates.some((date) => formatLocalDateKey(date) > TODAY)).toBe(false)
    expect(rawDailyCompletionAverage([full, empty], data, monthDates)).toBe(50)
    expect(rawDailyCompletionAverage([full, empty], data, seasonDates)).toBe(50)
    expect(output).not.toHaveBeenCalled()
    expect(periodOutput).not.toHaveBeenCalled()
    output.mockRestore()
    periodOutput.mockRestore()
  })

  it("keeps a hand-typed number and still records the average", () => {
    const next = applyDailyCompletionAverage(weekly, { value: 10, manualValue: 10, handCompleted: false }, 50)
    expect(next).toMatchObject({ value: 10, manualValue: 10, handCompleted: false, dailyCompletionAverage: 50 })
  })

  it("writes 50 for the week, month, and season, and a goal of 50 is met", () => {
    useHabitsStore.setState({
      tasks: [full, empty, weekly, monthly, season],
      weeklyData: doneOn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
    })
    syncDailyCompletionAverages()
    const weekKey = getWeekString(day(5))
    const cell = useHabitsStore.getState().weeklyHabitData[weekKey]?.["perfect-week"]
    expect(cell).toMatchObject({ value: 50, dailyCompletionAverage: 50, goal: 50, completed: true })
    expect(cell?.handCompleted).toBeUndefined()
    expect(cell?.manualValue).toBeUndefined()
    const readings = readingsFromCell(weekly.completionSources!, cell, 50)
    expect(readings.manual?.state).toBe("empty")
    expect(readings.dailyCompletionAverage).toEqual({ state: "met", value: 50 })
    expect(trustedOutcome(weekly.completionSources!, readings).met).toBe(true)
    expect(useHabitsStore.getState().monthlyHabitData["2026-10"]?.["perfect-month"]).toMatchObject({
      value: 50,
      dailyCompletionAverage: 50,
      goal: 50,
      completed: true,
    })
    expect(useHabitsStore.getState().quarterlyHabitData[quarterKey(OCT_6)]?.["perfect-season"]).toMatchObject({
      value: 50,
      dailyCompletionAverage: 50,
      goal: 50,
      completed: true,
    })
  })

  it("matches the week column while a month leaves future days out", () => {
    useHabitsStore.setState({
      tasks: [full, empty, weekly, monthly],
      weeklyData: doneOn([5, 6]),
    })
    syncDailyCompletionAverages()
    const weekKey = getWeekString(day(5))
    const weekCell = useHabitsStore.getState().weeklyHabitData[weekKey]?.["perfect-week"]
    const dates = getWeekDates(day(5))
    const column = calculations.calculateTaskPercentage("full", [full, empty], doneOn([5, 6]), dates)
    expect(weekCell?.value).toBeCloseTo(column / 2)
    expect(weekCell?.value).not.toBe(50)
    const monthCell = useHabitsStore.getState().monthlyHabitData["2026-10"]?.["perfect-month"]
    const monthDates = datesForCompletionAverage(
      "monthly",
      periodWindowsForFrequency("monthly", [TODAY])[0],
      TODAY,
    )
    expect(monthCell?.value).toBeCloseTo(
      rawDailyCompletionAverage([full, empty], doneOn([5, 6]), monthDates)! ,
    )
    expect(monthDates.every((date) => formatLocalDateKey(date) <= TODAY)).toBe(true)
  })

  it("keeps a hand-typed parent and stores the average beside it", () => {
    const weekKey = getWeekString(day(5))
    useHabitsStore.setState({
      tasks: [full, empty, weekly],
      weeklyData: doneOn([5, 6, 7, 8, 9, 10, 11]),
      weeklyHabitData: {
        [weekKey]: { "perfect-week": { value: 10, manualValue: 10, handCompleted: false, goal: 50 } },
      },
    })
    syncDailyCompletionAverages()
    const cell = useHabitsStore.getState().weeklyHabitData[weekKey]?.["perfect-week"]
    expect(cell).toMatchObject({
      value: 10,
      manualValue: 10,
      handCompleted: false,
      dailyCompletionAverage: 50,
      completed: false,
    })
    const readings = readingsFromCell(weekly.completionSources!, cell, 50)
    expect(trustedOutcome(weekly.completionSources!, readings).winner).toBe("manual")
    expect(readings.dailyCompletionAverage).toEqual({ state: "met", value: 50 })
  })

  it("updates the parent when a later daily cell changes", async () => {
    await hydrated()
    useHabitsStore.setState({
      tasks: [full, empty, weekly, monthly],
      weeklyData: doneOn([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]),
      weeklyHabitData: {},
      monthlyHabitData: {},
    })
    stopSync = startDailyCompletionAverageSync()
    const weekKey = getWeekString(day(5))
    expect(useHabitsStore.getState().weeklyHabitData[weekKey]?.["perfect-week"]).toMatchObject({
      value: 50,
      dailyCompletionAverage: 50,
      completed: true,
    })
    useHabitsStore.getState().updateCompletion(full.id, day(11), { completed: false })
    const weekCell = useHabitsStore.getState().weeklyHabitData[weekKey]?.["perfect-week"]
    expect(weekCell?.value).toBeCloseTo((6 / 7) * 50)
    expect(weekCell?.dailyCompletionAverage).toBeCloseTo((6 / 7) * 50)
    expect(weekCell?.completed).toBe(false)
    expect(weekCell?.handCompleted).toBeUndefined()
    expect(useHabitsStore.getState().monthlyHabitData["2026-10"]?.["perfect-month"]?.value).toBe(50)
  })
})
