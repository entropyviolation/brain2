import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import {
  WARDROBE_STORAGE_KEY,
  latestOutfit,
  migrateWardrobe,
  outfitsOnDay,
  sanitizeWardrobe,
  useWardrobeStore,
  withCompositionSlot,
} from "./wardrobe"

describe("wardrobe", () => {
  beforeEach(() => {
    resetAllStores()
    useWardrobeStore.setState({ compositions: [] })
  })

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
    expect(clean.compositions).toEqual([])
  })

  it("migrates an old save by adding an empty compositions array", () => {
    expect(migrateWardrobe({ pieces: [], outfits: [] }, 1)).toMatchObject({ compositions: [] })
    const kept = migrateWardrobe({ pieces: [], outfits: [], compositions: [{ id: "c1" }] }, 2) as {
      compositions: unknown[]
    }
    expect(kept.compositions).toHaveLength(1)
  })

  it("saves a composition and moves one slot", () => {
    const tee = useWardrobeStore.getState().addPiece({ name: "Black tee", category: "top" })
    const jeans = useWardrobeStore.getState().addPiece({ name: "Jeans", category: "bottom" })
    const moved = withCompositionSlot([{ pieceId: tee!, x: 0.2, y: 0.2 }], tee!, 1.4, -0.2)
    expect(moved).toEqual([{ pieceId: tee, x: 1, y: 0 }])
    const id = useWardrobeStore.getState().addComposition({
      name: "Rain",
      slots: withCompositionSlot(moved, jeans!, 0.4, 0.8),
      createdAt: 10,
    })
    expect(id).toBeTruthy()
    expect(useWardrobeStore.getState().updateComposition(id!, { slots: withCompositionSlot(moved, jeans!, 0.5, 0.6) })).toBe(true)
    const saved = useWardrobeStore.getState().compositions[0]
    expect(saved?.name).toBe("Rain")
    expect(saved?.pieceIds).toEqual([tee, jeans])
    expect(saved?.slots[1]).toEqual({ pieceId: jeans, x: 0.5, y: 0.6 })
    expect(saved?.createdAt).toBe(10)
  })

  it("drops a composition slot when its piece is removed and keeps the wear photo", () => {
    const tee = useWardrobeStore.getState().addPiece({ name: "Black tee", category: "top" })
    const jeans = useWardrobeStore.getState().addPiece({ name: "Jeans", category: "bottom" })
    useWardrobeStore.getState().addOutfit({
      dayKey: "2026-10-02",
      startMin: 600,
      photoUri: "idb:look",
      pieceIds: [tee!, jeans!],
    })
    useWardrobeStore.getState().addComposition({
      name: "Rain",
      slots: [
        { pieceId: tee!, x: 0.2, y: 0.2 },
        { pieceId: jeans!, x: 0.5, y: 0.7 },
      ],
    })
    useWardrobeStore.getState().removePiece(tee!)
    const composition = useWardrobeStore.getState().compositions[0]
    expect(composition?.pieceIds).toEqual([jeans])
    expect(composition?.slots).toEqual([{ pieceId: jeans, x: 0.5, y: 0.7 }])
    expect(useWardrobeStore.getState().outfits[0]?.photoUri).toBe("idb:look")
    expect(useWardrobeStore.getState().removeComposition(composition!.id)).toBeUndefined()
    expect(useWardrobeStore.getState().compositions).toEqual([])
  })
})
