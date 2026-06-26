/**
 * spreadsheet-keys — navigation, range math, clipboard TSV, selection stats.
 */
import { describe, expect, it } from "vitest"
import {
  clampIndex,
  enterTarget,
  isWithinRange,
  moveActive,
  normalizeRange,
  parseClipboardGrid,
  rangeArea,
  rangeCells,
  rangeToTSV,
  selectionStats,
  tabTarget,
  type GridCell,
} from "./spreadsheet-keys"

const cell = (row: number, col: number): GridCell => ({ row, col })

describe("clampIndex", () => {
  it("clamps into [0, count-1]", () => {
    expect(clampIndex(-5, 10)).toBe(0)
    expect(clampIndex(99, 10)).toBe(9)
    expect(clampIndex(3, 10)).toBe(3)
  })
  it("returns 0 for an empty grid", () => {
    expect(clampIndex(4, 0)).toBe(0)
  })
})

describe("moveActive", () => {
  const rows = 5
  const cols = 4
  it("moves by one in each direction", () => {
    expect(moveActive(cell(2, 2), "ArrowUp", rows, cols)).toEqual(cell(1, 2))
    expect(moveActive(cell(2, 2), "ArrowDown", rows, cols)).toEqual(cell(3, 2))
    expect(moveActive(cell(2, 2), "ArrowLeft", rows, cols)).toEqual(cell(2, 1))
    expect(moveActive(cell(2, 2), "ArrowRight", rows, cols)).toEqual(cell(2, 3))
  })
  it("clamps at the edges", () => {
    expect(moveActive(cell(0, 0), "ArrowUp", rows, cols)).toEqual(cell(0, 0))
    expect(moveActive(cell(0, 0), "ArrowLeft", rows, cols)).toEqual(cell(0, 0))
    expect(moveActive(cell(4, 3), "ArrowDown", rows, cols)).toEqual(cell(4, 3))
    expect(moveActive(cell(4, 3), "ArrowRight", rows, cols)).toEqual(cell(4, 3))
  })
  it("jumps to the far edge when ctrl/cmd is held", () => {
    expect(moveActive(cell(2, 2), "ArrowDown", rows, cols, true)).toEqual(cell(4, 2))
    expect(moveActive(cell(2, 2), "ArrowUp", rows, cols, true)).toEqual(cell(0, 2))
    expect(moveActive(cell(2, 2), "ArrowRight", rows, cols, true)).toEqual(cell(2, 3))
    expect(moveActive(cell(2, 2), "ArrowLeft", rows, cols, true)).toEqual(cell(2, 0))
  })
  it("handles Home/End and ctrl Home/End", () => {
    expect(moveActive(cell(2, 2), "Home", rows, cols)).toEqual(cell(2, 0))
    expect(moveActive(cell(2, 2), "End", rows, cols)).toEqual(cell(2, 3))
    expect(moveActive(cell(2, 2), "Home", rows, cols, true)).toEqual(cell(0, 0))
    expect(moveActive(cell(2, 2), "End", rows, cols, true)).toEqual(cell(4, 3))
  })
  it("pages up/down by ten rows, clamped", () => {
    expect(moveActive(cell(2, 1), "PageDown", 50, cols)).toEqual(cell(12, 1))
    expect(moveActive(cell(2, 1), "PageUp", 50, cols)).toEqual(cell(0, 1))
  })
})

describe("tabTarget", () => {
  it("moves right and wraps to the next row", () => {
    expect(tabTarget(cell(0, 1), false, 3, 3)).toEqual(cell(0, 2))
    expect(tabTarget(cell(0, 2), false, 3, 3)).toEqual(cell(1, 0))
  })
  it("moves left and wraps to the previous row on shift", () => {
    expect(tabTarget(cell(1, 0), true, 3, 3)).toEqual(cell(0, 2))
    expect(tabTarget(cell(0, 0), true, 3, 3)).toEqual(cell(0, 0))
  })
})

describe("enterTarget", () => {
  it("moves down and wraps across columns", () => {
    expect(enterTarget(cell(1, 0), false, 3, 3)).toEqual(cell(2, 0))
    expect(enterTarget(cell(2, 0), false, 3, 3)).toEqual(cell(0, 1))
  })
  it("moves up on shift and stops at the very first cell", () => {
    expect(enterTarget(cell(1, 1), true, 3, 3)).toEqual(cell(0, 1))
    expect(enterTarget(cell(0, 0), true, 3, 3)).toEqual(cell(0, 0))
  })
})

describe("range math", () => {
  it("normalizes anchor/focus regardless of order", () => {
    expect(normalizeRange(cell(3, 4), cell(1, 2))).toEqual({ top: 1, left: 2, bottom: 3, right: 4 })
  })
  it("computes area and membership", () => {
    const range = normalizeRange(cell(0, 0), cell(1, 2))
    expect(rangeArea(range)).toBe(6)
    expect(isWithinRange(range, cell(1, 2))).toBe(true)
    expect(isWithinRange(range, cell(2, 0))).toBe(false)
  })
  it("lists cells row-major", () => {
    const cells = rangeCells(normalizeRange(cell(0, 0), cell(1, 1)))
    expect(cells).toEqual([cell(0, 0), cell(0, 1), cell(1, 0), cell(1, 1)])
  })
})

describe("clipboard TSV", () => {
  it("serializes a range with tabs and newlines and sanitizes cell content", () => {
    const grid = [
      ["a", "b\tx"],
      ["c\nd", "e"],
    ]
    const tsv = rangeToTSV(normalizeRange(cell(0, 0), cell(1, 1)), ({ row, col }) => grid[row][col])
    expect(tsv).toBe("a\tb x\nc d\te")
  })
  it("round-trips a block through parseClipboardGrid", () => {
    const parsed = parseClipboardGrid("a\tb\nc\td\n")
    expect(parsed).toEqual([
      ["a", "b"],
      ["c", "d"],
    ])
  })
  it("treats a single value as a 1x1 grid", () => {
    expect(parseClipboardGrid("42")).toEqual([["42"]])
  })
  it("tolerates CRLF line endings", () => {
    expect(parseClipboardGrid("a\tb\r\nc\td")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ])
  })
})

describe("selectionStats", () => {
  it("summarizes numeric cells and ignores blanks", () => {
    const stats = selectionStats([10, null, 30, null], 4)
    expect(stats).toEqual({ count: 4, numericCount: 2, sum: 40, avg: 20, min: 10, max: 30 })
  })
  it("returns no averages when nothing is numeric", () => {
    const stats = selectionStats([null, null], 2)
    expect(stats).toEqual({ count: 2, numericCount: 0, sum: 0, avg: null, min: null, max: null })
  })
})
