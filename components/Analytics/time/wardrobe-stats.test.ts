import { describe, expect, it } from "vitest"
import { wearByCategory, wearByPiece, wearBySubtype } from "./wardrobe-stats"
import type { Outfit, Piece } from "@/lib/wardrobe"

const pieces: Piece[] = [
  { id: "tee", name: "Black tee", category: "top", subtype: "T-shirt" },
  { id: "shirt", name: "White shirt", category: "top", subtype: "Shirt" },
  { id: "jeans", name: "Jeans", category: "bottom" },
  { id: "belt", name: "Belt", category: "accessory", subtype: "Belt" },
]

const outfits: Outfit[] = [
  { id: "o1", dayKey: "2026-10-01", startMin: 600, photoUri: "idb:1", pieceIds: ["tee", "jeans", "belt"] },
  { id: "o2", dayKey: "2026-10-01", startMin: 900, photoUri: "idb:2", pieceIds: ["tee", "shirt"] },
  { id: "o3", dayKey: "2026-10-08", startMin: 600, photoUri: "idb:3", pieceIds: ["jeans"] },
]

describe("wardrobe wear stats", () => {
  const range = ["2026-10-01", "2026-10-02"]

  it("counts one wear per outfit and keeps unworn pieces at the bottom", () => {
    const rows = wearByPiece(pieces, outfits, range, "2026-10-04")
    expect(rows.find((row) => row.pieceId === "tee")).toMatchObject({
      timesWorn: 2,
      daysWorn: 1,
      lastWorn: "2026-10-01",
      daysSince: 3,
      dayKeys: ["2026-10-01"],
    })
    expect(rows.find((row) => row.pieceId === "jeans")?.timesWorn).toBe(1)
    expect(rows.filter((row) => row.timesWorn === 0)).toEqual([])
    expect(rows[0]?.pieceId).toBe("tee")
    const quiet = wearByPiece(pieces, outfits, ["2026-10-02"], "2026-10-04")
    expect(quiet.every((row) => row.timesWorn === 0)).toBe(true)
    expect(quiet.map((row) => row.name)).toEqual(["Belt", "Black tee", "Jeans", "White shirt"])
  })

  it("counts a look once per category and sums piece-links beside that", () => {
    const categories = wearByCategory(pieces, outfits, range)
    expect(categories.find((row) => row.category === "top")).toMatchObject({ outfits: 2, links: 3 })
    expect(categories.find((row) => row.category === "bottom")).toMatchObject({ outfits: 1, links: 1 })
    expect(categories.find((row) => row.category === "accessory")).toMatchObject({ outfits: 1, links: 1 })
    const subtypes = wearBySubtype(pieces, outfits, range)
    expect(subtypes.find((row) => row.subtype === "T-shirt")).toMatchObject({ outfits: 2, links: 2 })
    expect(subtypes.map((row) => row.subtype)).toEqual(["T-shirt", "Belt", "Shirt"])
  })
})
