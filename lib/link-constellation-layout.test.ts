import { describe, expect, it } from "vitest"
import { CROWD, RING1, bodiesHome, layoutPlate, springHome } from "@/lib/link-constellation-layout"
import type { EgoEdge } from "@/lib/link-graph"
import type { RelationFamily } from "@/lib/links"

function edge(otherId: string, relation: string, family: RelationFamily): EgoEdge {
  return { key: `${otherId}|${relation}`, otherId, relation, direction: "out", family }
}

const SIZE = { width: 400, height: 260 }

describe("layoutPlate", () => {
  const edges = [
    edge("b", "works-with", "work"),
    edge("a", "friends-with", "friend"),
    edge("c", "sibling-of", "family"),
    edge("d", "friends-with", "friend"),
  ]

  it("is deterministic and ignores input order", () => {
    const one = layoutPlate(edges, SIZE)
    const two = layoutPlate([...edges].reverse(), SIZE)
    expect(two).toEqual(one)
  })

  it("puts families in fixed order with sectors sized by count that do not overlap", () => {
    const { sectors } = layoutPlate(edges, SIZE)
    expect(sectors.map((s) => s.family)).toEqual(["family", "friend", "work"])
    expect(sectors.map((s) => s.count)).toEqual([1, 2, 1])
    for (let i = 1; i < sectors.length; i++) expect(sectors[i]!.start).toBeGreaterThan(sectors[i - 1]!.end)
    const spans = sectors.map((s) => s.end - s.start)
    expect(spans[1]).toBeCloseTo(spans[0]! * 2)
    const last = sectors.at(-1)!
    expect(last.end - sectors[0]!.start).toBeLessThan(Math.PI * 2)
  })

  it("places ring 1 at 38% of the short side, nodes inside their sector", () => {
    const { nodes, sectors, center } = layoutPlate(edges, SIZE)
    for (const node of nodes) {
      expect(Math.hypot(node.x - center.x, node.y - center.y)).toBeCloseTo(260 * RING1)
      const s = sectors.find((row) => row.family === node.family)!
      expect(node.angle).toBeGreaterThan(s.start)
      expect(node.angle).toBeLessThan(s.end)
    }
  })

  it("alternates an inner radius when a sector is crowded", () => {
    const many = Array.from({ length: CROWD + 2 }, (_, i) => edge(`p${String(i).padStart(2, "0")}`, "knows", "friend"))
    const radii = new Set(layoutPlate(many, SIZE).nodes.map((n) => Math.round(n.r)))
    expect(radii.size).toBe(2)
  })

  it("fans ring 2 around the ring-1 item that reaches it", () => {
    const { nodes } = layoutPlate(edges, SIZE, [{ from: "a", edge: edge("z", "knows", "friend") }])
    const outer = nodes.find((n) => n.ring === 2)!
    const parent = nodes.find((n) => n.otherId === "a")!
    expect(outer.from).toBe("a")
    expect(outer.angle).toBeCloseTo(parent.angle)
    expect(outer.r).toBeGreaterThan(parent.r)
  })
})

describe("springHome", () => {
  it("pulls a flung body back to its slot and leaves held ones alone", () => {
    const slots = new Map([["a", { x: 100, y: 100 }], ["b", { x: 0, y: 0 }]])
    let bodies = [
      { id: "a", x: 160, y: 40, vx: 300, vy: -200 },
      { id: "b", x: 50, y: 50, vx: 0, vy: 0, held: true },
    ]
    for (let i = 0; i < 400; i++) bodies = springHome(bodies, slots, 1 / 60)
    expect(bodies[0]!.x).toBeCloseTo(100, 0)
    expect(bodies[0]!.y).toBeCloseTo(100, 0)
    expect(bodies[1]).toMatchObject({ x: 50, y: 50 })
    expect(bodiesHome([bodies[0]!], slots)).toBe(true)
  })
})
