import { describe, expect, it } from "vitest"
import type { List } from "@/lib/types"
import {
  assignTypeToList,
  listAllowedTypeIds,
  listHasMultipleAllowedTypes,
  normalizeListTypeAssignment,
  sanitizeListItemTypeIds,
  setListDefaultItemType,
  toggleListAllowedType,
} from "@/lib/list-item-types"

const list = (partial: Partial<List> = {}): List => ({
  id: "l1",
  name: "Test",
  color: "#000",
  createdAt: new Date("2026-01-01"),
  ...partial,
})

describe("listAllowedTypeIds", () => {
  it("prefers explicit allowlist", () => {
    expect(listAllowedTypeIds(list({ itemTypeId: "book", itemTypeIds: ["film", "book"] }))).toEqual([
      "film",
      "book",
    ])
  })

  it("falls back to single default", () => {
    expect(listAllowedTypeIds(list({ itemTypeId: "book" }))).toEqual(["book"])
  })

  it("returns empty when neither is set", () => {
    expect(listAllowedTypeIds(list())).toEqual([])
  })
})

describe("sanitizeListItemTypeIds", () => {
  it("dedupes and drops empties", () => {
    expect(sanitizeListItemTypeIds(["film", "", "film", " book "])).toEqual(["film", "book"])
  })
})

describe("assign / toggle / default", () => {
  it("assignTypeToList adds to allowlist and sets default", () => {
    const next = assignTypeToList(list(), "film", true)
    expect(next.itemTypeId).toBe("film")
    expect(next.itemTypeIds).toEqual(["film"])
  })

  it("toggle off clears default when it was the last type", () => {
    const next = toggleListAllowedType(list({ itemTypeId: "film", itemTypeIds: ["film"] }), "film", false)
    expect(next.itemTypeId).toBeUndefined()
    expect(next.itemTypeIds).toBeUndefined()
  })

  it("toggle off moves default to the remaining type", () => {
    const next = toggleListAllowedType(
      list({ itemTypeId: "film", itemTypeIds: ["film", "book"] }),
      "film",
      false,
    )
    expect(next.itemTypeIds).toEqual(["book"])
    expect(next.itemTypeId).toBe("book")
  })

  it("setListDefaultItemType adds missing type to allowlist", () => {
    const next = setListDefaultItemType(list({ itemTypeIds: ["book"] }), "film")
    expect(next.itemTypeIds).toEqual(["book", "film"])
    expect(next.itemTypeId).toBe("film")
  })

  it("normalize keeps default inside allowlist", () => {
    const next = normalizeListTypeAssignment(list({ itemTypeId: "ghost", itemTypeIds: ["film"] }))
    expect(next.itemTypeId).toBe("film")
  })

  it("listHasMultipleAllowedTypes", () => {
    expect(listHasMultipleAllowedTypes(list({ itemTypeIds: ["a", "b"] }))).toBe(true)
    expect(listHasMultipleAllowedTypes(list({ itemTypeId: "a" }))).toBe(false)
  })
})
