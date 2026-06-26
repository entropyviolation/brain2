/**
 * lib/spreadsheet-keys.ts — Pure grid interaction model (Google-Sheets parity)
 *
 * Framework-free helpers that give the `SheetGrid` real spreadsheet ergonomics:
 *   - keyboard navigation (arrows / Tab / Enter / Home / End / Page / Ctrl-jump)
 *   - rectangular range selection (anchor + focus → normalized box)
 *   - clipboard interchange as TSV (copy a range out, paste a block in)
 *   - a Google-Sheets-style selection summary (Sum / Avg / Count / Min / Max)
 *
 * A grid cell is addressed by `{ row, col }` indices into the *currently
 * displayed* rows and the *selectable* columns (column 0 is the name column,
 * 1..n are the attribute columns — the leading checkbox gutter is not a cell).
 *
 * Everything here is pure and store-free so it is unit-testable and shared by
 * any consumer of the grid.
 */

/** A selectable cell, addressed by row + column index (0-based). */
export interface GridCell {
  row: number
  col: number
}

/** A normalized rectangular selection (inclusive bounds). */
export interface GridRange {
  top: number
  left: number
  bottom: number
  right: number
}

/** Clamp an index into the inclusive range [0, count - 1] (min 0). */
export function clampIndex(value: number, count: number): number {
  if (count <= 0) return 0
  if (value < 0) return 0
  if (value > count - 1) return count - 1
  return value
}

/** Rows moved by a PageUp / PageDown keypress. */
const PAGE_ROWS = 10

/** Navigation keys we own when a cell is selected and not being edited. */
export const NAV_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "PageUp",
  "PageDown",
])

/**
 * Move the active cell in response to a navigation key. `jump` (Ctrl/Cmd held)
 * snaps to the far edge in that direction, mirroring Google Sheets' Ctrl+Arrow.
 * Returns a clamped cell; unknown keys return the input unchanged.
 */
export function moveActive(
  active: GridCell,
  key: string,
  rowCount: number,
  colCount: number,
  jump = false,
): GridCell {
  let { row, col } = active
  switch (key) {
    case "ArrowUp":
      row = jump ? 0 : row - 1
      break
    case "ArrowDown":
      row = jump ? rowCount - 1 : row + 1
      break
    case "ArrowLeft":
      col = jump ? 0 : col - 1
      break
    case "ArrowRight":
      col = jump ? colCount - 1 : col + 1
      break
    case "Home":
      col = 0
      if (jump) row = 0
      break
    case "End":
      col = colCount - 1
      if (jump) row = rowCount - 1
      break
    case "PageUp":
      row = row - PAGE_ROWS
      break
    case "PageDown":
      row = row + PAGE_ROWS
      break
    default:
      return active
  }
  return { row: clampIndex(row, rowCount), col: clampIndex(col, colCount) }
}

/**
 * Target after Tab (forward) / Shift+Tab (back). Moves horizontally and wraps to
 * the next/previous row at the edges, like a spreadsheet. Never moves past the
 * first/last cell of the grid.
 */
export function tabTarget(active: GridCell, shift: boolean, rowCount: number, colCount: number): GridCell {
  if (colCount <= 0 || rowCount <= 0) return active
  let { row, col } = active
  if (shift) {
    col -= 1
    if (col < 0) {
      if (row > 0) {
        row -= 1
        col = colCount - 1
      } else {
        col = 0
      }
    }
  } else {
    col += 1
    if (col > colCount - 1) {
      if (row < rowCount - 1) {
        row += 1
        col = 0
      } else {
        col = colCount - 1
      }
    }
  }
  return { row, col }
}

/**
 * Target after committing an edit with Enter (down) / Shift+Enter (up). Wraps
 * across columns at the top/bottom edges so rapid data entry stays in flow.
 */
