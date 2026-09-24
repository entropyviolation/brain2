import { beforeEach, describe, expect, it } from "vitest"
import { useHabitsStore } from "./habits-store"
import { useTimeTrackingStore } from "./time-tracking-store"
import { syncTrackedHabits, syncTrackedHabitsForTask } from "./habit-tracking-sync"
import { getWeekString, getWeekStartDate, formatLocalMonthKey } from "./date-utils"
import { TaskType, type WeeklyTask } from "./types"

const DATE_KEY = "2026-09-17"
const date = new Date(2026, 8, 17)
const weekStart = getWeekStartDate(date)
const weekKey = getWeekString(weekStart)
const monthKey = formatLocalMonthKey(date)

const cleaningHabit: WeeklyTask = {
  id: "habit-clean",
  name: "Clean for at least 15 minutes",
  type: TaskType.GOAL,
  goal: 15,
  unit: "minutes",
  frequency: "daily",
  trackingLink: { tagIds: ["tag-cleaning"] },
}

const weeklyClean: WeeklyTask = {
  ...cleaningHabit,
  id: "habit-clean-week",
  name: "Clean 60 minutes this week",
  goal: 60,
  frequency: "weekly",
}

function completion() {
  return useHabitsStore.getState().weeklyData[DATE_KEY]?.[cleaningHabit.id]
}

function weeklyCompletion() {
  return useHabitsStore.getState().weeklyHabitData[weekKey]?.[weeklyClean.id]
}

/** Paint `minutes` minutes from 08:00 with the given pen. */
function paint(penId: string, minutes: number, scopeId = "activity", dateKey = DATE_KEY) {
  const start = 480
  useTimeTrackingStore.getState().paintMinutes(dateKey, scopeId, start, start + minutes, penId)
}

beforeEach(() => {
  useTimeTrackingStore.setState({ entries: [] })
  useHabitsStore.setState({ tasks: [cleaningHabit], weeklyData: {} })
})

describe("habit ⇄ tracking sync", () => {
  it("counts time on a tagged pen toward the linked habit", () => {
    paint("act-chores", 30) // 30 minutes on the seeded Cleaning-tagged pen
    syncTrackedHabits([DATE_KEY])

    expect(completion()).toMatchObject({ value: 30, trackedValue: 30, completed: true })
  })

  it("counts a custom pen the user tagged Cleaning", () => {
    useTimeTrackingStore.getState().addPen("activity", { name: "Do dishes", color: "#0af", tags: ["tag-cleaning"] })
    const dishes = useTimeTrackingStore.getState().scopes[0].pens.at(-1)!
    paint(dishes.id, 15)
    syncTrackedHabits([DATE_KEY])

    expect(completion()?.value).toBe(15)
  })

  it("leaves the habit alone when the pen carries no matching tag", () => {
    paint("act-work", 60)
    syncTrackedHabits([DATE_KEY])

    expect(completion()).toBeUndefined()
  })

  it("keeps a manual entry and tops it up with tracked time", () => {
    useHabitsStore.getState().updateCompletion(cleaningHabit.id, date, { value: 10, goal: 15 })
    paint("act-chores", 15)
    syncTrackedHabits([DATE_KEY])

    expect(completion()).toMatchObject({ value: 25, manualValue: 10, trackedValue: 15 })
  })

  it("treats a number typed over an auto-filled cell as the new total", () => {
    paint("act-chores", 15)
    syncTrackedHabits([DATE_KEY])
    useHabitsStore.getState().updateCompletion(cleaningHabit.id, date, { value: 40, goal: 15 })

    expect(completion()).toMatchObject({ value: 40, manualValue: 25, trackedValue: 15 })

    // A later repaint recomputes from the manual half rather than stacking.
    paint("act-chores", 30)
    syncTrackedHabits([DATE_KEY])
    expect(completion()).toMatchObject({ value: 55, manualValue: 25, trackedValue: 30 })
  })

  it("drops the tracked contribution when the time is erased", () => {
    paint("act-chores", 30)
    syncTrackedHabits([DATE_KEY])
    useTimeTrackingStore.getState().clearDay(DATE_KEY, "activity")
    syncTrackedHabits([DATE_KEY])

    expect(completion()).toMatchObject({ value: 0, trackedValue: 0, completed: false })
  })

  it("converts to hours when the link asks for them", () => {
    useHabitsStore.setState({
      tasks: [{ ...cleaningHabit, goal: 1, unit: "hours", trackingLink: { tagIds: ["tag-cleaning"], unit: "hours" } }],
    })
    paint("act-chores", 90)
    syncTrackedHabits([DATE_KEY])

    expect(completion()).toMatchObject({ value: 1.5, completed: true })
  })

  it("re-checks history when a habit's tags change", () => {
    paint("act-work", 60)
    syncTrackedHabits([DATE_KEY])
    expect(completion()).toBeUndefined()

    useHabitsStore.setState({ tasks: [{ ...cleaningHabit, trackingLink: { tagIds: ["tag-work"] } }] })
    syncTrackedHabitsForTask(cleaningHabit.id)
    expect(completion()?.value).toBe(60)
  })

  it("clears what it wrote when the link is removed", () => {
    paint("act-chores", 30)
    syncTrackedHabits([DATE_KEY])
    useHabitsStore.setState({ tasks: [{ ...cleaningHabit, trackingLink: undefined }] })
    syncTrackedHabitsForTask(cleaningHabit.id)

    expect(completion()?.value).toBe(0)
  })
})

