import { describe, expect, it } from "vitest"
import { isPackingList, packingRows } from "./packing-rows"

describe("packingRows", () => {
  it("reads packKind and packing lists, and skips ordinary tasks", () => {
    expect(isPackingList({ id: "pack-list", name: "Clothes" })).toBe(true)
    expect(isPackingList({ id: "novels", name: "Novels" })).toBe(false)
    const rows = packingRows(
      [
        { id: "a", title: "Passport", lists: ["trip"], packKind: "Documents" },
        { id: "b", title: "Middlemarch", lists: ["novels"] },
        { id: "c", title: "Socks", lists: ["pack-list"] },
      ],
      [
        { id: "trip", name: "Weekend" },
        { id: "novels", name: "Novels" },
        { id: "pack-list", name: "Packing" },
      ],
    )
    expect(rows.map((row) => row.title)).toEqual(["Socks", "Passport"])
    expect(rows[0]).toMatchObject({ listName: "Packing", kind: "" })
    expect(rows[1]).toMatchObject({ listName: "Weekend", kind: "Documents" })
  })

  it("is empty when nothing is packed", () => {
    expect(packingRows([{ id: "b", title: "Middlemarch", lists: ["novels"] }], [{ id: "novels", name: "Novels" }])).toEqual([])
  })
})
