import { describe, expect, it } from "vitest"
import { cleanBookTitle, localDayKey, measureFromUnit, normalizeModuleOutput } from "@/lib/module-output"
import { inferIncrementalFromName } from "@/lib/incremental-habits"

describe("module output contract", () => {
  it("reads a habit's unit as a measure, trimming stray spaces", () => {
    expect(measureFromUnit("pages ")).toBe("pages")
    expect(measureFromUnit("Minutes")).toBe("minutes")
    expect(measureFromUnit("parsecs")).toBeUndefined()
  })
  it("accepts a good report and rounds whole measures", () => {
    const r = normalizeModuleOutput({ id: "a", moduleId: "speed-read", measure: "page", amount: 2.4, at: "2026-11-07T10:00:00Z", subject: { type: "book", title: " Dune " } })
    expect(r.ok && r.output).toMatchObject({ measure: "pages", amount: 2, subject: { title: "Dune" } })
  })
  it("refuses instead of guessing", () => {
    const r = normalizeModuleOutput({ id: "", moduleId: "x", measure: "parsecs", amount: -1, at: "nope" })
    expect(r.ok).toBe(false)
    expect(!r.ok && r.errors.length).toBeGreaterThanOrEqual(4)
  })
  it("cleans file names into titles", () => {
    expect(cleanBookTitle("Dune_-_Frank_Herbert (1).pdf")).toBe("Dune - Frank Herbert")
  })
  it("keys a reading by local day", () => {
    expect(localDayKey(new Date(2026, 10, 7, 0, 30).toISOString())).toBe("2026-11-07")
  })
})

describe("climb habit with empty settings", () => {
  it("reads the climb from the name", () => {
    expect(inferIncrementalFromName({ name: "Read at least 5 pages per day (+1/week)", unit: "pages " })).toEqual({ cadence: "weekly", startValue: 5, increment: 1, unit: "pages" })
    expect(inferIncrementalFromName({ name: "Chess score + 10" })?.startValue).toBe(10)
    expect(inferIncrementalFromName({ name: "Floss" })).toBeUndefined()
  })
})
