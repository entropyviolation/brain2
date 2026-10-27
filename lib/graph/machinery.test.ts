import { describe, expect, it } from "vitest"
import { whatReadsThis, whereFrom } from "@/lib/graph/machinery"

describe("machinery", () => {
  it("names inputs and order derived", () => {
    const value = whereFrom("belief strength")
    expect(value?.order).toBe("derived")
    expect(value?.from.map((row) => row.id)).toEqual(["Item.links", "Source.trust"])
    expect(whereFrom("not a real derivation")).toBeNull()
  })

  it("lists what reads a pen or an item", () => {
    const penHits = whatReadsThis(
      { kind: "pen", id: "pen:park" },
      {
        items: [{ id: "walk", title: "Walk", penLinks: [{ penId: "park" }] }],
        pens: [{ id: "park", name: "Park", links: [{ penId: "social" }] }],
      },
    )
    expect(penHits.map((hit) => hit.reader)).toContain("item:walk")
    expect(penHits.every((hit) => hit.order === "derived")).toBe(true)

    const itemHits = whatReadsThis(
      { kind: "item", id: "goal" },
      { items: [{ id: "task", title: "Call", links: [{ relation: "action-of", targetId: "goal" }] }] },
    )
    expect(itemHits[0].how).toMatch(/action-of/)
  })
})
