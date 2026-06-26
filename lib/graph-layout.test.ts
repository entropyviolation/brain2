import { describe, it, expect } from "vitest"
import {
  topologicalRanks,
  layeredLayout,
  circularLayout,
  forceishLayout,
  boundingBox,
  type LayoutEdge,
} from "@/lib/graph-layout"

describe("topologicalRanks", () => {
  it("ranks a simple chain 0,1,2", () => {
    const edges: LayoutEdge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
    ]
    const { rank, layers } = topologicalRanks(["A", "B", "C"], edges)
    expect(rank).toEqual({ A: 0, B: 1, C: 2 })
    expect(layers).toEqual([["A"], ["B"], ["C"]])
  })

  it("uses the longest predecessor chain for the rank", () => {
    // A→B→D and A→D; D should be rank 2 (via B), not 1.
    const edges: LayoutEdge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "D" },
      { source: "A", target: "D" },
    ]
    const { rank } = topologicalRanks(["A", "B", "D"], edges)
    expect(rank.A).toBe(0)
    expect(rank.B).toBe(1)
    expect(rank.D).toBe(2)
  })

  it("puts disconnected nodes at rank 0", () => {
    const { rank, layers } = topologicalRanks(["X", "Y"], [])
    expect(rank).toEqual({ X: 0, Y: 0 })
    expect(layers).toEqual([["X", "Y"]])
  })

  it("tolerates cycles without infinite looping", () => {
    const edges: LayoutEdge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "A" },
    ]
    const { rank } = topologicalRanks(["A", "B"], edges)
    expect(Number.isFinite(rank.A)).toBe(true)
    expect(Number.isFinite(rank.B)).toBe(true)
  })
})

describe("layeredLayout", () => {
  it("increases x with topological rank", () => {
    const edges: LayoutEdge[] = [
      { source: "A", target: "B" },
      { source: "B", target: "C" },
    ]
    const pos = layeredLayout(["A", "B", "C"], edges, { columnGap: 100, originX: 0 })
    expect(pos.A.x).toBe(0)
    expect(pos.B.x).toBe(100)
    expect(pos.C.x).toBe(200)
  })

  it("stacks same-rank nodes vertically by row", () => {
    const pos = layeredLayout(["X", "Y", "Z"], [], { rowGap: 50, originY: 10 })
    expect(pos.X).toEqual({ x: 40, y: 10 })
    expect(pos.Y).toEqual({ x: 40, y: 60 })
    expect(pos.Z).toEqual({ x: 40, y: 110 })
  })
})

describe("circularLayout", () => {
  it("places a single node at the center", () => {
    expect(circularLayout(["only"], { centerX: 5, centerY: 7 })).toEqual({ only: { x: 5, y: 7 } })
  })

  it("places all nodes at the requested radius from center", () => {
    const pos = circularLayout(["A", "B", "C", "D"], { radius: 100, centerX: 0, centerY: 0 })
    for (const id of ["A", "B", "C", "D"]) {
      const d = Math.hypot(pos[id].x, pos[id].y)
      expect(d).toBeCloseTo(100)
    }
  })

  it("is deterministic", () => {
    const a = circularLayout(["A", "B", "C"])
    const b = circularLayout(["A", "B", "C"])
    expect(a).toEqual(b)
  })

  it("returns empty for no ids", () => {
    expect(circularLayout([])).toEqual({})
  })
})

describe("forceishLayout", () => {
  const ids = ["A", "B", "C", "D", "E"]
  const edges: LayoutEdge[] = [
    { source: "A", target: "B" },
    { source: "B", target: "C" },
    { source: "C", target: "D" },
    { source: "D", target: "E" },
  ]

  it("is deterministic for identical input", () => {
    const a = forceishLayout(ids, edges, { seed: "g1" })
    const b = forceishLayout(ids, edges, { seed: "g1" })
    expect(a).toEqual(b)
  })

  it("produces a position for every node within bounds", () => {
    const pos = forceishLayout(ids, edges, { width: 400, height: 300 })
    for (const id of ids) {
      expect(pos[id].x).toBeGreaterThanOrEqual(20)
      expect(pos[id].x).toBeLessThanOrEqual(400 - 20)
      expect(pos[id].y).toBeGreaterThanOrEqual(20)
      expect(pos[id].y).toBeLessThanOrEqual(300 - 20)
    }
  })

  it("separates nodes (no two coincident)", () => {
    const pos = forceishLayout(ids, edges)
    const seen = new Set<string>()
    for (const id of ids) {
      const key = `${Math.round(pos[id].x)},${Math.round(pos[id].y)}`
      expect(seen.has(key)).toBe(false)
      seen.add(key)
    }
  })

  it("centers a single node", () => {
    const pos = forceishLayout(["solo"], [], { width: 200, height: 100 })
    expect(pos.solo).toEqual({ x: 100, y: 50 })
  })
})

describe("boundingBox", () => {
  it("computes min/max with padding", () => {
    const box = boundingBox({ a: { x: 0, y: 0 }, b: { x: 10, y: 20 } }, 5)
    expect(box).toEqual({ minX: -5, minY: -5, maxX: 15, maxY: 25, width: 20, height: 30 })
  })

  it("is safe for an empty set", () => {
    expect(boundingBox({})).toEqual({ minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 })
  })
})
