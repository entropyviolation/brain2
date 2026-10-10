/**
 * New habits take the period default once. A habit that already has
 * rewardValue keeps it when the default changes. Apply-all writes every period.
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { TaskType } from "@/lib/types"

describe("default habit points", () => {
  beforeEach(() => {
    resetAllStores()
    useHabitsStore.getState().setTasks([])
  })

  it("stamps the daily default on a new daily habit and leaves an edited habit alone", () => {
    useHabitsStore.getState().setDefaultHabitPoints("daily", 18)
    useHabitsStore.getState().addTask({ id: "new", name: "New", type: TaskType.BOOLEAN, frequency: "daily" })
    expect(useHabitsStore.getState().tasks.find((task) => task.id === "new")?.rewardValue).toBe(18)

    useHabitsStore.getState().addTask({
      id: "edited",
      name: "Edited",
      type: TaskType.BOOLEAN,
      frequency: "daily",
      rewardValue: 40,
    })
    useHabitsStore.getState().setDefaultHabitPoints("daily", 7)
    expect(useHabitsStore.getState().tasks.find((task) => task.id === "edited")?.rewardValue).toBe(40)
    expect(useHabitsStore.getState().tasks.find((task) => task.id === "new")?.rewardValue).toBe(18)
    expect(useHabitsStore.getState().defaultHabitPoints.daily).toBe(7)
  })

  it("apply-all writes daily, weekly, monthly, and seasonal", () => {
    useHabitsStore.getState().setAllDefaultHabitPoints(12)
    expect(useHabitsStore.getState().defaultHabitPoints).toEqual({
      daily: 12,
      weekly: 12,
      monthly: 12,
      seasonal: 12,
    })
    useHabitsStore.getState().addTask({ id: "season", name: "Season", type: TaskType.BOOLEAN, frequency: "quarterly" })
    expect(useHabitsStore.getState().tasks.find((task) => task.id === "season")?.rewardValue).toBe(12)
  })
})
