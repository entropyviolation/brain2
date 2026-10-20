import { describe, expect, it } from "vitest"
import type { Subtask } from "@/lib/types"
import { splitStats, tierSplit, treeDepth } from "@/lib/tree-math"
import { effectiveTierMap } from "@/lib/step-tiers"

const leaf = (id: string, completed = false, tier?: Subtask["tier"]) => ({ id, description: id, completed, tier }) as Subtask
const node = (id: string, kids: Subtask[], tier?: Subtask["tier"]) => ({ id, description: id, completed: false, subtasks: kids, tier }) as Subtask

// a: 1/2, b: 2/2, c: 1/4 (c nests one level deeper)
const tree = [
  node("a", [leaf("a1", true), leaf("a2")]),
  node("b", [leaf("b1", true), leaf("b2", true)], "min"),
  node("c", [node("c1", [leaf("c1a", true), leaf("c1b")]), leaf("c2"), leaf("c3")]),
]

describe("tree-math", () => {
  it("raw and split", () => {
    const s = splitStats(tree, effectiveTierMap(tree))
    expect(s.raw).toBe(0.5)
    expect(s.split).toBeCloseTo((0.5 + 1 + 0.25) / 3)
    expect(treeDepth(tree)).toBe(3)
  })
  it("levels split by exact tier, ticked parent counts its leaves", () => {
    const t = tierSplit(tree)
    expect(t.min?.split).toBe(1)
    expect(t.goal?.split).toBeCloseTo((0.5 + 0.25) / 2)
    expect(t.exceptional).toBeNull()
    const ticked = [{ ...tree[2], completed: true }]
    expect(splitStats(ticked, effectiveTierMap(ticked)).raw).toBe(1)
  })
})