describe("weekly habit ⇄ tracking sync", () => {
  beforeEach(() => {
    useTimeTrackingStore.setState({ entries: [] })
    useHabitsStore.setState({ tasks: [weeklyClean], weeklyData: {}, weeklyHabitData: {}, monthlyHabitData: {} })
  })

  it("sums tagged minutes across the week onto the weekly habit", () => {
    paint("act-chores", 20, "activity", "2026-09-14")
    paint("act-chores", 25, "activity", DATE_KEY)
    syncTrackedHabits(["2026-09-14", DATE_KEY])

    expect(weeklyCompletion()).toMatchObject({ value: 45, trackedValue: 45 })
    expect(useHabitsStore.getState().weeklyData[DATE_KEY]?.[weeklyClean.id]).toBeUndefined()
  })

  it("is idempotent when the same days are synced again", () => {
    paint("act-chores", 30)
    syncTrackedHabits([DATE_KEY])
    syncTrackedHabits([DATE_KEY])
    expect(weeklyCompletion()?.value).toBe(30)
  })

  it("tops up a hand-logged weekly total", () => {
    useHabitsStore.getState().updateWeeklyHabitCompletion(weeklyClean.id, weekStart, { value: 10, goal: 60 })
    paint("act-chores", 20)
    syncTrackedHabits([DATE_KEY])
    expect(weeklyCompletion()).toMatchObject({ value: 30, manualValue: 10, trackedValue: 20 })
  })
})

describe("monthly habit ⇄ tracking sync", () => {
  const monthlyClean: WeeklyTask = {
    ...cleaningHabit,
    id: "habit-clean-month",
    name: "Clean 120 minutes this month",
    goal: 120,
    frequency: "monthly",
  }

  beforeEach(() => {
    useTimeTrackingStore.setState({ entries: [] })
    useHabitsStore.setState({ tasks: [monthlyClean], weeklyData: {}, weeklyHabitData: {}, monthlyHabitData: {} })
  })

  it("sums tagged minutes across the month onto the monthly habit", () => {
    paint("act-chores", 40, "activity", "2026-09-01")
    paint("act-chores", 15, "activity", DATE_KEY)
    syncTrackedHabits(["2026-09-01", DATE_KEY])
    expect(useHabitsStore.getState().monthlyHabitData[monthKey]?.[monthlyClean.id]).toMatchObject({
      value: 55,
      trackedValue: 55,
    })
  })
})
