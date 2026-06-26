/**
 * sheet-eval — per-cell A1 formula evaluation over a grid (cross-row refs, cycles).
 */
import { describe, expect, it } from "vitest"
import { evaluateCellAt, evaluateSheetFormula, formatCellResult } from "./sheet-eval"
import type { AttributeValue } from "./types"
import type { RawCellAccessor } from "./sheet-eval"

/** Build an accessor over a 2-D array of raw cell values ([row][col]). */
function gridOf(rows: AttributeValue[][]): RawCellAccessor {
  return (col, row) => rows[row]?.[col]
}

describe("evaluateSheetFormula", () => {
  it("adds two cells by A1 reference", () => {
    // col0 col1 -> A B ; row index 0 == row "1"
    const grid = gridOf([
      [10, 5],
      [20, 7],
    ])
    expect(evaluateSheetFormula("=A1+B1", grid).value).toBe(15)
    expect(evaluateSheetFormula("=A2+B2", grid).value).toBe(27)
  })

  it("supports functions and arithmetic across rows", () => {
    const grid = gridOf([
      [2, 3],
      [4, 5],
    ])
    expect(evaluateSheetFormula("=SUM(A1,A2,B1,B2)", grid).value).toBe(14)
    expect(evaluateSheetFormula("=A1*B2+1", grid).value).toBe(11)
  })

  it("treats absolute markers as the same cell", () => {
    const grid = gridOf([[10, 5]])
    expect(evaluateSheetFormula("=$A$1+$B1", grid).value).toBe(15)
  })

  it("resolves chains of formula cells", () => {
    // A1=2, B1==A1*3 (6), C1==B1+1 (7)
    const grid = gridOf([[2, "=A1*3", "=B1+1"]])
    expect(evaluateSheetFormula("=C1", grid).value).toBe(7)
  })

  it("ignores string literals when resolving refs", () => {
    const grid = gridOf([[10, 5]])
    expect(evaluateSheetFormula('="A1"+B1', grid).value).toBe(5)
  })

  it("surfaces cycles as an error rather than looping", () => {
    // A1 -> B1 -> A1
    const grid = gridOf([["=B1", "=A1"]])
    const res = evaluateCellAt(0, 0, grid)
    expect(res.value).toBeNull()
    expect(res.error).toBeTruthy()
  })
})

describe("evaluateCellAt", () => {
  it("coerces a plain numeric cell", () => {
    expect(evaluateCellAt(0, 0, gridOf([[42]])).value).toBe(42)
  })
  it("returns null for blank/non-numeric cells", () => {
    expect(evaluateCellAt(0, 0, gridOf([[""]])).value).toBeNull()
    expect(evaluateCellAt(1, 0, gridOf([["x"]])).value).toBeNull()
  })
  it("evaluates a formula cell, seeding its own coordinate for cycle safety", () => {
    expect(evaluateCellAt(2, 0, gridOf([[3, 4, "=A1+B1"]])).value).toBe(7)
    const selfRef = evaluateCellAt(0, 0, gridOf([["=A1+1"]]))
    expect(selfRef.error).toBeTruthy()
  })
})

describe("formatCellResult", () => {
  it("renders numbers, blanks, and errors", () => {
    expect(formatCellResult({ value: 1234.5 })).toBe((1234.5).toLocaleString())
    expect(formatCellResult({ value: null })).toBe("")
    expect(formatCellResult({ value: null, error: "#CYCLE" })).toBe("#CYCLE")
  })
})
