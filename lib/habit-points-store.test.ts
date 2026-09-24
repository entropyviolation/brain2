import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { TaskType } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import {
  dayGradeLiftTaskId,
  GRADE_BONUS_BOTH,
  gradeBonusTaskId,
  habitDayPointTaskId,
  RAW_DAY_BONUS,
  rawDayBonusTaskId,
  weeklyGradeLiftTaskId,
} from "@/lib/habit-points"
import { getWeekString } from "@/lib/date-utils"

describe("daily habit points", () => {
  const monday = new Date(2026, 8, 14)

  beforeEach(() => {
    resetAllStores()
    useHabitsStore.getState().setTasks([
      { id: "water", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "daily" },
      { id: "pages", name: "Read", type: TaskType.GOAL, goal: 10, rewardValue: 20, frequency: "daily" },
    ])
  })

  it("awards 50 for a checked daily habit and revises a partial goal", () => {
    useHabitsStore.getState().updateCompletion("water", monday, { completed: true })
    const dateKey = formatLocalDateKey(monday)
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === habitDayPointTaskId("water", dateKey))?.points,
    ).toBe(50)

    useHabitsStore.getState().updateCompletion("pages", monday, { value: 5 })
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === habitDayPointTaskId("pages", dateKey))?.points,
    ).toBe(25)
  })

  it("awards a both-grades bonus when two booleans are fully done", () => {
    useHabitsStore.getState().updateCompletion("water", monday, { completed: true })
    useHabitsStore.getState().updateCompletion("pages", monday, { value: 10 })
    const bonus = usePointsStore
      .getState()
      .pointsHistory.find((e) => e.taskId === gradeBonusTaskId(formatLocalDateKey(monday)))
    expect(bonus?.points).toBe(GRADE_BONUS_BOTH)
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === rawDayBonusTaskId(formatLocalDateKey(monday)))
        ?.points,
    ).toBe(RAW_DAY_BONUS)
  })

  it("uses the user accomplishment threshold and bonus instead of the 80/50 defaults", () => {
    useHabitsStore.getState().setAccomplishmentThreshold(100)
    useHabitsStore.getState().setAccomplishmentBonus(12)
    useHabitsStore.getState().updateCompletion("water", monday, { completed: true })
    useHabitsStore.getState().updateCompletion("pages", monday, { value: 10 })
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === rawDayBonusTaskId(formatLocalDateKey(monday)))
        ?.points,
    ).toBe(12)

    useHabitsStore.getState().setAccomplishmentThreshold(50)
    useHabitsStore.getState().updateCompletion("pages", monday, { value: 5 })
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === rawDayBonusTaskId(formatLocalDateKey(monday)))
        ?.points,
    ).toBe(12)
  })

  it("pays an editable bonus when habit grades beat yesterday, and drops it at 0", () => {
    useHabitsStore.getState().setDayGradeLiftBonus(15)
    useHabitsStore.getState().updateCompletion("water", monday, { completed: true })
    useHabitsStore.getState().updateCompletion("pages", monday, { value: 10 })
    const row = usePointsStore
      .getState()
      .pointsHistory.find((e) => e.taskId === dayGradeLiftTaskId(formatLocalDateKey(monday)))
    expect(row?.points).toBe(30)
    expect(row?.taskDescription).toBe("Higher habit grades than yesterday")

    useHabitsStore.getState().setDayGradeLiftBonus(0)
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskId === dayGradeLiftTaskId(formatLocalDateKey(monday))),
    ).toBeUndefined()
  })

  it("pays an editable bonus when this week's weekly habit grades beat last week", () => {
    const lastWeek = new Date(2026, 8, 7)
    const thisWeek = new Date(2026, 8, 14)
    useHabitsStore.getState().setTasks([
      { id: "wk", name: "Weekly review", type: TaskType.BOOLEAN, rewardValue: 10, frequency: "weekly" },
    ])
    useHabitsStore.getState().setWeeklyGradeLiftBonus(8)
    useHabitsStore.getState().updateWeeklyHabitCompletion("wk", lastWeek, { completed: false })
    useHabitsStore.getState().updateWeeklyHabitCompletion("wk", thisWeek, { completed: true })
    const row = usePointsStore
      .getState()
      .pointsHistory.find((e) => e.taskId === weeklyGradeLiftTaskId(getWeekString(thisWeek)))
    expect(row?.points).toBe(16)
    expect(row?.taskDescription).toBe("Higher weekly habit grades than last week")
    expect(
      usePointsStore.getState().pointsHistory.find((e) => e.taskDescription === "Completed Weekly review")?.points,
    ).toBe(10)
  })
})
