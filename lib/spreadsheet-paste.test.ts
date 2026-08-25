/**
 * spreadsheet-paste — expandPasteWrites tiling vs block paste.
 */
import { describe, expect, it } from "vitest"
import { normalizeRange } from "./spreadsheet-keys"
import { expandPasteWrites } from "./spreadsheet-paste"

describe("expandPasteWrites", () => {
  it("places a block relative to the start cell", () => {
    expect(expandPasteWrites([["a", "b"], ["c", "d"]], { row: 1, col: 2 }, null)).toEqual([
      { row: 1, col: 2, text: "a" },
      { row: 1, col: 3, text: "b" },
      { row: 2, col: 2, text: "c" },
      { row: 2, col: 3, text: "d" },
    ])
  })

  it("tiles a single value across a multi-cell selection", () => {
    const sel = normalizeRange({ row: 0, col: 0 }, { row: 1, col: 1 })
    expect(expandPasteWrites([["x"]], { row: 0, col: 0 }, sel)).toEqual([
      { row: 0, col: 0, text: "x" },
      { row: 0, col: 1, text: "x" },
      { row: 1, col: 0, text: "x" },
      { row: 1, col: 1, text: "x" },
    ])
  })

  it("does not tile a multi-cell paste even when selection is larger", () => {
    const sel = normalizeRange({ row: 0, col: 0 }, { row: 5, col: 5 })
    expect(expandPasteWrites([["a", "b"]], { row: 0, col: 0 }, sel)).toEqual([
      { row: 0, col: 0, text: "a" },
      { row: 0, col: 1, text: "b" },
    ])
  })
})
