import { describe, expect, it } from "vitest"
import { parseWhen, premiseCheck, runCompute } from "./compute"
import { entry, NOW, SCENARIO_VAULT } from "./scenarios"
import type { ComputeConfig } from "./types"
import type { VaultSnapshot } from "./vault-search"

const run = (cfg: ComputeConfig, terms: string[], text = "", snap: VaultSnapshot = SCENARIO_VAULT) => runCompute(snap, cfg, { terms, now: NOW, text })

describe("parseWhen", () => {
  // NOW is Friday 2026-10-30.
  const cases: [string, string, string, string][] = [
    ["how much did i walk yesterday", "2026-10-29", "2026-10-29", "yesterday"],
    ["what did i do last night", "2026-10-29", "2026-10-29", "yesterday"],
    ["the day before yesterday i cooked", "2026-10-28", "2026-10-28", "the day before yesterday"],
    ["how am i doing today", "2026-10-30", "2026-10-30", "today"],
    ["this morning i showered", "2026-10-30", "2026-10-30", "today"],
    ["hours worked this week", "2026-10-26", "2026-10-30", "this week"],
    ["hours worked last week", "2026-10-19", "2026-10-25", "last week"],
    ["last 3 days of walking", "2026-10-28", "2026-10-30", "last 3 days"],
    ["past five days", "2026-10-26", "2026-10-30", "last 5 days"],
    ["last month", "2026-09-01", "2026-09-30", "last month"],
    ["this month", "2026-10-01", "2026-10-30", "this month"],
    ["this year", "2026-01-01", "2026-10-30", "this year"],
    ["the weekend", "2026-10-24", "2026-10-25", "the weekend"],
  ]
  for (const [text, from, to, label] of cases) {
    it(`reads "${text}"`, () => expect(parseWhen(text, NOW)).toEqual({ from, to, label }))
  }
  it("returns null when no time is named", () => expect(parseWhen("when did i last shower", NOW)).toBeNull())
  it("lets a specific phrase beat a general one", () => expect(parseWhen("yesterday, not this week", NOW)?.label).toBe("yesterday"))
  it("on a Monday, last week is the 7 days before it", () => {
    expect(parseWhen("last week", new Date("2026-10-26T10:00:00"))).toEqual({ from: "2026-10-19", to: "2026-10-25", label: "last week" })
  })
  it("on a Sunday, this week starts on the Monday six days back", () => {
    expect(parseWhen("this week", new Date("2026-10-25T10:00:00"))?.from).toBe("2026-10-19")
  })
  it("crosses a month boundary", () => {
    expect(parseWhen("last 3 days", new Date("2026-11-01T10:00:00"))).toEqual({ from: "2026-10-30", to: "2026-11-01", label: "last 3 days" })
  })
})

