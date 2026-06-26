import { describe, it, expect } from "vitest"
import {
  pertExpected,
  pertVariance,
  pertStdDev,
  taskDuration,
  computeCriticalPath,
  isCriticalEdge,
  criticalEdgeKeys,
  type CpmTask,
} from "@/lib/critical-path"

describe("PERT helpers", () => {
  it("computes expected time as (o + 4l + p) / 6", () => {
    expect(pertExpected({ optimistic: 2, likely: 4, pessimistic: 12 })).toBeCloseTo(5)
    expect(pertExpected({ optimistic: 6, likely: 6, pessimistic: 6 })).toBe(6)
  })

  it("computes variance and std dev from the o..p spread", () => {
    expect(pertVariance({ optimistic: 2, likely: 4, pessimistic: 12 })).toBeCloseTo((10 / 6) ** 2)
    expect(pertStdDev({ optimistic: 2, likely: 4, pessimistic: 12 })).toBeCloseTo(10 / 6)
  })
})

describe("taskDuration", () => {
  it("prefers PERT expected when a three-point estimate is present", () => {
    expect(taskDuration({ id: "x", pertEstimate: { optimistic: 1, likely: 4, pessimistic: 7 }, estimatedDuration: 99 })).toBeCloseTo(4)
  })
  it("falls back to estimatedDuration", () => {
    expect(taskDuration({ id: "x", estimatedDuration: 30 })).toBe(30)
  })
  it("treats missing/invalid durations as 0", () => {
    expect(taskDuration({ id: "x" })).toBe(0)
    expect(taskDuration({ id: "x", estimatedDuration: -5 })).toBe(0)
  })
})

describe("computeCriticalPath — textbook example (diamond network)", () => {
  // A(3) ─▶ C(4) ─┐
  //               ├─▶ E(1)
  // B(2) ─▶ D(2) ─┘
  // Hand-computed critical path: A → C → E, project length 8.
  const tasks: CpmTask[] = [
    { id: "A", estimatedDuration: 3 },
    { id: "B", estimatedDuration: 2 },
    { id: "C", estimatedDuration: 4, dependencies: ["A"] },
    { id: "D", estimatedDuration: 2, dependencies: ["B"] },
    { id: "E", estimatedDuration: 1, dependencies: ["C", "D"] },
  ]
  const result = computeCriticalPath(tasks)

  it("project duration is 8", () => {
    expect(result.projectDuration).toBe(8)
    expect(result.hasCycle).toBe(false)
  })

  it("earliest start/finish match the forward pass", () => {
    expect(result.nodes.A).toMatchObject({ earliestStart: 0, earliestFinish: 3 })
    expect(result.nodes.B).toMatchObject({ earliestStart: 0, earliestFinish: 2 })
    expect(result.nodes.C).toMatchObject({ earliestStart: 3, earliestFinish: 7 })
    expect(result.nodes.D).toMatchObject({ earliestStart: 2, earliestFinish: 4 })
    expect(result.nodes.E).toMatchObject({ earliestStart: 7, earliestFinish: 8 })
  })

  it("latest start/finish match the backward pass", () => {
    expect(result.nodes.A).toMatchObject({ latestStart: 0, latestFinish: 3 })
    expect(result.nodes.B).toMatchObject({ latestStart: 3, latestFinish: 5 })
    expect(result.nodes.C).toMatchObject({ latestStart: 3, latestFinish: 7 })
    expect(result.nodes.D).toMatchObject({ latestStart: 5, latestFinish: 7 })
    expect(result.nodes.E).toMatchObject({ latestStart: 7, latestFinish: 8 })
  })

  it("slack is zero only on the critical chain", () => {
    expect(result.nodes.A.slack).toBe(0)
    expect(result.nodes.C.slack).toBe(0)
    expect(result.nodes.E.slack).toBe(0)
    expect(result.nodes.B.slack).toBe(3)
    expect(result.nodes.D.slack).toBe(3)
  })

  it("identifies the critical path A → C → E", () => {
    expect(result.criticalPath).toEqual(["A", "C", "E"])
    expect(result.nodes.A.isOnCriticalPath).toBe(true)
    expect(result.nodes.C.isOnCriticalPath).toBe(true)
    expect(result.nodes.E.isOnCriticalPath).toBe(true)
    expect(result.nodes.B.isOnCriticalPath).toBe(false)
    expect(result.nodes.D.isOnCriticalPath).toBe(false)
  })

  it("flags only the tight critical edges", () => {
    expect(isCriticalEdge(result, "A", "C")).toBe(true)
    expect(isCriticalEdge(result, "C", "E")).toBe(true)
    expect(isCriticalEdge(result, "B", "D")).toBe(false)
    expect(isCriticalEdge(result, "D", "E")).toBe(false)
    expect(criticalEdgeKeys(result, tasks)).toEqual(new Set(["A->C", "C->E"]))
  })
})

