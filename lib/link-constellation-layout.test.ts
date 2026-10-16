import { describe, expect, it } from "vitest"
import { layoutConstellation, layoutSecondRing } from "@/lib/link-constellation-layout"

const edges = [
  { key: "b|friends-with", otherId: "b", family: "friend" },
  { key: "a|sibling-of", otherId: "a", family: "family" },
  { key: "c|member-of", otherId: "c", family: "group" },
  { key: "d|friends-with", otherId: "d", family: "friend" },
]

describe("layoutConstellation", () => {
  it("is deterministic regardless of input order", () => {
    const one = layoutConstellation(edges, 400, 260)
    const two = layoutConstellation([...edges].reverse(), 400, 260)
    expect(two.nodes).toEqual(one.nodes)
  })

  it("gives families sectors in a fixed order that do not overlap and cover the circle", () => {
    const { sectors, nodes } = layoutConstellation(edges, 400, 260)
    expect(sectors.map((s) => s.family)).toEqual(["family", "friend", "group"])
    for (let i = 1; i < sectors.length; i++) expect(sectors[i].start).toBeCloseTo(sectors[i - 1].end)
    expect(sectors.at(-1)!.end - sectors[0].start).toBeCloseTo(Math.PI * 2)
    for (const node of nodes) {
      const s = sectors.find((x) => x.family === node.family)!
      expect(node.angle).toBeGreaterThan(s.start)
      expect(node.angle).toBeLessThan(s.end)
    }
  })

  it("places second-ring orbs further out than their neighbor", () => {
    const layout = layoutConstellation(edges, 400, 260)
    const ring = layoutSecondRing(layout, [{ from: "a", to: "z" }])
    const dist = Math.hypot(ring[0].x - layout.cx, ring[0].y - layout.cy)
    expect(dist).toBeGreaterThan(layout.radius * 1.5)
  })
})
