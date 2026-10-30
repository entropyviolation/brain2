import { describe, it, expect } from "vitest"
import { findDay, isDecline, parseTell } from "./bim-tell"

// Fri Oct 30 2026, local noon.
const NOW = new Date(2026, 9, 30, 12, 0)

describe("findDay", () => {
  it("reads month names, numbers, and relative words", () => {
    expect(findDay("july 5th", NOW, "past")?.iso).toBe("2026-07-05")
    expect(findDay("the 5th of July", NOW, "past")?.iso).toBe("2026-07-05")
    expect(findDay("7/5", NOW, "past")?.iso).toBe("2026-07-05")
    expect(findDay("yesterday", NOW, "past")?.iso).toBe("2026-10-29")
    expect(findDay("3 weeks ago", NOW, "past")?.iso).toBe("2026-10-09")
    expect(findDay("in 2 days", NOW, "future")?.iso).toBe("2026-11-01")
    expect(findDay("last friday", NOW, "past")?.iso).toBe("2026-10-23")
  })
  it("puts a missing year on the preferred side of today", () => {
    expect(findDay("nov 18th", NOW, "future")?.iso).toBe("2026-11-18")
    expect(findDay("nov 18th", NOW, "past")?.iso).toBe("2025-11-18")
    expect(findDay("march 3", NOW, "future")?.iso).toBe("2027-03-03")
  })
  it("does not read 'may' the verb or a bare month", () => {
    expect(findDay("I may go", NOW, "future")).toBeNull()
    expect(findDay("see you in march", NOW, "future")).toBeNull()
  })
})

describe("parseTell", () => {
  it("last seen, stated", () => {
    expect(parseTell("The last time I saw Shelby was July 5th", NOW)).toEqual({ kind: "last-seen", who: "Shelby", date: "2026-07-05" })
    expect(parseTell("I saw Shelby yesterday", NOW)).toEqual({ kind: "last-seen", who: "Shelby", date: "2026-10-29" })
  })
  it("last seen, asked", () => {
    expect(parseTell("when was the last time i saw shelby?", NOW)).toEqual({ kind: "ask-last-seen", who: "shelby" })
    expect(parseTell("When did I last see Shelby", NOW)).toEqual({ kind: "ask-last-seen", who: "Shelby" })
  })
  it("overdue", () => {
    expect(parseTell("The Foxtide CDs are extremely overdue and need to be done immediately", NOW)).toEqual({
      kind: "overdue",
      what: "Foxtide CDs",
      severity: "extreme",
    })
    expect(parseTell("taxes are overdue", NOW)).toEqual({ kind: "overdue", what: "taxes", severity: "overdue" })
  })
  it("a planned event", () => {
    expect(parseTell("Elijah comes home on nov 18th", NOW)).toEqual({ kind: "event", title: "Elijah comes home", date: "2026-11-18" })
    expect(parseTell("Dinner with Sam is on nov 20 at 7pm", NOW)).toEqual({ kind: "event", title: "Dinner with Sam", date: "2026-11-20", time: "19:00" })
  })
  it("a countdown command", () => {
    expect(parseTell("create a countdown widget to when elijah comes home", NOW)).toEqual({ kind: "countdown", phrase: "elijah comes home" })
    expect(parseTell("Make a countdown to the wedding", NOW)).toEqual({ kind: "countdown", phrase: "the wedding" })
  })
  it("leaves ordinary lines alone", () => {
    expect(parseTell("making garlic confit now", NOW)).toBeNull()
    expect(parseTell("went to the dentist on nov 3", NOW)).toBeNull()
    expect(parseTell("I saw a movie yesterday", NOW)?.kind).toBe("last-seen") // the vault decides: no such person falls through
    expect(parseTell("what time is it?", NOW)).toBeNull()
    expect(parseTell("I am late", NOW)).toBeNull()
  })
  it("declines", () => {
    expect(isDecline("I don't remember")).toBe(true)
    expect(isDecline("july 5")).toBe(false)
  })
})
