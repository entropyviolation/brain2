/**
 * csv / spreadsheet text parsing — delimiters, detection, TSV.
 */
import { describe, expect, it } from "vitest"
import { detectDelimiter, parseCsv, parseSpreadsheetText, parseTsv } from "./csv"

describe("parseCsv", () => {
  it("parses a simple headered table", () => {
    expect(parseCsv("Name,Cost\nApple,10\nBanana,30")).toEqual({
      headers: ["Name", "Cost"],
      rows: [
        ["Apple", "10"],
        ["Banana", "30"],
      ],
    })
  })

  it("keeps commas inside quotes", () => {
    expect(parseCsv('Name,Note\n"A, B",hi')).toEqual({
      headers: ["Name", "Note"],
      rows: [["A, B", "hi"]],
    })
  })
})

describe("parseTsv / parseSpreadsheetText", () => {
  it("parses tab-separated files", () => {
    expect(parseTsv("Name\tCost\nApple\t10")).toEqual({
      headers: ["Name", "Cost"],
      rows: [["Apple", "10"]],
    })
  })

  it("picks TSV by extension", () => {
    expect(parseSpreadsheetText("A\tB\n1\t2", "data.tsv").headers).toEqual(["A", "B"])
  })

  it("detects tabs when the extension is ambiguous", () => {
    expect(detectDelimiter("Name\tCost\nApple\t10")).toBe("\t")
    expect(detectDelimiter("Name,Cost\nApple,10")).toBe(",")
  })
})
