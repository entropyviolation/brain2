/**
 * sheet-a1 — Google-Sheets-style A1 cell-reference math: parsing, formatting,
 * extraction, and relative/absolute shifting for spreadsheet fill-drag.
 *
 * Pure TypeScript. No React, no app stores.
 */

/** A parsed A1-style cell reference. Indices are 0-based: A1 -> {col:0,row:0}. */
export interface A1Ref {
  col: number
  row: number
  colAbsolute: boolean
  rowAbsolute: boolean
}

/** Column index -> letters. 0 -> "A", 25 -> "Z", 26 -> "AA", 27 -> "AB". */
export function columnToLetters(col: number): string {
  if (!Number.isInteger(col) || col < 0) return ""
  let n = col
  let letters = ""
  while (n >= 0) {
    letters = String.fromCharCode(65 + (n % 26)) + letters
    n = Math.floor(n / 26) - 1
  }
  return letters
}

/** Letters -> column index (case-insensitive). "A" -> 0, "Z" -> 25, "AA" -> 26. Returns -1 for invalid (empty or non-letters). */
export function lettersToColumn(letters: string): number {
  if (typeof letters !== "string" || !/^[A-Za-z]+$/.test(letters)) return -1
  let n = 0
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64)
  }
  return n - 1
}

/** Parse a single A1 ref like "B2", "$B$2", "b2", "A$10" into an A1Ref, or null if the whole string is not a valid single A1 ref. */
export function parseA1(ref: string): A1Ref | null {
  if (typeof ref !== "string") return null
  const m = /^(\$?)([A-Za-z]+)(\$?)([0-9]+)$/.exec(ref)
  if (!m) return null
  const col = lettersToColumn(m[2])
  if (col < 0) return null
  const row = parseInt(m[4], 10) - 1
  if (row < 0) return null
  return {
    col,
    row,
    colAbsolute: m[1] === "$",
    rowAbsolute: m[3] === "$",
  }
}

/** Render an A1Ref to canonical string: {col:1,row:1} -> "B2"; colAbsolute/rowAbsolute add "$". */
export function formatA1(ref: A1Ref): string {
  const colPart = (ref.colAbsolute ? "$" : "") + columnToLetters(ref.col)
  const rowPart = (ref.rowAbsolute ? "$" : "") + String(ref.row + 1)
  return colPart + rowPart
}

/** True when value is a string whose trimmed form starts with "=". Acts as a TS type guard to string. */
export function isCellFormula(value: unknown): value is string {
  return typeof value === "string" && value.trim().startsWith("=")
}

// Sticky matcher for a candidate A1 token: optional $, letters, optional $, digits.
const A1_TOKEN = /\$?[A-Za-z]+\$?[0-9]+/y

// A char that, immediately before a token, means it is part of a larger identifier.
const BEFORE_IDENT = /[A-Za-z0-9_$]/
// A char that, immediately after a token, means it is part of a larger identifier.
const AFTER_IDENT = /[A-Za-z0-9_]/

/**
 * Walk a formula, invoking `onRef` for each standalone A1 token found outside of
 * quoted string literals, and `onText` for every other span (including the
 * quoted literals, copied verbatim with their quotes).
 */
function scanFormula(
  formula: string,
  onText: (text: string) => void,
  onRef: (token: string) => void,
): void {
  const n = formula.length
  let i = 0
  while (i < n) {
    const ch = formula[i]
    if (ch === '"' || ch === "'") {
      let j = i + 1
      while (j < n && formula[j] !== ch) j++
      const end = j < n ? j + 1 : n
      onText(formula.slice(i, end))
      i = end
      continue
    }
    A1_TOKEN.lastIndex = i
    const m = A1_TOKEN.exec(formula)
    if (m && m.index === i) {
      const token = m[0]
      const before = i > 0 ? formula[i - 1] : ""
      const after = i + token.length < n ? formula[i + token.length] : ""
      const beforeOk = before === "" || !BEFORE_IDENT.test(before)
      const afterOk = after === "" || !AFTER_IDENT.test(after)
      if (beforeOk && afterOk) {
        onRef(token)
        i += token.length
        continue
      }
    }
    onText(ch)
    i++
  }
}

/** All A1 refs that appear in a formula string, in order of appearance, de-duplicated by canonical string. Refs inside quoted string literals are ignored. */
export function extractA1Refs(formula: string): A1Ref[] {
  const refs: A1Ref[] = []
  const seen = new Set<string>()
  scanFormula(
    formula,
    () => {},
    (token) => {
      const ref = parseA1(token)
      if (!ref) return
      const key = formatA1(ref)
      if (seen.has(key)) return
      seen.add(key)
      refs.push(ref)
    },
  )
  return refs
}

/**
 * Rewrite every RELATIVE A1 ref in `formula` by (colDelta, rowDelta). Absolute
 * components (preceded by "$") are left unchanged on that axis. References inside
 * quoted string literals are left untouched. If shifting makes a relative col or
 * row index go below 0, replace that whole reference token with "#REF!".
 */
export function shiftFormula(formula: string, colDelta: number, rowDelta: number): string {
  let out = ""
  scanFormula(
    formula,
    (text) => {
      out += text
    },
    (token) => {
      const ref = parseA1(token)
      if (!ref) {
        out += token
        return
      }
      const col = ref.colAbsolute ? ref.col : ref.col + colDelta
      const row = ref.rowAbsolute ? ref.row : ref.row + rowDelta
      if (col < 0 || row < 0) {
        out += "#REF!"
        return
      }
      out += formatA1({
        col,
        row,
        colAbsolute: ref.colAbsolute,
        rowAbsolute: ref.rowAbsolute,
      })
    },
  )
  return out
}
