import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import {
  WARDROBE_STORAGE_KEY,
  latestOutfit,
  outfitsOnDay,
  sanitizeWardrobe,
  useWardrobeStore,
} from "./wardrobe"

describe("wardrobe", () => {
  beforeEach(() => resetAllStores())

  it("stores a look once and counts wears by piece id", () => {
    expect(WARDROBE_STORAGE_KEY).toBe("brain2-wardrobe")
    const jeans = useWardrobeStore.getState().addPiece({ name: "Jeans", category: "bottom", subtype: "Denim" })
    const tee = useWardrobeStore.getState().addPiece({ name: "Black tee", category: "top", subtype: "T-shirt" })
    const look = useWardrobeStore.getState().addOutfit({
      dayKey: "2026-10-02",
      startMin: 9 * 60,
      photoUri: "idb:look-1",
      pieceIds: [jeans!, tee!],
      source: "desk",
    })
    useWardrobeStore.getState().addOutfit({
      dayKey: "2026-10-04",
      startMin: 18 * 60,
      photoUri: "idb:look-2",
      pieceIds: [jeans!],
      source: "bim",
    })
    const outfits = useWardrobeStore.getState().outfits
    expect(outfits).toHaveLength(2)
    expect(outfits.filter((row) => row.pieceIds.includes(jeans!))).toHaveLength(2)
    expect(new Set(outfits.filter((row) => row.pieceIds.includes(jeans!)).map((row) => row.dayKey)).size).toBe(2)
    expect(outfitsOnDay(outfits, "2026-10-02")).toHaveLength(1)
    expect(latestOutfit(outfitsOnDay(outfits, "2026-10-02"))?.id).toBe(look)
    expect(outfits.every((row) => row.photoUri.startsWith("idb:"))).toBe(true)
  })

  it("drops a piece id when the piece is removed, and keeps the photo", () => {
    const belt = useWardrobeStore.getState().addPiece({ name: "Belt", category: "accessory", subtype: "Belt" })
    useWardrobeStore.getState().addOutfit({
      dayKey: "2026-10-02",
      startMin: 600,
      photoUri: "idb:look",
      pieceIds: [belt!],
    })
    useWardrobeStore.getState().removePiece(belt!)
    const outfit = useWardrobeStore.getState().outfits[0]
    expect(outfit?.pieceIds).toEqual([])
    expect(outfit?.photoUri).toBe("idb:look")
  })

  it("sanitizes an old blob", () => {
    const clean = sanitizeWardrobe({
      pieces: [{ id: "p1", name: "Coat", category: "layer" }, { id: "", name: "nope", category: "top" }],
      outfits: [{ id: "o1", dayKey: "2026-01-02", startMin: 10, photoUri: "idb:a", pieceIds: ["p1", "missing"] }],
    })
    expect(clean.pieces).toHaveLength(1)
    expect(clean.outfits[0]?.pieceIds).toEqual(["p1"])
  })
})
