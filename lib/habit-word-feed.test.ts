import { describe, expect, it } from "vitest"
import { owed, stepLedger, unitsFor, feedMatchesDoc } from "./habit-word-feed"
import { parseWordRule, pickHabitForRule } from "./habit-helper/rule"
import { FIXTURE } from "./habit-helper/tests"

const SAID =
  'Make it so that for every 300 words writing in the document called "pages writing" that are added in a day, it counts for 1 page written for that daily habit (write 3 pages)'

describe("word rule", () => {
  it("reads the sentence", () => {
    expect(parseWordRule(SAID)).toMatchObject({ docTitle: "pages writing", wordsPer: 300, amount: 1, unit: "page", habitHint: "write 3 pages" })
  })
  it("ignores other sentences", () => {
    expect(parseWordRule("read 10 pages and drank water")).toBeNull()
  })
  it("picks the habit by its words", () => {
    const rule = parseWordRule(SAID)!
    const habits = [...FIXTURE, { id: "w", name: "Write 3 pages", kind: "goal" as const, goal: 3, unit: "pages", words: [], days: {} }]
    expect(pickHabitForRule(rule, habits).id).toBe("w")
  })
})

describe("ledger", () => {
  const feed = { docTitle: "pages writing", wordsPer: 300, amount: 1 }
  it("counts only words added today, in whole blocks", () => {
    let e = stepLedger(undefined, 1000, "2026-11-07")
    expect(e.added).toBe(0)
    e = stepLedger(e, 1250, "2026-11-07")
    expect(owed(e, "h", feed)).toEqual({ add: 0, total: 0 })
    e = stepLedger(e, 1650, "2026-11-07")
    expect(unitsFor(e.added, feed)).toBe(2)
    expect(owed(e, "h", feed).add).toBe(2)
  })
  it("never takes credit back for deleted words, and resets on a new day", () => {
    let e = stepLedger(undefined, 0, "d1")
    e = stepLedger(e, 600, "d1")
    e = stepLedger(e, 100, "d1")
    expect(e.added).toBe(600)
    e = stepLedger(e, 150, "d2")
    expect(e).toMatchObject({ day: "d2", added: 50, credited: {} })
  })
  it("matches a document by title without case", () => {
    expect(feedMatchesDoc(feed, { id: "x", title: "  Pages  Writing " })).toBe(true)
  })
})
