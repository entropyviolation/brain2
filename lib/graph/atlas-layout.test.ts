/**
 * Atlas layout — same input, same points; the degree cap; community cells; hops.
 */
import { describe, expect, it } from "vitest"
import { atlasLayout, capByDegree, degreeOf, hopsFrom, NO_COMMUNITY } from "./atlas-layout"

const ids = ["a", "b", "c", "d", "e", "f"]
const edges = [
  { s: "a", o: "b" },
  { s: "a", o: "c" },
  { s: "a", o: "d" },
  { s: "b", o: "c" },
  { s: "e", o: "f" },
  { s: "f", o: "f" },
]

describe("atlasLayout", () => {
  it("returns the same points for the same input", () => {
    const one = atlasLayout(ids, edges)
    const two = atlasLayout([...ids].reverse(), [...edges])
    expect(two.points).toEqual(one.points)
    for (const p of one.points) {
      expect(Number.isFinite(p.x)).toBe(true)
      expect(Number.isFinite(p.y)).toBe(true)
    }
  })

  it("a different seed moves the points", () => {
    const one = atlasLayout(ids, edges, { seed: "x" })
    const two = atlasLayout(ids, edges, { seed: "y" })
    expect(two.points).not.toEqual(one.points)
  })

  it("counts degree without self-loops or outside ids", () => {
    const d = degreeOf(ids, [...edges, { s: "a", o: "zz" }])
    expect(d.get("a")).toBe(3)
    expect(d.get("f")).toBe(1)
  })

  it("caps by degree, ties by id, and keeps a focused node", () => {
    const d = degreeOf(ids, edges)
    expect(capByDegree(ids, d, 2)).toEqual(["a", "b"])
    expect(capByDegree(ids, d, 2, ["e", "missing"])).toEqual(["a", "b", "e"])
    const layout = atlasLayout(ids, edges, { cap: 3 })
    expect(layout.shown).toBe(3)
    expect(layout.total).toBe(6)
    expect(layout.points.map((p) => p.id)).toEqual(["a", "b", "c"])
  })

  it("packs one cell per community, largest first", () => {
    const communities = new Map<string, string>([
      ["a", "x"],
      ["b", "x"],
      ["c", "x"],
      ["e", "y"],
    ])
    const layout = atlasLayout(ids, edges, { communities })
    expect(layout.communityOrder[0]).toBe("x")
    expect(layout.at.get("d")?.community).toBe(NO_COMMUNITY)
    expect(layout.at.get("e")?.community).toBe("y")
    expect(atlasLayout(ids, edges, { communities }).points).toEqual(layout.points)
  })
})

describe("hopsFrom", () => {
  it("reads one and two hops, both directions", () => {
    const hops = hopsFrom("d", edges, 2)
    expect(hops.get("d")).toBe(0)
    expect(hops.get("a")).toBe(1)
    expect(hops.get("b")).toBe(2)
    expect(hops.has("e")).toBe(false)
    expect(hopsFrom("d", edges, 1).has("b")).toBe(false)
  })
})
