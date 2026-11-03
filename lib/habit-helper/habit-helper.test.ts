import { describe, expect, it } from "vitest"
import { editProposal } from "./compute"
import { starterFlow } from "./flow"
import { missDays, nudges, reasonsOf, whyQueue } from "./history"
import { cleanMatching, matchSchema } from "./match"
import { routeOf, runHabitsBimby } from "./run"
import { candidates, suggestShorthands } from "./shorthand"
import { tagText } from "./tags"
import { FIXTURE, OUTSIDE_TEXT, SHIPPED_TESTS, TEST_NOW, byRules, fixtureCtx, replay } from "./tests"
import type { HabitBrief } from "./types"

const NOW = new Date(TEST_NOW)
const flow = starterFlow()

describe("recorded cases", () => {
  for (const t of SHIPPED_TESTS) {
    it(`replays ${t.id}`, () => expect(replay(t).diff).toEqual([]))
    it(`reads ${t.id} by rules, with Ollama off`, () => expect(byRules(t).diff).toEqual([]))
  }
})

describe("tagText", () => {
  it("cuts a list into clauses and tags the amount", () => {
    const t = tagText("daily habits completed - drank water, read 10 pages, stretched", NOW)
    expect(t.clauses.map((c) => c.text)).toEqual(["daily habits completed", "drank water", "read 10 pages", "stretched"])
    expect(t.marked).toContain("[C3] read 10 pages[N1]")
  })
  it("keeps the because part on its clause, word for word, and only reads a negation before it", () => {
    const t = tagText(OUTSIDE_TEXT, NOW)
    expect(t.clauses).toHaveLength(1)
    expect(t.clauses[0]!.negated).toBe(true)
    expect(t.tags.find((x) => x.kind === "because")!.reason).toBe("I woke up too late and it was dark")
    expect(tagText("I walked because I didn't want to drive", NOW).clauses[0]!.negated).toBe(false)
  })
  it("reads hours as minutes, word numbers only with a unit, and skips clocks", () => {
    const amounts = (s: string) => tagText(s, NOW).tags.filter((x) => x.kind === "amount").map((x) => [x.amount, x.unit])
    expect(amounts("ran for an hour")).toEqual([[60, "min"]])
    expect(amounts("half an hour of cleaning")).toEqual([[30, "min"]])
    expect(amounts("woke at 9:40 and read at 7")).toEqual([])
    expect(amounts("ate a cookie")).toEqual([])
    expect(amounts("did 20 pushups")).toEqual([[20, "pushup"]])
  })
  it("resolves day words in code and carries them forward", () => {
    const t = tagText("on Friday I stretched, then read 5 pages", NOW)
    expect(t.clauses.map((c) => c.day)).toEqual(["2026-10-30", "2026-10-30"])
  })
})

describe("compute", () => {
  it("adds with 'another', converts hours, and sets the goal when no amount is said", async () => {
    const habits = FIXTURE.map((x) => (x.id === "read" ? { ...x, days: { "2026-11-01": { met: true, value: 5 } } } : x))
    const run = await runHabitsBimby({ text: "read another 4 pages, cleaned for an hour", flow, ctx: fixtureCtx(TEST_NOW, habits), call: null, ladder: [] })
    expect(run.proposals.map((p) => [p.habitId, p.from, p.to])).toEqual([
      ["read", "5 pages", "9 pages"],
      ["clean", "0 min", "60 min"],
    ])
    const exercise = await runHabitsBimby({ text: "exercised", flow, ctx: fixtureCtx(TEST_NOW), call: null, ladder: [] })
    expect(exercise.proposals[0]!.to).toBe("30 min")
  })
  it("will not mark a done cell missed, nor a day still ahead", async () => {
    const habits = FIXTURE.map((x) => (x.id === "outside" ? { ...x, days: { "2026-11-01": { met: true, completed: true } } } : x))
    const run = await runHabitsBimby({ text: OUTSIDE_TEXT, flow, ctx: fixtureCtx(TEST_NOW, habits), call: null, ladder: [] })
    expect(run.proposals).toEqual([])
    expect(run.notes[0]).toMatch(/already done/)
  })
  it("uses the model's pick but asks when the words tie, and drops ids that do not exist", () => {
    const m = cleanMatching({ items: [{ clause: "C1", habit: "" }, { clause: "C2", habit: "read" }] })
    expect(m.items).toHaveLength(1)
    const schema = matchSchema(tagText("read 5 pages", NOW), FIXTURE) as { properties: { items: { items: { properties: { habit: { enum: string[] } } } } } }
    expect(schema.properties.items.items.properties.habit.enum).toEqual(["", ...FIXTURE.map((x) => x.id)])
  })
  it("edits a card's value, reason or name", () => {
    const p = { id: "p", kind: "set" as const, habitId: "read", habit: "read", day: "2026-11-01", from: "0 pages", to: "10 pages", write: { value: 10 }, words: "" }
    expect(editProposal(p, "12").write).toEqual({ value: 12 })
    expect(editProposal(p, "12").to).toBe("12 pages")
    const miss = { ...p, kind: "missed" as const, to: "missed", write: { missedOpportunity: true, missReason: "x" } }
    expect(editProposal(miss, " it was dark ").write?.missReason).toBe(" it was dark ")
  })
})

