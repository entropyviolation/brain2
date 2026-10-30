import { describe, expect, it } from "vitest"
import { apartRuns, companyRates } from "./text-company"
import type { TextRow } from "./texts"
import type { HistoryEntry } from "./vault-search"

const row = (day: number, h: number, dir: "in" | "out"): TextRow => ({ at: new Date(2026, 9, day, h, 5).toISOString(), dir, who: "Elijah", thread: "e", group: false, text: "hi" })
const blk = (date: string, pen: string, a: number, b: number): HistoryEntry => ({ date, scope: "company", pen, startMin: a * 60, endMin: b * 60, text: "" })
const isE = (r: TextRow) => r.who === "Elijah"

describe("text company", () => {
  const rows: TextRow[] = []
  const company: HistoryEntry[] = []
  for (let d = 1; d <= 3; d++) {
    const date = `2026-10-0${d}`
    company.push(blk(date, "Alone", 8, 16), blk(date, "Elijah", 16, 24))
    for (let h = 8; h < 16; h++) rows.push(row(d, h, "out"), row(d, h, "in"))
  }
  it("learns apart vs together rates", () => {
    const r = companyRates(rows, company, "Elijah", isE)!
    expect(r.apartPerHour).toBe(2)
    expect(r.togetherPerHour).toBe(0)
  })
  it("says nothing without enough marked hours", () => expect(companyRates(rows, company.slice(0, 2), "Elijah", isE)).toBeNull())
  it("reports runs of exchange as apart", () => {
    const r = companyRates(rows, company, "Elijah", isE)
    const out = apartRuns(rows.filter((x) => x.at.startsWith("2026-10-0") && new Date(x.at).getDate() === 1), isE, r)
    expect(out[0]).toContain("08:00–16:00")
  })
})
