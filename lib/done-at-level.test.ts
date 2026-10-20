import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { completeTask } from "@/lib/services/completion-service"
import { activeTierPoints } from "@/lib/completion-tiers"
import type { Subtask, Task } from "@/lib/types"

const s = (id: string, extra: Partial<Subtask> = {}): Subtask => ({ id, description: id, completed: false, ...extra })
const task = (subtasks: Subtask[]): Task => ({
  id: "t", description: "Finish CDs", stage: "scheduled", createdAt: new Date(), completed: false, lists: [], subtasks,
})
const get = () => useTaskStore.getState().tasks.find((t) => t.id === "t")!
const paid = () => usePointsStore.getState().pointsHistory.filter((e) => e.taskId === "t").reduce((n, e) => n + e.points, 0)

describe("Done at a level (Phase 10)", () => {
  beforeEach(() => resetAllStores())

  it("Done at Bare minimum records the level and pays its amount; reopen clears it", () => {
    useTaskStore.getState().setTasks([task([s("a", { tier: "min", completed: true }), s("b", { tier: "goal" })])])
    completeTask("t", { level: "min" })
    expect(get().tierReached).toBe("min")
    expect(paid()).toBe(activeTierPoints().bareMin)
    useTaskStore.getState().updateTask({ ...get(), completed: false })
    expect(get().tierReached).toBeUndefined()
  })

  it("plain Done on a tiered task records the top non-empty level", () => {
    useTaskStore.getState().setTasks([task([s("a", { tier: "min" }), s("b", { tier: "goal" })])])
    completeTask("t")
    expect(get().tierReached).toBe("goal")
    expect(paid()).toBe(activeTierPoints().goal)
  })

  it("a task without step tiers keeps its old Done and points", () => {
    useTaskStore.getState().setTasks([task([s("a")])])
    completeTask("t")
    expect(get().tierReached).toBeUndefined()
    expect(paid()).toBe(1)
  })
})