describe("computeCriticalPath — second textbook example", () => {
  // A(6) ─▶ B(4) ─▶ D(2)
  //   └────▶ C(3) ──┘
  // Critical path: A → B → D, project length 12; C has 1 unit of slack.
  const tasks: CpmTask[] = [
    { id: "A", estimatedDuration: 6 },
    { id: "B", estimatedDuration: 4, dependencies: ["A"] },
    { id: "C", estimatedDuration: 3, dependencies: ["A"] },
    { id: "D", estimatedDuration: 2, dependencies: ["B", "C"] },
  ]
  const result = computeCriticalPath(tasks)

  it("computes the expected schedule", () => {
    expect(result.projectDuration).toBe(12)
    expect(result.criticalPath).toEqual(["A", "B", "D"])
    expect(result.nodes.C.slack).toBe(1)
    expect(result.nodes.C.isOnCriticalPath).toBe(false)
  })
})

describe("computeCriticalPath — PERT durations", () => {
  it("uses PERT expected time as the activity duration", () => {
    // A expected = (2+4*5+8)/6 = 5; B expected = (1+4*1+1)/6 = 1.
    const tasks: CpmTask[] = [
      { id: "A", pertEstimate: { optimistic: 2, likely: 5, pessimistic: 8 } },
      { id: "B", pertEstimate: { optimistic: 1, likely: 1, pessimistic: 1 }, dependencies: ["A"] },
    ]
    const result = computeCriticalPath(tasks)
    expect(result.nodes.A.duration).toBeCloseTo(5)
    expect(result.projectDuration).toBeCloseTo(6)
    expect(result.criticalPath).toEqual(["A", "B"])
  })
})

describe("computeCriticalPath — edge cases", () => {
  it("handles an empty network", () => {
    const result = computeCriticalPath([])
    expect(result.projectDuration).toBe(0)
    expect(result.criticalPath).toEqual([])
    expect(result.hasCycle).toBe(false)
  })

  it("ignores dependencies on unknown ids and self-references", () => {
    const result = computeCriticalPath([
      { id: "A", estimatedDuration: 5, dependencies: ["ghost", "A"] },
    ])
    expect(result.projectDuration).toBe(5)
    expect(result.nodes.A.isOnCriticalPath).toBe(true)
  })

  it("detects a cycle and flags it without throwing", () => {
    const result = computeCriticalPath([
      { id: "A", estimatedDuration: 1, dependencies: ["B"] },
      { id: "B", estimatedDuration: 1, dependencies: ["A"] },
    ])
    expect(result.hasCycle).toBe(true)
    expect(result.criticalPath).toEqual([])
  })

  it("treats two independent tasks as parallel (shorter one has slack)", () => {
    const result = computeCriticalPath([
      { id: "A", estimatedDuration: 5 },
      { id: "B", estimatedDuration: 2 },
    ])
    expect(result.projectDuration).toBe(5)
    expect(result.nodes.A.isOnCriticalPath).toBe(true)
    expect(result.nodes.B.slack).toBe(3)
    expect(result.nodes.B.isOnCriticalPath).toBe(false)
  })
})
