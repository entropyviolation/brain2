import { describe, expect, it } from "vitest"
import {
  buildForceLinkStrokes,
  buildProximityEdges,
  FORCE_LINK_STYLE,
  forceLinkControlPoint,
  forceLinkIsHeavy,
  forceLinkOpacity,
  forceLinkPath,
  forceLinkStrokeWidth,
  nodesFromCenters,
  nodesFromIconPositions,
  normalizeForceLinkEdges,
  type ForceLinkEdge,
  type ForceLinkNode,
} from "@/components/Lists/lib/list-icon-force-links"
import {
  flingGhostOpacity,
  pruneFlingTrail,
  pushFlingSample,
} from "@/components/Lists/lib/list-icon-fling-juice"
import { VELVET_ICON_CELL } from "@/components/Lists/lib/velvet-icon-grid"

describe("force-link weight mapping", () => {
  it("maps heavier weight to higher opacity and wider stroke", () => {
    const light = 0.4
    const heavy = 2.8
    expect(forceLinkOpacity(heavy)).toBeGreaterThan(forceLinkOpacity(light))
    expect(forceLinkStrokeWidth(heavy)).toBeGreaterThan(forceLinkStrokeWidth(light))
    expect(forceLinkOpacity(FORCE_LINK_STYLE.MAX_WEIGHT)).toBeCloseTo(FORCE_LINK_STYLE.MAX_OPACITY, 5)
    expect(forceLinkOpacity(0)).toBe(0)
    expect(forceLinkStrokeWidth(0)).toBe(0)
  })

  it("flags heavy edges at the HEAVY_AT threshold", () => {
    expect(forceLinkIsHeavy(FORCE_LINK_STYLE.HEAVY_AT)).toBe(true)
    expect(forceLinkIsHeavy(FORCE_LINK_STYLE.HEAVY_AT - 0.01)).toBe(false)
  })

  it("normalizes undirected edges and drops isolates / junk weights", () => {
    const edges = normalizeForceLinkEdges([
      { a: "b", b: "a", weight: 1.2 },
      { a: "a", b: "b", weight: 9 }, // duplicate — first wins after normalize order
      { a: "a", b: "a", weight: 1 },
      { a: "c", b: "d", weight: 0 },
    ])
    expect(edges).toHaveLength(1)
    expect(edges[0]).toEqual({ a: "a", b: "b", weight: 1.2 })
  })
})

describe("force-link edge geometry", () => {
  const nodes: ForceLinkNode[] = [
    { id: "a", x: 0, y: 0 },
    { id: "b", x: 100, y: 0 },
    { id: "c", x: 50, y: 80 },
  ]

  it("builds a straight path and a curved quadratic with perpendicular bulge", () => {
    expect(forceLinkPath(0, 0, 100, 0, false)).toBe("M 0 0 L 100 0")
    const curved = forceLinkPath(0, 0, 100, 0, true)
    expect(curved.startsWith("M 0 0 Q ")).toBe(true)
    const ctrl = forceLinkControlPoint(0, 0, 100, 0)
    // Chord along +x → perpendicular is +y (or -y); bulge is non-zero.
    expect(ctrl.x).toBeCloseTo(50, 5)
    expect(Math.abs(ctrl.y)).toBeCloseTo(100 * FORCE_LINK_STYLE.CURVE_BULGE, 5)
  })

  it("builds strokes with opacity/width from weight and skips missing nodes", () => {
    const edges: ForceLinkEdge[] = [
      { a: "a", b: "b", weight: 0.5 },
      { a: "a", b: "c", weight: 2.5 },
      { a: "a", b: "missing", weight: 3 },
    ]
    const strokes = buildForceLinkStrokes(nodes, edges, { curved: true })
    expect(strokes).toHaveLength(2)
    expect(strokes[0]!.weight).toBeLessThan(strokes[1]!.weight)
    expect(strokes[1]!.heavy).toBe(true)
    expect(strokes[1]!.opacity).toBeGreaterThan(strokes[0]!.opacity)
    expect(strokes[0]!.d).toContain("Q")
  })

  it("keeps heaviest cords when over MAX_STROKES budget", () => {
    const manyNodes: ForceLinkNode[] = Array.from({ length: 40 }, (_, i) => ({
      id: `n${i}`,
      x: (i % 8) * 40,
      y: Math.floor(i / 8) * 40,
    }))
    const edges: ForceLinkEdge[] = []
    for (let i = 0; i < manyNodes.length; i++) {
      for (let j = i + 1; j < manyNodes.length; j++) {
        edges.push({ a: manyNodes[i]!.id, b: manyNodes[j]!.id, weight: (i + j) % 3 === 0 ? 2.5 : 0.3 })
      }
    }
    const strokes = buildForceLinkStrokes(manyNodes, edges, {
      maxStrokes: 12,
    })
    expect(strokes.length).toBe(12)
    expect(strokes.every((s) => s.weight >= strokes[0]!.weight)).toBe(true)
  })

  it("converts velvet top-left positions to centers", () => {
    const nodesFromPos = nodesFromIconPositions({
      a: { x: 10, y: 20 },
    })
    expect(nodesFromPos[0]).toEqual({
      id: "a",
      x: 10 + VELVET_ICON_CELL.w / 2,
      y: 20 + VELVET_ICON_CELL.h / 2,
    })
    expect(nodesFromCenters([{ id: "z", x: 1, y: 2 }])).toEqual([{ id: "z", x: 1, y: 2 }])
  })
})

describe("proximity edges (PILE juice)", () => {
  it("links near neighbors and drops far pairs", () => {
    const nodes: ForceLinkNode[] = [
      { id: "a", x: 0, y: 0 },
      { id: "b", x: 40, y: 0 },
      { id: "c", x: 400, y: 0 },
    ]
    const edges = buildProximityEdges(nodes, { maxDist: 100, maxPerNode: 2 })
    expect(edges.some((e) => e.a === "a" && e.b === "b")).toBe(true)
    expect(edges.every((e) => e.a !== "c" && e.b !== "c")).toBe(true)
    expect(edges[0]!.weight).toBeGreaterThan(0)
  })
})

describe("fling ghost helpers", () => {
  it("pushes samples with min-step and prunes by age", () => {
    let trail = pushFlingSample([], 0, 0, 1000)
    trail = pushFlingSample(trail, 2, 0, 1010) // too close — no add
    expect(trail).toHaveLength(1)
    trail = pushFlingSample(trail, 40, 0, 1020)
    expect(trail).toHaveLength(2)
    trail = pruneFlingTrail(trail, 1300, 200)
    expect(trail).toHaveLength(0)
  })

  it("fades ghost opacity with age", () => {
    const sample = { x: 0, y: 0, t: 1000 }
    expect(flingGhostOpacity(sample, 1000)).toBeGreaterThan(flingGhostOpacity(sample, 1100))
    expect(flingGhostOpacity(sample, 2000, 220)).toBe(0)
  })
})
