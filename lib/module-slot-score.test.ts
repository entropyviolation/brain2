import { describe, expect, it } from "vitest"
import type { List } from "@/lib/types"
import type { ModulePackageSlot } from "@/lib/module-package"
import { SLOT_BIND_THRESHOLD, scoreSlot } from "@/lib/module-slot-score"

const FOUR = ["author", "year", "pages", "rating"] as const

function slot(policy: "create" | "bind", patch: Partial<ModulePackageSlot> = {}): ModulePackageSlot {
  return {
    role: "books",
    name: "Reading books",
    policy: policy as ModulePackageSlot["policy"],
    attributes: FOUR.map((id) => ({ id, name: id, type: "string" as const })),
    ...patch,
  }
}

function list(id: string, name: string, attrIds: string[]): List {
  return {
    id,
    name,
    color: "#64748b",
    createdAt: new Date("2026-01-01"),
    itemAttributes: attrIds.map((attrId) => ({ id: attrId, name: attrId, type: "string" })),
  }
}

describe("scoreSlot", () => {
  it("refuses a create-policy slot and does not choose a perfect list", () => {
    const lists = [list("books", "Reading books", [...FOUR])]
    const result = scoreSlot(lists, slot("create"))
    expect(result).toEqual({ decision: "none", candidates: [], refused: "create" })
    expect(result.listId).toBeUndefined()
  })

  it("binds the one list whose attribute ids match", () => {
    const result = scoreSlot(
      [list("other", "Zebra", ["zzz"]), list("books", "Shelf", [...FOUR])],
      slot("bind"),
    )
    expect(result.decision).toBe("bind")
    expect(result.listId).toBe("books")
    expect(result.refused).toBeUndefined()
    expect(result.candidates[0]?.listId).toBe("books")
  })

  it("binds a full cover with one extra column and asks when a second extra drops under the line", () => {
    const oneExtra = scoreSlot([list("books", "Shelf", [...FOUR, "notes"])], slot("bind"))
    expect(oneExtra.candidates[0]?.attributeOverlap).toBeCloseTo(4 / 5)
    expect(oneExtra.candidates[0]?.attributeOverlap).toBeGreaterThanOrEqual(SLOT_BIND_THRESHOLD)
    expect(oneExtra.decision).toBe("bind")
    expect(oneExtra.listId).toBe("books")

    const twoExtra = scoreSlot([list("books", "Shelf", [...FOUR, "notes", "shelf"])], slot("bind"))
    expect(twoExtra.candidates[0]?.attributeOverlap).toBeCloseTo(4 / 6)
    expect(twoExtra.candidates[0]?.attributeOverlap).toBeLessThan(SLOT_BIND_THRESHOLD)
    expect(twoExtra.decision).toBe("ask")
    expect(twoExtra.listId).toBeUndefined()
  })

  it("asks when a three-of-four overlap meets the Jaccard line but misses an id", () => {
    const result = scoreSlot([list("books", "Reading books", ["author", "year", "pages"])], slot("bind"))
    expect(result.candidates[0]?.attributeOverlap).toBeCloseTo(0.75)
    expect(result.decision).toBe("ask")
    expect(result.listId).toBeUndefined()
  })

  it("asks when two lists both clear the line", () => {
    const result = scoreSlot(
      [list("alpha", "Reading books", [...FOUR]), list("beta", "Shelf", [...FOUR, "notes"])],
      slot("bind"),
    )
    expect(result.decision).toBe("ask")
    expect(result.listId).toBeUndefined()
    expect(result.candidates.map((row) => row.listId)).toEqual(["alpha", "beta"])
  })

  it("uses the name to split two lists with the same attribute overlap", () => {
    const result = scoreSlot(
      [list("shelf", "Shelf", [...FOUR]), list("books", "Reading books", [...FOUR])],
      slot("bind"),
    )
    expect(result.decision).toBe("bind")
    expect(result.listId).toBe("books")
  })

  it("asks when attribute overlap and name tokens both tie", () => {
    const result = scoreSlot(
      [list("a", "Reading books", [...FOUR]), list("b", "Reading books", [...FOUR])],
      slot("bind"),
    )
    expect(result.decision).toBe("ask")
    expect(result.listId).toBeUndefined()
    expect(result.candidates).toHaveLength(2)
  })

  it("ranks a higher attribute overlap ahead of a better name", () => {
    const result = scoreSlot(
      [list("named", "Reading books", ["author"]), list("schema", "Zebra", [...FOUR])],
      slot("bind"),
    )
    expect(result.decision).toBe("bind")
    expect(result.listId).toBe("schema")
    expect(result.candidates.map((row) => row.listId)).toEqual(["schema", "named"])
  })

  it("asks on a name match when the slot declares no attributes", () => {
    const result = scoreSlot(
      [list("books", "Reading books", [])],
      slot("bind", { attributes: undefined }),
    )
    expect(result.decision).toBe("ask")
    expect(result.listId).toBeUndefined()
    expect(result.candidates).toEqual([
      { listId: "books", attributeOverlap: 0, nameOverlap: 1 },
    ])
  })

  it("returns none when nothing overlaps", () => {
    const result = scoreSlot([list("zebra", "Zebra", ["zzz"])], slot("bind"))
    expect(result).toEqual({ decision: "none", candidates: [] })
  })

  it("returns the best three overlapping lists", () => {
    const result = scoreSlot(
      [
        list("d", "Reading cart", ["zzz"]),
        list("a", "Reading shelf", ["zzz"]),
        list("c", "Reading pile", ["zzz"]),
        list("b", "Reading nook", ["zzz"]),
      ],
      slot("bind"),
    )
    expect(result.decision).toBe("ask")
    expect(result.candidates.map((row) => row.listId)).toEqual(["a", "b", "c"])
  })

  it("does not write the lists", () => {
    const lists = [list("books", "Reading books", [...FOUR])]
    const before = JSON.stringify(lists)
    scoreSlot(lists, slot("bind"))
    expect(JSON.stringify(lists)).toBe(before)
  })
})