describe("compute", () => {
  it("sums minutes for a subject this week", () => {
    const r = run({ fn: "minutes" }, ["brain2"], "hours on brain2 this week")
    expect(r.total).toBe(4)
    expect(r.facts[0]).toContain("630 minutes (10h 30m)")
    expect(r.window.label).toBe("this week")
  })

  it("counts entries and different days", () => {
    const r = run({ fn: "count" }, ["walking"], "how many times did i walk this week")
    expect(r.facts[0]).toContain("5 tracked entries on 5 different days")
  })

  it("lets the text's time word beat the node's days", () => {
    const r = run({ fn: "count", days: 30 }, ["walking"], "walking last 3 days")
    expect(r.facts[0]).toContain("3 tracked entries")
  })

  it("falls back to the node's days when the text names no time", () => {
    const r = run({ fn: "count", days: 30 }, ["walking"], "walking")
    expect(r.facts[0]).toContain("7 tracked entries")
  })

  it("drops machine-painted rows unless asked", () => {
    expect(run({ fn: "count" }, ["cooking"], "last 3 days").total).toBe(1)
    expect(run({ fn: "count", confirmedOnly: false }, ["cooking"], "last 3 days").total).toBe(2)
  })

  it("counts a moment with no length as an entry but adds no minutes", () => {
    const r = run({ fn: "minutes" }, ["orgasm"], "today")
    expect(r.total).toBe(1)
    expect(r.facts.join(" ")).toContain("0 minutes")
    expect(r.facts.join(" ")).toContain("no length")
  })

  it("reports a streak that includes today", () => {
    const r = run({ fn: "streak" }, ["walking"])
    expect(r.facts[0]).toContain("current run 5 days")
    expect(r.facts[0]).toContain("longest in the last year 5 days (ending 2026-10-30)")
    expect(r.facts[0]).toContain("7 days in all")
  })

  it("keeps a streak alive when only today is missing", () => {
    const snap: VaultSnapshot = { ...SCENARIO_VAULT, history: { ...SCENARIO_VAULT.history!, entries: [entry("2026-10-28", "activity", "yoga", "07:00", "07:30"), entry("2026-10-29", "activity", "yoga", "07:00", "07:30")] } }
    expect(run({ fn: "streak" }, ["yoga"], "", snap).facts[0]).toContain("current run 2 days")
  })

  it("ends a streak after a missed day", () => {
    const snap: VaultSnapshot = { ...SCENARIO_VAULT, history: { ...SCENARIO_VAULT.history!, entries: [entry("2026-10-27", "activity", "yoga", "07:00", "07:30"), entry("2026-10-29", "activity", "yoga", "07:00", "07:30")] } }
    const f = run({ fn: "streak" }, ["yoga"], "", snap).facts[0]!
    expect(f).toContain("current run 1 day;")
    expect(f).toContain("longest in the last year 1 day ")
  })

  it("says how long since the last time", () => {
    expect(run({ fn: "days-since" }, ["shower"]).facts[0]).toContain("last tracked 2026-10-28 08:10, 2 days before 2026-10-30")
  })

  it("says when the subject is not tracked at all", () => {
    const r = run({ fn: "days-since" }, ["skydiving"])
    expect(r.facts[0]).toContain("not tracked in the last year")
    expect(r.total).toBe(0)
  })

  it("finds the longest stretch without, including the trailing one", () => {
    const f = run({ fn: "longest-gap", days: 30 }, ["gym"]).facts[0]!
    expect(f).toContain("17 days (2026-10-14 to 2026-10-30)")
    expect(f).toContain("appears on 2 days")
  })

  it("finds a gap between two days", () => {
    expect(run({ fn: "longest-gap" }, ["walking"], "last 10 days").facts[0]).toContain("4 days (2026-10-22 to 2026-10-25)")
  })

  it("reports no gap when the subject is on every day", () => {
    expect(run({ fn: "longest-gap" }, ["walking"], "last 3 days").facts[0]).toContain("every day")
  })

  it("treats a missing subject as one big gap", () => {
    expect(run({ fn: "longest-gap" }, ["sailing"], "this week").facts[0]).toContain("the whole window (5 days) is a gap")
  })

  it("ranks labels by minutes", () => {
    const f = run({ fn: "top-pens" }, [], "this week").facts[0]!
    expect(f.indexOf("computer work")).toBeLessThan(f.indexOf("walking"))
  })

  it("compares a window with the equal one before it", () => {
    const f = run({ fn: "compare" }, ["walking"], "this week").facts[0]!
    expect(f).toContain("5 entries / 3h 45m")
    expect(f).toContain("had 1 entries / 30m")
    expect(f).toContain("Change +3h 15m")
  })

  it("reads another view when asked", () => {
    const r = run({ fn: "count", scopeIds: ["mood"] }, ["anxious"], "last 3 days")
    expect(r.total).toBe(1)
    expect(r.rows[0]!.source).toBe("Mood")
  })

  it("gives an honest empty result", () => {
    const r = run({ fn: "minutes" }, ["skydiving"], "this week")
    expect(r.total).toBe(0)
    expect(r.note).toContain("Nothing tracked matches")
  })

  it("works with no history at all", () => {
    const r = run({ fn: "streak" }, ["walking"], "", { ...SCENARIO_VAULT, history: undefined })
    expect(r.total).toBe(0)
    expect(r.facts[0]).toContain("no tracked days")
  })

  it("shows the newest rows first, capped", () => {
    const r = run({ fn: "count", limit: 2 }, ["walking"], "this week")
    expect(r.rows.map((x) => x.when.slice(0, 10))).toEqual(["2026-10-30", "2026-10-29"])
    expect(r.total).toBe(5)
  })
})

describe("premiseCheck", () => {
  it("holds when a word is an item, list, pen, person, note or French text", () => {
    for (const w of ["shirt", "errands", "walking", "lex", "linen", "verbes", "écrit"]) expect(premiseCheck(SCENARIO_VAULT, [w]).holds, w).toBe(true)
  })
  it("finds a stem, so showered matches shower", () => expect(premiseCheck(SCENARIO_VAULT, ["showered"]).holds).toBe(true))
  it("fails when nothing was ever written", () => {
    const p = premiseCheck(SCENARIO_VAULT, ["socks", "mars"])
    expect(p.holds).toBe(false)
    expect(p.unknown).toEqual(["socks", "mars"])
  })
  it("holds on partial knowledge, naming what is unknown", () => {
    const p = premiseCheck(SCENARIO_VAULT, ["shirt", "mars"])
    expect(p.holds).toBe(true)
    expect(p.unknown).toEqual(["mars"])
  })
  it("holds when there is no subject to check", () => expect(premiseCheck(SCENARIO_VAULT, []).holds).toBe(true))
  it("is not fooled by stopwords", () => expect(premiseCheck(SCENARIO_VAULT, ["the", "when", "mars"]).holds).toBe(false))
})
