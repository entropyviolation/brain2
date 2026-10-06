import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { formatLocalDateKey, getWeekStartDate, getWeekString } from "./date-utils"
import { startHabitCoverageSync, syncHabitCoverageLinks } from "./habit-coverage-sync"
import { readingsFromCell, trustedOutcome } from "./habit-completion-trust"
import { useHabitsStore } from "./habits-store"
import { useTimeTrackingStore } from "./time-tracking-store"
import { TaskType, type WeeklyTask } from "./types"

const day = new Date(2026, 8, 16)
const weekStart = getWeekStartDate(day)
const weekKey = getWeekString(weekStart)
const dateKey = formatLocalDateKey(day)

function paint(minutes: number, on = dateKey) {
  useTimeTrackingStore.getState().paintMinutes(on, "activity", 8 * 60, 8 * 60 + minutes, "act-work")
}

async function hydrated() {
  const wait = (persist: { hasHydrated: () => boolean; onFinishHydration: (fn: () => void) => () => void }) =>
    new Promise<void>((resolve) => {
      if (persist.hasHydrated()) resolve()
      else {
        const stop = persist.onFinishHydration(() => {
          stop()
          resolve()
        })
      }
    })
  await Promise.all([wait(useHabitsStore.persist), wait(useTimeTrackingStore.persist)])
}

let stopSync: (() => void) | null = null

beforeEach(async () => {
  useTimeTrackingStore.setState({ entries: [] })
  useHabitsStore.setState({
    tasks: [],
    weeklyData: {},
    weeklyHabitData: {},
    monthlyHabitData: {},
    quarterlyHabitData: {},
  })
  await hydrated()
})

afterEach(() => {
  stopSync?.()
  stopSync = null
})

