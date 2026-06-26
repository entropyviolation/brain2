/**
 * sheet-a1 — A1 cell-reference parsing, formatting, extraction, and shifting.
 */
import { describe, expect, it } from "vitest"
import {
  columnToLetters,
  extractA1Refs,
  formatA1,
  isCellFormula,
  lettersToColumn,
  parseA1,
  shiftFormula,
  type A1Ref,
} from "./sheet-a1"

const ref = (
  col: number,
  row: number,
  colAbsolute = false,
  rowAbsolute = false,
): A1Ref => ({ col, row, colAbsolute, rowAbsolute })

describe("columnToLetters", () => {
  it("maps indices to letters", () => {
    expect(columnToLetters(0)).toBe("A")
    expect(columnToLetters(25)).toBe("Z")
    expect(columnToLetters(26)).toBe("AA")
    expect(columnToLetters(27)).toBe("AB")
    expect(columnToLetters(51)).toBe("AZ")
    expect(columnToLetters(52)).toBe("BA")
    expect(columnToLetters(701)).toBe("ZZ")
    expect(columnToLetters(702)).toBe("AAA")
  })
  it("returns empty string for invalid input", () => {
    expect(columnToLetters(-1)).toBe("")
    expect(columnToLetters(1.5)).toBe("")
  })
})

describe("lettersToColumn", () => {
  it("maps letters to indices (case-insensitive)", () => {
    expect(lettersToColumn("A")).toBe(0)
    expect(lettersToColumn("Z")).toBe(25)
    expect(lettersToColumn("AA")).toBe(26)
    expect(lettersToColumn("AB")).toBe(27)
    expect(lettersToColumn("aa")).toBe(26)
    expect(lettersToColumn("zz")).toBe(701)
  })
  it("returns -1 for invalid input", () => {
    expect(lettersToColumn("")).toBe(-1)
    expect(lettersToColumn("A1")).toBe(-1)
    expect(lettersToColumn("1")).toBe(-1)
    expect(lettersToColumn("A B")).toBe(-1)
  })
})

describe("columnToLetters / lettersToColumn round-trips", () => {
  it("round-trips across a wide range of indices", () => {
    for (const col of [0, 1, 25, 26, 27, 51, 52, 100, 701, 702, 1000]) {
      expect(lettersToColumn(columnToLetters(col))).toBe(col)
    }
  })
})

describe("parseA1", () => {
  it("parses a relative ref", () => {
    expect(parseA1("B2")).toEqual(ref(1, 1, false, false))
  })
  it("parses absolutes", () => {
    expect(parseA1("$B$2")).toEqual(ref(1, 1, true, true))
    expect(parseA1("$B2")).toEqual(ref(1, 1, true, false))
    expect(parseA1("B$2")).toEqual(ref(1, 1, false, true))
  })
  it("parses a row-absolute multi-digit ref", () => {
    expect(parseA1("A$10")).toEqual(ref(0, 9, false, true))
  })
  it("is case-insensitive", () => {
    expect(parseA1("b2")).toEqual(ref(1, 1, false, false))
    expect(parseA1("aa1")).toEqual(ref(26, 0, false, false))
  })
  it("returns null for invalid refs", () => {
    expect(parseA1("2B")).toBeNull()
    expect(parseA1("B")).toBeNull()
    expect(parseA1("")).toBeNull()
    expect(parseA1("B2B")).toBeNull()
    expect(parseA1("$")).toBeNull()
    expect(parseA1("A0")).toBeNull()
    expect(parseA1(" B2")).toBeNull()
    expect(parseA1("A1:B2")).toBeNull()
  })
})

describe("formatA1", () => {
  it("renders a relative ref", () => {
    expect(formatA1(ref(1, 1))).toBe("B2")
  })
  it("renders absolutes", () => {
    expect(formatA1(ref(1, 1, true, true))).toBe("$B$2")
    expect(formatA1(ref(1, 1, true, false))).toBe("$B2")
    expect(formatA1(ref(1, 1, false, true))).toBe("B$2")
  })
  it("round-trips with parseA1", () => {
    for (const text of ["A1", "B2", "$B$2", "A$10", "$A2", "ZZ100"]) {
      const parsed = parseA1(text)
      expect(parsed).not.toBeNull()
      expect(formatA1(parsed as A1Ref)).toBe(text)
    }
  })
})