describe("route", () => {
  it("sends commands and answers to code", () => {
    expect(routeOf("Give relevant shorthand names to all of my daily habits", flow, null)).toBe("shorthand")
    expect(routeOf("what's left today?", flow, null)).toBe("nudge")
    expect(routeOf("show my reasons for go outside", flow, null)).toBe("reasons")
    expect(routeOf("what can you do", flow, null)).toBe("question")
    expect(routeOf("it rained", flow, { habitId: "outside", day: "2026-10-31" })).toBe("answer")
    expect(routeOf("drank water", flow, null)).toBe("log")
    const pending = { habitId: "outside", day: "2026-10-31" }
    expect(routeOf("drank water, read 10 pages", flow, pending, fixtureCtx(TEST_NOW))).toBe("log")
    expect(routeOf("I didn't go outside, it was too cold", flow, pending, fixtureCtx(TEST_NOW))).toBe("answer")
  })
  it("records an answer word for word", async () => {
    const run = await runHabitsBimby({ text: "it was pouring, honestly", flow, ctx: fixtureCtx(TEST_NOW), call: null, ladder: [], pending: { habitId: "outside", day: "2026-10-31" } })
    expect(run.proposals[0]!.write).toEqual({ missedOpportunity: true, missReason: "it was pouring, honestly" })
  })
})

const days = (map: Record<string, Partial<HabitBrief["days"][string]>>) => Object.fromEntries(Object.entries(map).map(([k, v]) => [k, { met: false, ...v }]))

describe("history", () => {
  const outside: HabitBrief = { ...FIXTURE[4]!, days: days({ "2026-10-31": {}, "2026-10-30": { met: true }, "2026-10-29": {}, "2026-10-28": {} }), since: "2026-10-25" }
  it("counts misses since the habit existed and skips paused days", () => {
    expect(missDays(outside, "2026-11-01", 7)).toEqual(["2026-10-31", "2026-10-29", "2026-10-28", "2026-10-27", "2026-10-26", "2026-10-25"])
    expect(missDays({ ...outside, pauses: [{ from: "2026-10-26", to: "2026-10-29" }] }, "2026-11-01", 7)).toEqual(["2026-10-31", "2026-10-25"])
  })
  it("asks about a marked miss first, then a habit missed again and again, one per habit", () => {
    const water: HabitBrief = { ...FIXTURE[0]!, days: days({ "2026-10-31": { missed: true } }), since: "2026-10-31" }
    const q = whyQueue({ now: NOW, habits: [outside, water] }, flow, [])
    expect(q.map((x) => [x.habitId, x.day])).toEqual([["water", "2026-10-31"], ["outside", "2026-10-31"]])
    expect(whyQueue({ now: NOW, habits: [outside, water] }, flow, [{ habitId: "water" }])).toHaveLength(1)
  })
  it("nudges from the time it is usually done", () => {
    const at = (d: number, h: number) => new Date(2026, 9, d, h, 0).getTime()
    const water: HabitBrief = { ...FIXTURE[0]!, days: days({ "2026-10-31": { met: true, at: at(31, 10) }, "2026-10-30": { met: true, at: at(30, 10) }, "2026-10-29": { met: true, at: at(29, 10) } }) }
    expect(nudges({ now: NOW, habits: [water] })[0]!.text).toBe("You usually do this before 11 am; it's 9:40 am.")
  })
  it("lists reasons and counts themes", () => {
    const r = reasonsOf({ ...outside, days: days({ "2026-10-31": { reason: "woke up late" }, "2026-10-29": { reason: "it was dark and late" }, "2026-10-28": { notes: ["raining"] } }) })
    expect(r.list.map((x) => x.reason)).toEqual(["woke up late", "it was dark and late", "raining"])
    expect(r.themes[0]).toEqual({ theme: "sleep", n: 2 })
    expect(r.words[0]).toEqual({ word: "late", n: 2 })
  })
})

describe("shorthand", () => {
  it("drops numbers, units and light verbs", () => {
    expect(candidates("clean for 15 minutes")[0]).toBe("clean")
    expect(candidates("read 5 pages")[0]).toBe("read")
    expect(candidates("Go to bed before 11pm")[0]).toBe("bed")
  })
  it("leaves habits that already have one, and stays unique against them", () => {
    const habits = FIXTURE.map((x) => (x.id === "water" ? { ...x, shorthand: "read" } : x))
    const out = suggestShorthands(habits)
    expect(out.find((p) => p.habitId === "water")).toBeUndefined()
    expect(out.find((p) => p.habitId === "read")!.to).toBe("read 2")
  })
})
