import { beforeEach, describe, expect, it } from "vitest"
import type { Subtask, Task } from "@/lib/types"
import {
  chainNeeds,
  clearNeeds,
  massDelete,
  massDone,
  massEstimate,
  massTier,
  needsAll,
  onCurrentPeriod,
  orderLane,
  periodPushes,
  stepPointChanges,
  stepPointsEarned,
  stepPointsKey,
  taskPointsWithSource,
} from "@/lib/task-card"
import { settleStepPoints } from "@/lib/step-points"
import { usePointsStore } from "@/lib/points-store"
import { resolveCompletionPoints } from "@/lib/item-utils"
import { flattenSteps } from "@/lib/todo-steps"
import { resetAllStores } from "@/tests/test-utils"

const s = (id: string, extra: Partial<Subtask> = {}): Subtask => ({ id, description: id, completed: false, ...extra })
const find = (steps: Subtask[], id: string) => flattenSteps(steps).find((x) => x.id === id)!
const task = (extra: Partial<Task> = {}) => ({ id: "t", description: "T", ...extra }) as Task

describe("task card mass edit", () => {
  const tree = [s("a", { subtasks: [s("a1", { estimatedDuration: 10 })] }), s("b"), s("c")]

  it("estimate set and ± touch only the selection, never below zero", () => {
    expect(find(massEstimate(tree, new Set(["b"]), { set: 20 }), "b").estimatedDuration).toBe(20)
    expect(find(massEstimate(tree, new Set(["a1"]), { delta: 5 }), "a1").estimatedDuration).toBe(15)
    expect(find(massEstimate(tree, new Set(["a1"]), { delta: -15 }), "a1").estimatedDuration).toBeUndefined()
    expect(find(massEstimate(tree, new Set(["b"]), { set: 20 }), "c").estimatedDuration).toBeUndefined()
  })

  it("tier sets and inherit clears", () => {
    const next = massTier(tree, new Set(["b", "a1"]), "min")
    expect(find(next, "a1").tier).toBe("min")
    expect(find(massTier(next, new Set(["b"]), undefined), "b").tier).toBeUndefined()
  })

  it("Chain makes each need the one above; Clear needs empties it; Needs… skips itself", () => {
    const chained = chainNeeds(tree, ["a", "b", "c"])
    expect(find(chained, "a").dependsOn).toBeUndefined()
    expect(find(chained, "b").dependsOn).toEqual(["a"])
    expect(find(chained, "c").dependsOn).toEqual(["b"])
    expect(find(clearNeeds(chained, new Set(["b", "c"])), "c").dependsOn).toBeUndefined()
    const all = needsAll(tree, new Set(["a", "b"]), "a")
    expect(find(all, "a").dependsOn).toBeUndefined()
    expect(find(all, "b").dependsOn).toEqual(["a"])
  })

  it("Done / Not done and Delete", () => {
    const done = massDone(tree, new Set(["b"]), true)
    expect(find(done, "b").completed).toBe(true)
    expect(find(massDone(done, new Set(["b"]), false), "b").completed).toBe(false)
    expect(flattenSteps(massDelete(tree, new Set(["a", "c"]))).map((x) => x.id)).toEqual(["b"])
  })

  it("order lane: depth by chain, unlocks counts what waits", () => {
    const lane = orderLane(chainNeeds(tree, ["a", "b", "c"]))
    const a = lane.find((n) => n.id === "a")!
    expect(a.depth).toBe(0)
    expect(a.unlocks).toBe(2)
    expect(lane.find((n) => n.id === "c")!.depth).toBe(2)
  })
})

describe("task card points", () => {
  beforeEach(() => resetAllStores())

  it("pointsOverride wins over the rule; clearing returns to it", () => {
    const base = resolveCompletionPoints(task(), [], [])
    expect(resolveCompletionPoints(task({ pointsOverride: 10 }), [], [])).toBe(10)
    expect(taskPointsWithSource(task({ pointsOverride: 10 }), [], []).source).toBe("override")
    expect(taskPointsWithSource(task(), [], [])).toEqual({ points: base, source: "default" })
  })

  it("step points are paid on tick and taken back on untick", () => {
    const before = [s("x", { points: 3 }), s("y")]
    const ticked = massDone(before, new Set(["x", "y"]), true)
    expect(stepPointChanges(before, ticked).map((c) => [c.step.id, c.paid])).toEqual([["x", true]])
    expect(stepPointsEarned(ticked)).toBe(3)
    settleStepPoints(task(), before, ticked)
    const rows = () => usePointsStore.getState().pointsHistory.filter((e) => e.taskId === stepPointsKey("t", "x"))
    expect(rows().map((r) => r.points)).toEqual([3])
    settleStepPoints(task(), ticked, massDone(ticked, new Set(["x"]), false))
    expect(rows()).toEqual([])
  })
})

describe("task card period", () => {
  it("onCurrentPeriod reads day, week and month", () => {
    const now = new Date(2026, 9, 16, 12)
    expect(onCurrentPeriod({ scheduledDate: new Date(2026, 9, 16) }, now)).toBe(true)
    expect(onCurrentPeriod({ scheduledMonth: "2026-10" }, now)).toBe(true)
    expect(onCurrentPeriod({ scheduledMonth: "2026-09" }, now)).toBe(false)
  })

  it("pushes in and out of this period", () => {
    const t = { schedulePlacements: [
      { period: "day", value: "2026-10-15", resolved: "pushed" },
      { period: "day", value: "2026-10-16", resolved: "pushed" },
    ] } as Pick<Task, "schedulePlacements">
    expect(periodPushes(t, "day", "2026-10-16")).toEqual({ in: 1, out: 1 })
  })
})