describe("habit coverage sync", () => {
  it("checks a Yes/No week habit once and does not re-enter", () => {
    const habit: WeeklyTask = {
      id: "cov-bool",
      name: "Log the week",
      type: TaskType.BOOLEAN,
      frequency: "weekly",
      coverageLink: { threshold: 1, enabled: true },
    }
    useHabitsStore.setState({ tasks: [habit] })
    paint(120)
    stopSync = startHabitCoverageSync()

    const cell = useHabitsStore.getState().weeklyHabitData[weekKey]?.[habit.id]
    expect(cell).toMatchObject({ completed: true, coverageCompleted: true })
    expect(cell?.value).toBeUndefined()

    const rev = useHabitsStore.getState().contentRev
    syncHabitCoverageLinks()
    expect(useHabitsStore.getState().contentRev).toBe(rev)
    expect(useHabitsStore.getState().weeklyHabitData[weekKey]?.[habit.id]).toMatchObject({
      completed: true,
      coverageCompleted: true,
    })
  })

  it("keeps a Goal coverage habit checked when occupancy is under the habit goal", () => {
    const habit: WeeklyTask = {
      id: "cov-goal",
      name: "Log the week",
      type: TaskType.GOAL,
      goal: 100,
      unit: "%",
      frequency: "weekly",
      coverageLink: { threshold: 1, enabled: true },
    }
    useHabitsStore.setState({ tasks: [habit] })
    paint(120)
    stopSync = startHabitCoverageSync()

    const cell = useHabitsStore.getState().weeklyHabitData[weekKey]?.[habit.id]
    expect(cell?.coverageCompleted).toBe(true)
    expect(cell?.completed).toBe(true)
    expect(cell?.value).toBeLessThan(habit.goal!)

    const rev = useHabitsStore.getState().contentRev
    syncHabitCoverageLinks()
    expect(useHabitsStore.getState().contentRev).toBe(rev)
  })

  it("backfills every cleared week of the daily-floor habit in one pass", () => {
    const daily: WeeklyTask = {
      id: "daily-water",
      name: "Drink water",
      type: TaskType.BOOLEAN,
      frequency: "daily",
    }
    const floor: WeeklyTask = {
      id: "week-floor",
      name: "No 0% completed daily tasks",
      type: TaskType.BOOLEAN,
      frequency: "weekly",
      dailyFloorLink: { floorPercent: 0, enabled: true },
    }
    const weeklyData: Record<string, Record<string, { completed: boolean }>> = {}
    const weekKeys: string[] = []
    for (let i = 0; i < 12; i++) {
      const date = new Date(2026, 0, 5 + i * 7)
      const key = formatLocalDateKey(date)
      weeklyData[key] = { [daily.id]: { completed: true } }
      weekKeys.push(getWeekString(getWeekStartDate(date)))
    }
    useHabitsStore.setState({ tasks: [daily, floor], weeklyData })
    stopSync = startHabitCoverageSync()

    for (const key of weekKeys) {
      expect(useHabitsStore.getState().weeklyHabitData[key]?.[floor.id]).toMatchObject({
        completed: true,
        dailyFloorCompleted: true,
      })
    }

    const rev = useHabitsStore.getState().contentRev
    syncHabitCoverageLinks()
    expect(useHabitsStore.getState().contentRev).toBe(rev)
  })

  it("recomputes a one-day paint without walking older dates, matching a full rescan", () => {
    const dayHabit: WeeklyTask = {
      id: "cov-day",
      name: "Log the day",
      type: TaskType.GOAL,
      goal: 100,
      unit: "%",
      frequency: "daily",
      coverageLink: { threshold: 1, enabled: true },
    }
    const weekHabit: WeeklyTask = {
      id: "cov-week",
      name: "Log the week",
      type: TaskType.GOAL,
      goal: 100,
      unit: "%",
      frequency: "weekly",
      coverageLink: { threshold: 1, enabled: true },
    }
    const floor: WeeklyTask = {
      id: "week-floor",
      name: "No 0% completed daily tasks",
      type: TaskType.BOOLEAN,
      frequency: "weekly",
      dailyFloorLink: { floorPercent: 0, enabled: true },
    }
    const mondays = Array.from({ length: 12 }, (_, i) => new Date(2026, 0, 5 + i * 7))
    const far = mondays[0]
    const near = mondays[mondays.length - 1]
    const farKey = formatLocalDateKey(far)
    const nearKey = formatLocalDateKey(near)
    const farWeek = getWeekString(getWeekStartDate(far))
    const nearWeek = getWeekString(getWeekStartDate(near))
    for (const day of mondays) paint(120, formatLocalDateKey(day))
    useHabitsStore.setState({ tasks: [dayHabit, weekHabit, floor] })
    stopSync = startHabitCoverageSync()

    const farDay = useHabitsStore.getState().weeklyData[farKey]?.[dayHabit.id]
    const farWeekCell = useHabitsStore.getState().weeklyHabitData[farWeek]?.[weekHabit.id]
    const farFloor = useHabitsStore.getState().weeklyHabitData[farWeek]?.[floor.id]
    expect(farDay?.coverageCompleted).toBe(true)
    expect(farWeekCell?.coverageCompleted).toBe(true)
    expect(farFloor?.dailyFloorCompleted).toBe(true)
    const farDayValue = farDay!.value
    const farWeekValue = farWeekCell!.value
    // In place, so the habits subscriber does not treat this as an edit and rescan.
    farDay!.coverageCompleted = false
    farDay!.completed = false
    farDay!.value = 0
    farWeekCell!.coverageCompleted = false
    farWeekCell!.completed = false
    farWeekCell!.value = 0
    farFloor!.dailyFloorCompleted = false
    farFloor!.completed = false

    const nearBefore = useHabitsStore.getState().weeklyData[nearKey]?.[dayHabit.id]?.value
    const nearWeekBefore = useHabitsStore.getState().weeklyHabitData[nearWeek]?.[weekHabit.id]?.value
    paint(240, nearKey)

    const nearAfter = useHabitsStore.getState().weeklyData[nearKey]?.[dayHabit.id]
    const nearWeekAfter = useHabitsStore.getState().weeklyHabitData[nearWeek]?.[weekHabit.id]
    const nearFloor = useHabitsStore.getState().weeklyHabitData[nearWeek]?.[floor.id]
    expect(nearAfter?.value).toBeGreaterThan(nearBefore!)
    expect(nearWeekAfter?.value).toBeGreaterThan(nearWeekBefore!)
    expect(useHabitsStore.getState().weeklyData[farKey]?.[dayHabit.id]).toMatchObject({
      value: 0,
      completed: false,
      coverageCompleted: false,
    })
    expect(useHabitsStore.getState().weeklyHabitData[farWeek]?.[weekHabit.id]).toMatchObject({
      value: 0,
      completed: false,
      coverageCompleted: false,
    })
    expect(useHabitsStore.getState().weeklyHabitData[farWeek]?.[floor.id]).toMatchObject({
      completed: false,
      dailyFloorCompleted: false,
    })

    syncHabitCoverageLinks()
    expect(useHabitsStore.getState().weeklyData[nearKey]?.[dayHabit.id]).toMatchObject({
      value: nearAfter?.value,
      completed: nearAfter?.completed,
      coverageCompleted: nearAfter?.coverageCompleted,
    })
    expect(useHabitsStore.getState().weeklyHabitData[nearWeek]?.[weekHabit.id]).toMatchObject({
      value: nearWeekAfter?.value,
      completed: nearWeekAfter?.completed,
      coverageCompleted: nearWeekAfter?.coverageCompleted,
    })
    expect(useHabitsStore.getState().weeklyHabitData[nearWeek]?.[floor.id]).toMatchObject({
      completed: nearFloor?.completed,
      dailyFloorCompleted: nearFloor?.dailyFloorCompleted,
    })
    expect(useHabitsStore.getState().weeklyData[farKey]?.[dayHabit.id]).toMatchObject({
      value: farDayValue,
      completed: true,
      coverageCompleted: true,
    })
    expect(useHabitsStore.getState().weeklyHabitData[farWeek]?.[weekHabit.id]).toMatchObject({
      value: farWeekValue,
      completed: true,
      coverageCompleted: true,
    })
    expect(useHabitsStore.getState().weeklyHabitData[farWeek]?.[floor.id]).toMatchObject({
      completed: true,
      dailyFloorCompleted: true,
    })
  })

  it("autofills a daily habit from activity occupancy under the threshold", () => {
    const habit: WeeklyTask = {
      id: "cov-day-live",
      name: "Log 75% of the day",
      type: TaskType.GOAL,
      goal: 75,
      unit: "%",
      frequency: "daily",
      coverageLink: { threshold: 75, enabled: true },
      completionSources: ["manual", "coverage"],
    }
    useHabitsStore.setState({ tasks: [habit] })
    // Location paint is a different scope. Activity occupancy ignores it.
    useTimeTrackingStore.getState().paintMinutes(dateKey, "location", 8 * 60, 10 * 60, "loc-home")
    stopSync = startHabitCoverageSync()

    const cell = () => useHabitsStore.getState().weeklyData[dateKey]?.[habit.id]
    const order = habit.completionSources ?? []
    const outcome = () => trustedOutcome(order, readingsFromCell(order, cell(), habit.goal))
    expect(cell()).toBeUndefined()

    // 60 / 1440 = 4.166…% → 4.2. Under 75, but the minute still counts.
    useTimeTrackingStore.getState().paintMinutes(dateKey, "activity", 8 * 60, 9 * 60, "act-work")
    expect(cell()).toMatchObject({ value: 4.2, coverageCompleted: false, completed: false })
    expect(outcome()).toEqual({ winner: "coverage", met: false, value: 4.2 })

    // A longer stroke on the same morning replaces the hour. 180 min = 12.5%.
    useTimeTrackingStore.getState().paintMinutes(dateKey, "activity", 8 * 60, 11 * 60, "act-work")
    expect(cell()).toMatchObject({ value: 12.5, coverageCompleted: false, completed: false })

    // 1080 / 1440 = 75%. The source is now met.
    useTimeTrackingStore.getState().paintMinutes(dateKey, "activity", 0, 1080, "act-work")
    expect(cell()).toMatchObject({ value: 75, coverageCompleted: true, completed: true })

    // Shrinking back under the threshold must not leave the check stuck on.
    useTimeTrackingStore.getState().clearDay(dateKey, "activity")
    useTimeTrackingStore.getState().paintMinutes(dateKey, "activity", 8 * 60, 9 * 60, "act-work")
    expect(cell()).toMatchObject({ value: 4.2, coverageCompleted: false, completed: false })
    expect(outcome()).toEqual({ winner: "coverage", met: false, value: 4.2 })

    useTimeTrackingStore.getState().clearDay(dateKey, "activity")
    expect(cell()?.value).toBeUndefined()
    expect(cell()?.coverageCompleted).toBeUndefined()
    expect(outcome().winner).toBeNull()

    useTimeTrackingStore.getState().paintMinutes(dateKey, "activity", 8 * 60, 9 * 60, "act-work")
    useHabitsStore.getState().updateCompletion(habit.id, day, { handCompleted: true, completed: true })
    expect(cell()?.value).toBe(4.2)
    expect(cell()?.completed).toBe(true)
    expect(outcome().winner).toBe("manual")
  })
})
