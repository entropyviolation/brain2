import { describe, it, expect } from "vitest"
import {
  DEFAULT_PRIORITY_WEIGHTS,
  normalizePriorityInputs,
  priorityBreakdown,
  computePriorityScore,
  sortByPriority,
} from "./priority"
import type { PriorityWeights, Task } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t",
  description: "Task",
  stage: "clarified",
  createdAt: new Date(),
  completed: false,
  lists: [],
  ...overrides,
})

describe("normalizePriorityInputs", () => {
  it("maps each signal onto 0..1", () => {
    const n = normalizePriorityInputs({ urgency: 5, importance: 1, cognitiveLoad: 1, entropy: 0.5 })
    expect(n.urgency).toBe(1)
    expect(n.importance).toBe(0)
    expect(n.cognitiveLoad).toBe(1) // load 1 → quick win → max contribution
    expect(n.entropy).toBe(0.5)
  })

  it("inverts cognitive load so lower load ranks higher", () => {
    expect(normalizePriorityInputs({ cognitiveLoad: 3 }).cognitiveLoad).toBe(0)
    expect(normalizePriorityInputs({ cognitiveLoad: 1 }).cognitiveLoad).toBe(1)
  })

  it("applies neutral defaults for missing signals", () => {
    const n = normalizePriorityInputs({})
    expect(n.urgency).toBeCloseTo(0.5)
    expect(n.importance).toBeCloseTo(0.5)
    expect(n.cognitiveLoad).toBeCloseTo(0.5)
    expect(n.entropy).toBeCloseTo(0.5)
  })

  it("clamps out-of-range values", () => {
    const n = normalizePriorityInputs({ urgency: 99, entropy: 5 })
    expect(n.urgency).toBe(1)
    expect(n.entropy).toBe(1)
  })
})

describe("computePriorityScore", () => {
  it("is deterministic", () => {
    const t = task({ urgency: 4, importance: 5, cognitiveLoad: 2, entropy: 0.3 })
    expect(computePriorityScore(t)).toBe(computePriorityScore(t))
  })

  it("ranks an urgent+important quick win above a low-priority blob", () => {
    const high = task({ urgency: 5, importance: 5, cognitiveLoad: 1, entropy: 0.2 })
    const low = task({ urgency: 1, importance: 1, cognitiveLoad: 3, entropy: 0.2 })
    expect(computePriorityScore(high)).toBeGreaterThan(computePriorityScore(low))
  })

  it("bubbles up high-entropy (unclear) tasks via the entropy weight", () => {
    const clear = task({ urgency: 3, importance: 3, cognitiveLoad: 2, entropy: 0 })
    const murky = task({ urgency: 3, importance: 3, cognitiveLoad: 2, entropy: 1 })
    expect(computePriorityScore(murky)).toBeGreaterThan(computePriorityScore(clear))
  })

  it("defaults land in 0..4 with default weights", () => {
    const score = computePriorityScore(task({}))
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(4)
  })

  it("respects custom weights (zeroing a signal removes its influence)", () => {
    const weights: PriorityWeights = { urgency: 0, importance: 0, cognitiveLoad: 0, entropy: 1 }
    const t = task({ urgency: 5, importance: 5, cognitiveLoad: 1, entropy: 0.4 })
    expect(computePriorityScore(t, weights)).toBeCloseTo(0.4)
  })
})

describe("priorityBreakdown", () => {
  it("components sum to the total", () => {
    const b = priorityBreakdown(task({ urgency: 4, importance: 2, cognitiveLoad: 1, entropy: 0.7 }))
    expect(b.urgency + b.importance + b.cognitiveLoad + b.entropy).toBeCloseTo(b.total)
  })

  it("equals computePriorityScore with the same weights", () => {
    const t = task({ urgency: 2, importance: 4, cognitiveLoad: 3, entropy: 0.9 })
    expect(priorityBreakdown(t, DEFAULT_PRIORITY_WEIGHTS).total).toBeCloseTo(computePriorityScore(t))
  })
})

describe("sortByPriority", () => {
  it("orders by descending score, stable for ties", () => {
    const a = task({ id: "a", urgency: 1, importance: 1, cognitiveLoad: 3, entropy: 0 })
    const b = task({ id: "b", urgency: 5, importance: 5, cognitiveLoad: 1, entropy: 0.5 })
    const c = task({ id: "c", urgency: 1, importance: 1, cognitiveLoad: 3, entropy: 0 })
    const sorted = sortByPriority([a, b, c])
    expect(sorted[0].id).toBe("b")
    expect(sorted.map((t) => t.id)).toEqual(["b", "a", "c"])
  })

  it("does not mutate the input array", () => {
    const input = [task({ id: "a" }), task({ id: "b", urgency: 5, importance: 5 })]
    sortByPriority(input)
    expect(input.map((t) => t.id)).toEqual(["a", "b"])
  })
})
