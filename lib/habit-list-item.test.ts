/**
 * lib/habit-list-item.test.ts — Habit settings open the standing Lists item and come back
 */
import { beforeEach, describe, expect, it } from "vitest"
import { APP_NAV_KEYS, APP_TABS, readStoredId, readStoredTab } from "@/lib/app-navigation"
import { ensureHabitStandingItem, openHabitInLists, returnToHabitSettings, takeHabitDraft } from "@/lib/habit-list-item"
import { useTaskStore } from "@/lib/task-store"
import { TaskType } from "@/lib/types"
import { resetAllStores } from "@/tests/test-utils"

const habit = {
  id: "h1",
  name: "Study",
  type: TaskType.GOAL,
  goal: 20,
  unit: "min",
  rewardValue: 10,
  frequency: "daily" as const,
}

describe("habit standing item", () => {
  beforeEach(() => {
    resetAllStores()
  })

  it("creates a Lists item, opens it, and restores the habit draft on the way back", () => {
    const itemId = ensureHabitStandingItem(habit)
    const item = useTaskStore.getState().tasks.find((task) => task.id === itemId)
    expect(item?.attributes?.sourceHabitId).toBe("h1")
    expect(item?.type).toBe("item")
    expect(useTaskStore.getState().lists.some((list) => list.name === "Habits")).toBe(true)

    openHabitInLists({ ...habit, goal: 30 })
    expect(readStoredId(APP_NAV_KEYS.appItemId)).toBe(itemId)
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")).toBe("categories")
    expect(readStoredTab(APP_NAV_KEYS.homeTab, ["habits", "plan", "todo", "goals", "tracking"], "habits")).toBe("habits")

    expect(returnToHabitSettings()).toBe(true)
    expect(readStoredId(APP_NAV_KEYS.appItemId)).toBeNull()
    expect(readStoredTab(APP_NAV_KEYS.appTab, APP_TABS, "home")).toBe("home")
    expect(takeHabitDraft("h1")?.goal).toBe(30)
    expect(useTaskStore.getState().tasks.some((task) => task.id === itemId)).toBe(true)
  })
})