export function enterTarget(active: GridCell, shift: boolean, rowCount: number, colCount: number): GridCell {
  if (colCount <= 0 || rowCount <= 0) return active
  let { row, col } = active
  if (shift) {
    row -= 1
    if (row < 0) {
      if (col > 0) {
        col -= 1
        row = rowCount - 1
      } else {
        row = 0
      }
    }
  } else {
    row += 1
    if (row > rowCount - 1) {
      if (col < colCount - 1) {
        col += 1
        row = 0
      } else {
        row = rowCount - 1
      }
    }
  }
  return { row, col }
}

/** Normalize an (anchor, focus) pair into an inclusive bounding box. */
export function normalizeRange(anchor: GridCell, focus: GridCell): GridRange {
  return {
    top: Math.min(anchor.row, focus.row),
    bottom: Math.max(anchor.row, focus.row),
    left: Math.min(anchor.col, focus.col),
    right: Math.max(anchor.col, focus.col),
  }
}

/** True when a cell falls inside a normalized range. */
export function isWithinRange(range: GridRange, cell: GridCell): boolean {
  return (
    cell.row >= range.top &&
    cell.row <= range.bottom &&
    cell.col >= range.left &&
    cell.col <= range.right
  )
}

/** Number of cells covered by a range. */
export function rangeArea(range: GridRange): number {
  return (range.bottom - range.top + 1) * (range.right - range.left + 1)
}

/** All cells inside a range, row-major (top→bottom, left→right). */
export function rangeCells(range: GridRange): GridCell[] {
  const cells: GridCell[] = []
  for (let row = range.top; row <= range.bottom; row++) {
    for (let col = range.left; col <= range.right; col++) {
      cells.push({ row, col })
    }
  }
  return cells
}

/**
 * Serialize a range to TSV using a per-cell text accessor. Cells are joined by
 * tabs within a row and newlines between rows — the de-facto clipboard format
 * understood by Google Sheets, Excel, and Numbers.
 */
export function rangeToTSV(range: GridRange, getText: (cell: GridCell) => string): string {
  const lines: string[] = []
  for (let row = range.top; row <= range.bottom; row++) {
    const cols: string[] = []
    for (let col = range.left; col <= range.right; col++) {
      cols.push(sanitizeCell(getText({ row, col })))
    }
    lines.push(cols.join("\t"))
  }
  return lines.join("\n")
}

/** Replace tabs/newlines inside a single cell so the TSV grid stays rectangular. */
function sanitizeCell(text: string): string {
  return text.replace(/\r?\n/g, " ").replace(/\t/g, " ")
}

/**
 * Parse pasted clipboard text into a 2-D grid of strings. Splits on newlines
 * then tabs; tolerates CRLF and a single trailing newline. A plain single value
 * (no tabs/newlines) yields `[[value]]`.
 */
export function parseClipboardGrid(text: string): string[][] {
  if (text === "") return [[""]]
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n")
  const withoutTrailing = normalized.endsWith("\n") ? normalized.slice(0, -1) : normalized
  return withoutTrailing.split("\n").map((line) => line.split("\t"))
}

/** Summary statistics for a selection (Google-Sheets status-bar parity). */
export interface SelectionStats {
  /** Total selected cells (numeric + non-numeric + empty). */
  count: number
  /** Cells that resolved to a finite number. */
  numericCount: number
  sum: number
  avg: number | null
  min: number | null
  max: number | null
}

/**
 * Compute selection statistics from a list of resolved cell numbers (use `null`
 * for empty/non-numeric cells) and the total number of selected cells. Mirrors
 * the Google Sheets bottom bar: Sum / Avg / Min / Max over numeric cells, plus
 * Count (all) and Count Numbers.
 */
export function selectionStats(values: Array<number | null>, count: number): SelectionStats {
  const nums = values.filter((v): v is number => v !== null && Number.isFinite(v))
  if (nums.length === 0) {
    return { count, numericCount: 0, sum: 0, avg: null, min: null, max: null }
  }
  let sum = 0
  let min = nums[0]
  let max = nums[0]
  for (const n of nums) {
    sum += n
    if (n < min) min = n
    if (n > max) max = n
  }
  return { count, numericCount: nums.length, sum, avg: sum / nums.length, min, max }
}
