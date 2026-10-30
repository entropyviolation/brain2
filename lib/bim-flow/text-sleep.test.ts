import { describe, expect, it } from "vitest"
import { sleepFact, sleepOffsets } from "./text-sleep"
import type { TextRow } from "./texts"
import type { HistoryEntry } from "./vault-search"

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m).toISOString()
const out = (iso: string): TextRow => ({ at: iso, dir: "out", who: "x", thread: "t", group: false, text: "hi" })
const sleep = (day: number): HistoryEntry => ({ date: `2026-10-${String(day).padStart(2, "0")}`, scope: "activity", pen: "Sleep", startMin: 180, endMin: 600, text: "" })

describe("text sleep", () => {
  const rows: TextRow[] = []
  const blocks: HistoryEntry[] = []
  for (let d = 2; d <= 11; d++) {
    rows.push(out(at(d - 1, 23, 0)), out(at(d, 10, 30))) // last text 23:00, first 10:30
    blocks.push(sleep(d)) // logged 03:00–10:00
  }
  it("learns lead and lag", () => {
    expect(sleepOffsets(rows, blocks)).toEqual({ n: 10, leadMin: 240, lagMin: 30, textsInside: 0 })
  })
  it("needs enough nights", () => expect(sleepOffsets(rows, blocks.slice(0, 4))).toBeNull())
  it("words a night", () => {
    const f = sleepFact(rows, "2026-10-05", sleepOffsets(rows, blocks))!
    expect(f).toContain("no text sent from 23:00 to 10:30")
    expect(f).toContain("likely asleep 03:00–10:00")
  })
})
