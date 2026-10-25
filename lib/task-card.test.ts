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
  tierEstimates,
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

describe("step points inherited from stepPoints", () => {
  it("pays the nearest default above a step that sets none", async () => {
    const { effectiveStepPoints, stepPointChanges } = await import("@/lib/task-card")
    const prev = [{ id: "a", description: "A", stepPoints: 3, subtasks: [{ id: "a1", description: "A1" }, { id: "a2", description: "A2", points: 7 }] }, { id: "b", description: "B" }] as never
    expect(Object.fromEntries(effectiveStepPoints(prev, 1))).toEqual({ a: 1, a1: 3, a2: 7, b: 1 })
    const next = [{ id: "a", description: "A", stepPoints: 3, subtasks: [{ id: "a1", description: "A1", completed: true }, { id: "a2", description: "A2", points: 7 }] }, { id: "b", description: "B" }] as never
    const changes = stepPointChanges(prev, next, 1)
    expect(changes.map((c) => [c.step.id, c.step.points, c.paid])).toEqual([["a1", 3, true]])
    expect(stepPointChanges(next, prev, 1).map((c) => [c.step.id, c.step.points, c.paid])).toEqual([["a1", 3, false]])
  })
})

describe("setEstimate", () => {
  it("logs each change and ignores no-ops", async () => {
    const { setEstimate } = await import("./task-card")
    const a = setEstimate([{ id: "a", description: "a", completed: false }], "a", 20)
    const b = setEstimate(a, "a", 30)
    expect(setEstimate(b, "a", 30)[0]).toBe(b[0])
    expect(b[0].estimatedDuration).toBe(30)
    expect(b[0].estimateLog?.map((e) => e.minutes)).toEqual([20, 30])
  })

  it("logs a ghost accept once", async () => {
    const { setEstimate } = await import("./task-card")
    const accepted = setEstimate([{ id: "a", description: "a", completed: false }], "a", 25)
    expect(accepted[0].estimatedDuration).toBe(25)
    expect(accepted[0].estimateLog?.map((e) => e.minutes)).toEqual([25])
    expect(setEstimate(accepted, "a", 25)[0].estimateLog).toHaveLength(1)
  })
})

describe("noteTaskEstimate", () => {
  const now = new Date("2026-10-25T12:00:00.000Z")
  const base = task({ estimatedDuration: 300, estimateLog: [{ at: "2026-10-01T00:00:00.000Z", minutes: 300 }] })

  it("appends when the task estimate changes and skips the same minutes", async () => {
    const { noteTaskEstimate } = await import("./task-card")
    const next = noteTaskEstimate(base, { ...base, estimatedDuration: 240 }, now)
    expect(next.estimateLog?.map((e) => e.minutes)).toEqual([300, 240])
    expect(next.estimateLog?.[1].at).toBe(now.toISOString())
    const copy = { ...next, estimatedDuration: 240 }
    const again = noteTaskEstimate(next, copy, now)
    expect(again).toBe(copy)
    expect(again.estimateLog).toHaveLength(2)
  })

  it("keeps a longer stored log when the draft's copy is stale", async () => {
    const { noteTaskEstimate } = await import("./task-card")
    const renamed = noteTaskEstimate(base, { ...base, description: "Finish CDs", estimateLog: undefined }, now)
    expect(renamed.estimateLog).toEqual(base.estimateLog)
    expect(renamed.estimatedDuration).toBe(300)
  })

  it("logs a task estimate in the store and leaves the step log in place", async () => {
    const { setEstimate } = await import("./task-card")
    const { useTaskStore } = await import("./task-store")
    useTaskStore.getState().clearAllData()
    const step = { id: "a", description: "insert", completed: false, estimatedDuration: 20, estimateLog: [{ at: "2026-10-01T00:00:00.000Z", minutes: 20 }] }
    useTaskStore.getState().addTask({
      id: "t",
      description: "Finish CDs",
      type: "task",
      stage: "list",
      createdAt: new Date("2026-10-01T00:00:00.000Z"),
      completed: false,
      lists: [],
      estimatedDuration: 300,
      subtasks: [step],
    })
    const stored = () => useTaskStore.getState().tasks.find((row) => row.id === "t")!
    const stepped = setEstimate(stored().subtasks, "a", 35)
    useTaskStore.getState().updateTask({ ...stored(), subtasks: stepped, estimatedDuration: 180 })
    expect(stored().estimatedDuration).toBe(180)
    expect(stored().estimateLog?.map((e) => e.minutes)).toEqual([180])
    expect(stored().subtasks?.[0].estimatedDuration).toBe(35)
    expect(stored().subtasks?.[0].estimateLog?.map((e) => e.minutes)).toEqual([20, 35])
    useTaskStore.getState().updateTask({ ...stored(), estimatedDuration: 180 })
    expect(stored().estimateLog).toHaveLength(1)
  })
})

