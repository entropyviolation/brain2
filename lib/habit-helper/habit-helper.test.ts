import { describe, expect, it } from "vitest"
import { computeAll, editProposal, reviseProposal } from "./compute"
import { findEvidence, readSpanAnswer } from "./evidence"
import { starterFlow } from "./flow"
import { missDays, nudges, reasonsOf, whyQueue } from "./history"
import { scoreClause } from "./lexicon"
import { cleanMatching, fillFromRules, matchByRules, matchSchema } from "./match"
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
  it("treats 'i did do that' as done for the day asked about, not a reason", async () => {
    const run = await runHabitsBimby({ text: "i did do that", flow, ctx: fixtureCtx(TEST_NOW), call: null, ladder: [], pending: { habitId: "outside", day: "2026-10-31" } })
    expect(run.route).toBe("answer")
    expect(run.proposals[0]!.day).toBe("2026-10-31")
    expect(run.proposals[0]!.kind).toBe("set")
    expect(run.proposals[0]!.write).not.toHaveProperty("missReason")
  })
  it("still routes a quoted what's-left to the nudge while a question is open", () => {
    expect(routeOf("“what’s left today?”", flow, { habitId: "outside", day: "2026-10-31" }, fixtureCtx(TEST_NOW))).toBe("nudge")
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

describe("walk found in the BIM log", () => {
  const logs = [{ text: "home from my walk", at: new Date(2026, 9, 31, 18, 0).toISOString() }, { text: "drank water", at: new Date(2026, 9, 31, 12, 0).toISOString() }]
  const ctx = fixtureCtx(TEST_NOW)
  const ask = () => runHabitsBimby({ text: "i did exercise yesterday", flow, ctx, call: null, ladder: [], logs })

  it("knows the walk ended at 6 pm and asks when it started, instead of setting the goal", async () => {
    const run = await ask()
    expect(run.proposals).toEqual([])
    expect(run.pendingSpan).toMatchObject({ habitId: "exercise", day: "2026-10-31", known: "end", min: 18 * 60, activity: "walk" })
    expect(run.reply).toMatch(/home from my walk[\s\S]*6:00 pm[\s\S]*started/)
  })
  it("a definite start adds the hour and paints 5–6 pm", async () => {
    const pendingSpan = (await ask()).pendingSpan!
    const run = await runHabitsBimby({ text: "walk was started at 5 pm", flow, ctx, call: null, ladder: [], pendingSpan })
    expect(run.route).toBe("span")
    expect(run.proposals[0]!.write).toEqual({ value: 60 })
    expect(run.proposals[0]!.span).toMatchObject({ startMin: 17 * 60, endMin: 18 * 60, estimated: false })
  })
  it("a guess is credited too, and marked estimated", async () => {
    const pendingSpan = (await ask()).pendingSpan!
    const run = await runHabitsBimby({ text: "around 5pm", flow, ctx, call: null, ladder: [], pendingSpan })
    expect(run.proposals[0]!.write).toEqual({ value: 60 })
    expect(run.proposals[0]!.span!.estimated).toBe(true)
  })
  it("reads a bare hour on the right side of the end, and a length", () => {
    const p = { known: "end" as const, min: 18 * 60 }
    expect(readSpanAnswer("5", p)).toMatchObject({ startMin: 17 * 60, endMin: 18 * 60 })
    expect(readSpanAnswer("about 45 minutes", p)).toMatchObject({ startMin: 17 * 60 + 15, estimated: true })
    expect(readSpanAnswer("it rained", p)).toBeNull()
  })
  it("a start line asks for the end; no cue or another day gives nothing", () => {
    const exercise = FIXTURE.find((x) => x.id === "exercise")!
    expect(findEvidence(exercise, "2026-10-31", [{ text: "heading out for a run", at: new Date(2026, 9, 31, 7, 30).toISOString() }])).toMatchObject({ known: "start", min: 450 })
    expect(findEvidence(exercise, "2026-10-31", [{ text: "went for a walk", at: new Date(2026, 9, 31, 18).toISOString() }])).toBeNull()
    expect(findEvidence(exercise, "2026-10-30", logs)).toBeNull()
  })
  it("with no log it still sets the goal as before", async () => {
    const run = await runHabitsBimby({ text: "i did exercise yesterday", flow, ctx, call: null, ladder: [], logs: [] })
    expect(run.proposals[0]!.to).toBe("30 min")
  })
})

describe("trusting the words, and editing a row", () => {
  const habits: HabitBrief[] = [
    { id: "skin", name: "Skincare", kind: "yesno", words: [], days: {} },
    { id: "hemi", name: "1 hemisync module per day", kind: "yesno", words: [], days: {} },
    { id: "study", name: "Study for 1 hour", kind: "goal", goal: 60, unit: "min", words: [], days: {} },
  ]
  const ctx = { now: NOW, habits }
  const text = "i just washed my face after moon mask (skincare)"
  const item = { clause: "C1", habit: "hemi", maybe: "study", kind: "done" as const, amount: "", day: "", reason: "" }

  it("a model pick that the words disagree with loses to the habit the words name", () => {
    const out = computeAll({ items: [item] }, tagText(text, NOW), ctx)
    expect(out.asks).toEqual([])
    expect(out.proposals[0]).toMatchObject({ habitId: "skin", from: "undone", to: "done" })
  })

  it("rewrites a row's habit, day and state, and re-reads the old value", () => {
    const p = computeAll({ items: [{ ...item, habit: "skin", maybe: "" }] }, tagText(text, NOW), ctx).proposals[0]!
    const goal = reviseProposal(p, { habitId: "study" }, ctx)
    expect(goal.write).toEqual({ value: 60 })
    expect(goal.needs).toMatch(/How much/)
    const typed = reviseProposal(goal, { value: 45, day: "2026-11-05" }, ctx)
    expect(typed).toMatchObject({ day: "2026-11-05", to: "45 min", needs: undefined })
    expect(reviseProposal(p, { done: false }, ctx).to).toBe("undone")
  })
})

describe("a list handed over in one message", () => {
  const hb = (o: Partial<HabitBrief> & Pick<HabitBrief, "id" | "name">): HabitBrief => ({ kind: "yesno", words: [], days: {}, ...o })
  const SAID = "i did skincare, stretched, drank water, unfollowed 1 person"
  const run = (habits: HabitBrief[], text = SAID) => runHabitsBimby({ text, flow: starterFlow(), ctx: fixtureCtx(TEST_NOW, habits), call: null, ladder: [] })

  it("proposes every habit named", async () => {
    const r = await run([...FIXTURE, hb({ id: "skin", name: "Skincare" }), hb({ id: "unf", name: "Unfollow 5 people", kind: "goal", goal: 5 })])
    expect(r.proposals.map((p) => `${p.habitId}:${p.to}`)).toEqual(["skin:done", "stretch:done", "water:done", "unf:1"])
  })
  it("reads skincare as a habit named Skin care, and the other way round", async () => {
    expect(scoreClause("i did skincare", [hb({ id: "skin", name: "Skin care" })])[0]?.id).toBe("skin")
    expect(scoreClause("did my skin care", [hb({ id: "skin", name: "Skincare" })])[0]?.id).toBe("skin")
    const r = await run([...FIXTURE, hb({ id: "am", name: "Skin care (AM)" }), hb({ id: "pm", name: "Skin care (PM)" })], "i did skincare, stretched")
    expect(r.asks[0]?.options.map((o) => o.id).sort()).toEqual(["am", "pm"])
    expect(r.proposals.map((p) => p.habitId)).toEqual(["stretch"])
  })
  it("says which part named no habit", async () => {
    const r = await run(FIXTURE)
    expect(r.proposals.map((p) => p.habitId)).toEqual(["stretch", "water"])
    expect(r.reply).toMatch(/No daily habit matched “i did skincare”, “unfollowed 1 person”/)
  })
  it("fills a clause the model left out from the words", () => {
    const habits = [...FIXTURE, hb({ id: "skin", name: "Skincare" })]
    const t = tagText(SAID, new Date(TEST_NOW))
    const rules = matchByRules(t, fixtureCtx(TEST_NOW, habits))
    const model = { items: rules.items.filter((x) => x.clause !== "C2") }
    expect(fillFromRules(model, rules, t).items.map((x) => x.clause)).toEqual(["C1", "C2", "C3"])
  })
})
