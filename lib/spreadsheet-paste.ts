/**
 * lib/spreadsheet-paste.ts — Paste expansion for spreadsheet grids
 *
 * Turns a parsed clipboard grid (from `parseClipboardGrid`) plus the current
 * selection into a list of cell writes. Mirrors Google Sheets:
 *   - multi-cell paste starts at the selection's top-left
 *   - a single pasted value tiles across a multi-cell selection
 */
import { rangeArea, rangeCells, type GridCell, type GridRange } from "@/lib/spreadsheet-keys"

export interface PasteWrite {
  row: number
  col: number
  text: string
}

/**
 * Expand a pasted 2-D grid into absolute cell writes relative to `start`
 * (normally the selection's top-left). When the paste is a single cell and the
 * selection covers more than one cell, the value is tiled across the selection.
 */
export function expandPasteWrites(
  grid: string[][],
  start: GridCell,
  selection: GridRange | null,
): PasteWrite[] {
  const rows = grid.length
  const cols = rows > 0 ? Math.max(...grid.map((r) => r.length)) : 0
  const isSingle = rows === 1 && cols === 1
  if (isSingle && selection && rangeArea(selection) > 1) {
    const text = grid[0]?.[0] ?? ""
    return rangeCells(selection).map((c) => ({ row: c.row, col: c.col, text }))
  }
  const writes: PasteWrite[] = []
  for (let r = 0; r < grid.length; r++) {
    const line = grid[r] ?? []
    for (let c = 0; c < line.length; c++) {
      writes.push({ row: start.row + r, col: start.col + c, text: line[c] ?? "" })
    }
  }
  return writes
}