describe("tierEstimates", () => {
  it("computes cumulative estimates across min (B), goal (B+G), and exceptional (B+G+E)", () => {
    const steps: Subtask[] = [
      s("b1", { tier: "min", estimatedDuration: 10 }),
      s("b2", { tier: "min", estimatedDuration: 15 }),
      s("g1", { tier: "goal", estimatedDuration: 20 }),
      s("e1", { tier: "exceptional", estimatedDuration: 30 }),
    ]
    const res = tierEstimates(steps, 50)
    // min = B only (10 + 15 = 25, 2 steps)
    expect(res.min.estimate).toBe(25)
    expect(res.min.parts).toBe(25)
    expect(res.min.stepCount).toBe(2)
    // goal = B + G (25 + 20 = 45, 3 steps)
    expect(res.goal.estimate).toBe(45)
    expect(res.goal.parts).toBe(45)
    expect(res.goal.stepCount).toBe(3)
    // exceptional = all (45 + 30 = 75 > ownEst 50, 4 steps)
    expect(res.exceptional.estimate).toBe(75)
    expect(res.exceptional.parts).toBe(75)
    expect(res.exceptional.stepCount).toBe(4)

    // When ownEst exceeds the total of all steps, exceptional takes max(ownEst, parts)
    const resWithLargerOwn = tierEstimates(steps, 100)
    expect(resWithLargerOwn.min.estimate).toBe(25)
    expect(resWithLargerOwn.goal.estimate).toBe(45)
    expect(resWithLargerOwn.exceptional.estimate).toBe(100)
  })

  it("computes original estimate from first estimateLog or estimatedDuration, falling back to actual only when never estimated", () => {
    const steps: Subtask[] = [
      // Had an initial estimate of 15 in estimateLog, later changed to 25, completed in 40m -> original uses 15
      s("s1", {
        tier: "min",
        estimatedDuration: 25,
        actualDuration: 40,
        completed: true,
        estimateLog: [
          { at: "2026-10-01T10:00:00.000Z", minutes: 15 },
          { at: "2026-10-02T10:00:00.000Z", minutes: 25 },
        ],
      }),
      // Never had an estimate, completed with actualDuration 12 -> original uses 12
      s("s2", {
        tier: "min",
        completed: true,
        actualDuration: 12,
      }),
      // Never had an estimate, completed with stepSpent 8 -> original uses 8
      s("s3", {
        tier: "goal",
        completed: true,
      }),
      // Never had an estimate, NOT completed -> original uses 0
      s("s4", {
        tier: "goal",
        completed: false,
      }),
      // Estimated at 20 (no log), completed in 35 -> original still uses 20 (not 35)
      s("s5", {
        tier: "exceptional",
        estimatedDuration: 20,
        actualDuration: 35,
        completed: true,
      }),
    ]
    const stepSpent = new Map<string, number>([["s3", 8]])
    const res = tierEstimates(steps, undefined, stepSpent)

    // min: s1 (15) + s2 (12) = 27
    expect(res.min.original).toBe(27)
    // goal: min (27) + s3 (8) + s4 (0) = 35
    expect(res.goal.original).toBe(35)
    // exceptional: goal (35) + s5 (20) = 55
    expect(res.exceptional.original).toBe(55)
  })

  it("computes running estimate using actual duration for completed steps where known and estimates otherwise", () => {
    const steps: Subtask[] = [
      // Completed with known actualDuration (18m vs 10m est) -> running uses 18
      s("b1", { tier: "min", estimatedDuration: 10, actualDuration: 18, completed: true }),
      // Completed but actualDuration is unknown (0) -> running falls back to estimate (15m)
      s("b2", { tier: "min", estimatedDuration: 15, completed: true }),
      // Incomplete step -> running uses estimate (20m) even if some time was already spent
      s("g1", { tier: "goal", estimatedDuration: 20, completed: false }),
      // Completed step whose actual comes from stepSpent map (22m vs 25m est) -> running uses 22
      s("e1", { tier: "exceptional", estimatedDuration: 25, completed: true }),
    ]
    const stepSpent = new Map<string, number>([
      ["g1", 5],
      ["e1", 22],
    ])
    const res = tierEstimates(steps, undefined, stepSpent)

    // min: b1 (18 actual) + b2 (15 fallback est) = 33
    expect(res.min.running).toBe(33)
    // goal: 33 + g1 (20 open est) = 53
    expect(res.goal.running).toBe(53)
    // exceptional: 53 + e1 (22 actual from stepSpent) = 75
    expect(res.exceptional.running).toBe(75)
  })
})