describe("isCellFormula", () => {
  it("detects formula strings", () => {
    expect(isCellFormula("=A1+B1")).toBe(true)
    expect(isCellFormula("  =1")).toBe(true)
  })
  it("rejects non-formulas", () => {
    expect(isCellFormula("A1")).toBe(false)
    expect(isCellFormula("=")).toBe(true)
    expect(isCellFormula("")).toBe(false)
    expect(isCellFormula(5)).toBe(false)
    expect(isCellFormula(null)).toBe(false)
    expect(isCellFormula(undefined)).toBe(false)
    expect(isCellFormula({})).toBe(false)
  })
})

describe("extractA1Refs", () => {
  it("returns refs in order, de-duplicated", () => {
    expect(extractA1Refs("=A1+B2*A1")).toEqual([ref(0, 0), ref(1, 1)])
  })
  it("ignores refs inside double quotes", () => {
    expect(extractA1Refs('="A1"+B2')).toEqual([ref(1, 1)])
  })
  it("ignores refs inside single quotes", () => {
    expect(extractA1Refs("='A1'+B2")).toEqual([ref(1, 1)])
  })
  it("handles absolutes", () => {
    expect(extractA1Refs("=$A$1+A2")).toEqual([ref(0, 0, true, true), ref(0, 1)])
  })
  it("does not match inside identifiers", () => {
    expect(extractA1Refs("=qty_2+B2B")).toEqual([])
  })
  it("does not match function names without trailing digits", () => {
    expect(extractA1Refs("=SUM(A1,A2)")).toEqual([ref(0, 0), ref(0, 1)])
  })
  it("dedupes across mixed absolute/relative canonical strings", () => {
    expect(extractA1Refs("=A1+$A$1+A1")).toEqual([ref(0, 0), ref(0, 0, true, true)])
  })
  it("returns an empty array when there are no refs", () => {
    expect(extractA1Refs("=1+2*3")).toEqual([])
  })
})

describe("shiftFormula", () => {
  it("shifts rows", () => {
    expect(shiftFormula("=A1+B1", 0, 1)).toBe("=A2+B2")
  })
  it("shifts columns", () => {
    expect(shiftFormula("=A1+B1", 1, 0)).toBe("=B1+C1")
  })
  it("leaves fully-absolute refs untouched", () => {
    expect(shiftFormula("=$A$1+B1", 1, 1)).toBe("=$A$1+C2")
  })
  it("respects row-absolute on a single axis", () => {
    expect(shiftFormula("=A$1", 0, 5)).toBe("=A$1")
    expect(shiftFormula("=A$1", 2, 0)).toBe("=C$1")
  })
  it("respects col-absolute on a single axis", () => {
    expect(shiftFormula("=$A1", 5, 0)).toBe("=$A1")
    expect(shiftFormula("=$A1", 0, 3)).toBe("=$A4")
  })
  it("emits #REF! on column underflow", () => {
    expect(shiftFormula("=A1", -5, 0)).toBe("=#REF!")
  })
  it("emits #REF! on row underflow", () => {
    expect(shiftFormula("=A1", 0, -5)).toBe("=#REF!")
  })
  it("does not touch refs in quotes", () => {
    expect(shiftFormula('="A1"+A1', 0, 1)).toBe('="A1"+A2')
    expect(shiftFormula("='A1'+A1", 0, 1)).toBe("='A1'+A2")
  })
  it("does not touch function names", () => {
    expect(shiftFormula("=SUM(A1,A2)", 0, 1)).toBe("=SUM(A2,A3)")
  })
  it("does not touch identifiers like qty_2", () => {
    expect(shiftFormula("=qty_2+A1", 0, 1)).toBe("=qty_2+A2")
    expect(shiftFormula("=B2B+A1", 1, 0)).toBe("=B2B+B1")
  })
  it("preserves operators, spaces, and numbers exactly", () => {
    expect(shiftFormula("= A1 * 2 + B10 / 3", 1, 1)).toBe("= B2 * 2 + C11 / 3")
  })
  it("handles multi-letter columns", () => {
    expect(shiftFormula("=Z1", 1, 0)).toBe("=AA1")
    expect(shiftFormula("=AA1", 1, 0)).toBe("=AB1")
  })
})
