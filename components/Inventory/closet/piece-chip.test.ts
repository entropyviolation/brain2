import { describe, expect, it } from "vitest"
import { pieceChipId } from "./piece-chip"

describe("pieceChipId", () => {
  it("treats other with no subtype as uncategorized", () => {
    expect(pieceChipId({ category: "other" })).toBe("uncategorized")
    expect(pieceChipId({ category: "other", subtype: "  " })).toBe("uncategorized")
  })

  it("keeps a named category, including other with a subtype", () => {
    expect(pieceChipId({ category: "top" })).toBe("top")
    expect(pieceChipId({ category: "top", subtype: "Tee" })).toBe("top")
    expect(pieceChipId({ category: "other", subtype: "Scarf" })).toBe("other")
  })
})
