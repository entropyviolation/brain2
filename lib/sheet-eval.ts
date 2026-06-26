/**
 * lib/sheet-eval.ts — Per-cell A1 formula evaluation over a grid
 *
 * Google-Sheets-style cell formulas: a cell whose stored value is a string
 * beginning with "=" (see `isCellFormula`) is a formula that may reference other
 * cells by A1 notation (`=A2+B2`, `=SUM(B2,C2)`). References are *positional* —
 * `A` is the leftmost grid column, row numbers are 1-based display rows — so the
 * same machinery powers cross-row math and fill-drag.
 *
 * Reuses the safe expression engine in `lib/formula.ts` (no `eval`, hand-written
 * parser): we feed it a resolver that turns an A1 id like "B2" into the numeric
 * value of that grid cell, recursively evaluating referenced formula cells with
 * cycle detection. Absolute markers (`$A$1`) are accepted and ignored for
 * evaluation (they only matter to fill-drag, see `shiftFormula`).
 *
 * Pure + store-free: the caller supplies a `RawCellAccessor` over whatever data
 * backs the grid, so this works identically in the app, on a server, or in tests.
 */
import type { AttributeValue } from "@/lib/types"
import { coerceToNumber, evaluateFormula, type FormulaResult } from "@/lib/formula"
import { isCellFormula, parseA1 } from "@/lib/sheet-a1"

/** Reads the raw (stored) value of a grid cell by 0-based column + row index. */
export type RawCellAccessor = (col: number, row: number) => AttributeValue

/** A stable string key for a cell coordinate (cycle tracking). */
function cellKey(col: number, row: number): string {
  return `${col},${row}`
}

/**
 * Remove absolute-reference markers (`$`) that sit immediately before a letter
 * or digit, but never inside a quoted string literal. This lets the underlying
 * (dollar-unaware) tokenizer evaluate `$A$1` as the cell `A1`.
 */
function stripAbsoluteMarkers(formula: string): string {
  let out = ""
  let quote: string | null = null
  for (let i = 0; i < formula.length; i++) {
    const c = formula[i]
    if (quote) {
      out += c
      if (c === quote) quote = null
      continue
    }
    if (c === '"' || c === "'") {
      quote = c
      out += c
      continue
    }
    if (c === "$" && /[A-Za-z0-9]/.test(formula[i + 1] ?? "")) {
      continue // drop the marker
    }
    out += c
  }
  return out
}

/**
 * Evaluate a cell formula string against the grid. `visiting` carries the set of
 * cell keys already on the evaluation stack so cyclic references surface as an
 * error instead of looping forever.
 */
export function evaluateSheetFormula(
  formula: string,
  getCell: RawCellAccessor,
  visiting: Set<string> = new Set(),
): FormulaResult {
  const resolver = (id: string): number | null => {
    const ref = parseA1(id)
    if (!ref) return null
    const key = cellKey(ref.col, ref.row)
    // A reference back onto a cell currently being evaluated is a cycle.
    if (visiting.has(key)) throw new Error("#CYCLE")
    const raw = getCell(ref.col, ref.row)
    if (isCellFormula(raw)) {
      const next = new Set(visiting)
      next.add(key)
      const r = evaluateSheetFormula(raw, getCell, next)
      // Propagate a referenced cell's error (e.g. a deeper cycle) instead of
      // silently treating it as blank.
      if (r.error) throw new Error(r.error)
      return r.value
    }
    return coerceToNumber(raw)
  }
  return evaluateFormula(stripAbsoluteMarkers(formula), resolver)
}

/**
 * Evaluate the cell at (col, row). Non-formula cells coerce their stored value to
 * a number (or null when blank/non-numeric); formula cells are evaluated with
 * their own coordinate seeded into the cycle set (so self-reference is caught).
 */
export function evaluateCellAt(col: number, row: number, getCell: RawCellAccessor): FormulaResult {
  const raw = getCell(col, row)
  if (!isCellFormula(raw)) return { value: coerceToNumber(raw) }
  return evaluateSheetFormula(raw, getCell, new Set([cellKey(col, row)]))
}

/** Format a computed cell result for display (error code, blank, or rounded number). */
export function formatCellResult(result: FormulaResult): string {
  if (result.error) return result.error
  if (result.value === null) return ""
  return (Math.round(result.value * 1e6) / 1e6).toLocaleString()
}
