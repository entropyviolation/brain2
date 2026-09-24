import { beforeEach, describe, expect, it } from "vitest"
import { resetLocalStorage } from "@/tests/test-utils"
import {
  buildLoggedActionItem,
  executeImpliedEffects,
  interpolateActionTitle,
} from "@/lib/implied-actions"
import type { ItemLike } from "@/lib/item-types"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore, getDefaultHabits } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import type { Task } from "@/lib/types"

const dune: Task = {
  id: "book-dune",
  description: "Dune",
  title: "Dune",
  type: "book",
  stage: "list",
  createdAt: new Date("2026-09-08T12:00:00"),
  completed: false,
  lists: [],
  links: [{ id: "l1", relation: "action-of", targetId: "goal-1" }],
  contributesToGoalIds: ["goal-1"],
  rewardValue: 3,
  attributes: { pagesRead: 22 },
}

describe("interpolateActionTitle", () => {
  it("fills title, delta, and attribute placeholders", () => {
    const item: ItemLike = { title: "Dune", description: "Dune", attributes: { pagesRead: 22 } }
    expect(interpolateActionTitle("read {delta} pages of {title}", item, 12)).toBe("read 12 pages of Dune")
    expect(interpolateActionTitle("{pagesRead} total", item, 12)).toBe("22 total")
  })
})

describe("buildLoggedActionItem", () => {
  it("marks a completed action and copies goal links", () => {
    const logged = buildLoggedActionItem(dune, "read 12 pages of Dune", true, new Date("2026-09-08T12:00:00"))
    expect(logged.type).toBe("action")
    expect(logged.loggedAction).toBe(true)
    expect(logged.completed).toBe(true)
    expect(logged.description).toBe("read 12 pages of Dune")
    expect(logged.links?.some((l) => l.relation === "action-of" && l.targetId === "goal-1")).toBe(true)
    expect(logged.contributesToGoalIds).toEqual(["goal-1"])
    expect(logged.rewardValue).toBe(3)
  })
})

describe("executeImpliedEffects", () => {
  beforeEach(() => {
    resetLocalStorage()
    useTaskStore.getState().clearAllData()
    useHabitsStore.getState().resetData()
    useHabitsStore.setState({ tasks: getDefaultHabits(), weeklyData: {} })
    usePointsStore.setState({ pointsHistory: [] })
  })

  it("logs a Done action, awards points, and increments the reading habit", () => {
    useTaskStore.getState().addTask(dune)
    const now = new Date("2026-09-08T15:00:00")
    const created = executeImpliedEffects(
      [
        { kind: "logAction", titleTemplate: "read {delta} pages of {title}", awardPoints: true, delta: 12 },
        { kind: "incrementHabit", habitId: "task-9", amount: 12 },
      ],
      dune,
      { now },
    )

    expect(created).toHaveLength(1)
    expect(created[0].description).toBe("read 12 pages of Dune")
    expect(created[0].loggedAction).toBe(true)
    expect(useTaskStore.getState().tasks.some((t) => t.loggedAction && t.description === "read 12 pages of Dune")).toBe(
      true,
    )
    expect(usePointsStore.getState().pointsHistory.some((p) => p.taskDescription === "read 12 pages of Dune")).toBe(true)

    const dateKey = formatLocalDateKey(now)
    expect(useHabitsStore.getState().weeklyData[dateKey]?.["task-9"]?.value).toBe(12)
  })
})
