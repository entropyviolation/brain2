import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { TaskType } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import { GRADE_BONUS_BOTH, gradeBonusTaskId, habitDayPointTaskId, RAW_DAY_BONUS, rawDayBonusTaskId } from "@/lib/habit-points"

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
})
