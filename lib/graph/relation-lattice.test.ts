import { describe, expect, it } from "vitest"
import { buildLattice, unexplainedInverses } from "@/lib/graph/relation-lattice"

const defs = [
  { id: "knows" },
  { id: "family-of", parent: "knows" },
  { id: "parent-of", parent: "family-of" },
  { id: "mother-of", parent: "parent-of" },
  { id: "sibling-of", parent: "family-of" },
]

describe("relation lattice", () => {
  it("walks mother-of ⊑ parent-of ⊑ family-of ⊑ knows ⊑ related", () => {
    const l = buildLattice(defs)
    expect(l.ancestors("mother-of")).toEqual(["parent-of", "family-of", "knows", "related"])
    expect(l.isSubrelation("mother-of", "family-of")).toBe(true)
    expect(l.isSubrelation("family-of", "mother-of")).toBe(false)
    expect(l.depth("mother-of")).toBe(4)
    expect(l.depth("related")).toBe(0)
    expect(l.meet("mother-of", "sibling-of")).toBe("family-of")
    expect(l.descendants("family-of")).toEqual(["parent-of", "sibling-of", "mother-of"])
    expect(l.checks).toEqual([])
  })

  it("parents an unknown id to related", () => {
    const l = buildLattice(defs)
    expect(l.ancestors("made-up")).toEqual(["related"])
    expect(l.isSubrelation("made-up", "related")).toBe(true)
    expect(l.meet("made-up", "mother-of")).toBe("related")
  })

  it("cuts a parent cycle at the first repeat and reports it", () => {
    const l = buildLattice([
      { id: "a", parent: "b" },
      { id: "b", parent: "c" },
      { id: "c", parent: "a" },
    ])
    expect(l.checks).toHaveLength(1)
    expect(l.checks[0].ids).toEqual(["a", "b", "c"])
    expect(l.ancestors("a")).toEqual(["b", "c", "related"])
    expect(l.ancestors("c")).toEqual(["related"])
  })

  it("parents an alias to its target", () => {
    const l = buildLattice([...defs, { id: "rel-mom", aliasOf: "mother-of" }])
    expect(l.isSubrelation("rel-mom", "parent-of")).toBe(true)
  })

  it("explains a many-to-one inverse only through the hierarchy", () => {
    const pairs = [
      { id: "parent-of", inverse: "child-of" },
      { id: "child-of", inverse: "parent-of" },
      { id: "mother-of", inverse: "child-of" },
    ]
    expect(unexplainedInverses(pairs, buildLattice(defs))).toEqual([])
    expect(unexplainedInverses(pairs, buildLattice([{ id: "mother-of" }])).map((x) => x.id)).toEqual(["mother-of"])
  })
})
