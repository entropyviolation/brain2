import { describe, expect, it } from "vitest"
import { collapseId, sameAsPairs } from "@/lib/graph/identity-walk"

describe("same-as collapse", () => {
  const items = [
    { id: "c", links: [{ relation: "same-as", targetId: "b" }, { relation: "different-from", targetId: "z" }] },
    { id: "b", links: [{ relation: "same-as", targetId: "a" }] },
    { id: "z", links: [{ relation: "different-from", targetId: "c" }] },
    { id: "m", links: [] },
  ]

  it("reads same-as pairs and ignores different-from", () => {
    expect(sameAsPairs(items)).toEqual([
      ["c", "b"],
      ["b", "a"],
    ])
  })

  it("collapses a component to the lexicographically smallest id", () => {
    const pairs = sameAsPairs(items)
    expect(collapseId("c", pairs)).toBe("a")
    expect(collapseId("b", pairs)).toBe("a")
    expect(collapseId("a", pairs)).toBe("a")
    expect(collapseId("z", pairs)).toBe("z")
    expect(collapseId("m", pairs)).toBe("m")
  })
})
