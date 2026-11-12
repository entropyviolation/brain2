import { describe, expect, it } from "vitest"
import { assemble } from "./assemble"
import { clockText, parseTyped, placeClocks, resolveDay } from "./clock"
import { starterFlow } from "./flow"
import { SHIPPED_TESTS, compare, replay } from "./tests"
import { learnedPlace, matchPen, resolvePlace } from "./places"
import { routeOf, runHelper } from "./run"
import { tokenize } from "./tokens"
import { wireByRules } from "./wire"
import type { HelperContext, Wiring, WiredSegment } from "./types"

// Sunday 1 Nov 2026, so "Friday" is 30 Oct.
const NOW = new Date(2026, 10, 1, 12, 0)
const ctx = (over: Partial<HelperContext> = {}): HelperContext => ({ now: NOW, activityPens: [], locationPens: [], history: [], ...over })

const FRIDAY = `on Friday I was definitely walking around Ocean beach at least from 4:30 - 5 pm but potentially longer, maybe until 5:30, FOR SURE left at 4:30. from sometime after 5:55, I started doing the dishes, which i did until 6:19 , then I took out the trash (a task I had seriously been resisting) in the rain and threw out a neighbor's trash abandoned by the dumpster too which i counted as a good deed for the day. by 6:22 the trash stuff was done. seem to have maybe been scrolling from 6:30 - 7:19 ish around 7:34 started actually working on foxtide cd stuff. not sure for how long though. And then october 31st went for a walk from around 5:50ish until exactly 6:27 scrolled until about 7:30`

const seg = (o: Partial<WiredSegment>): WiredSegment => ({ activity: "", place: "", day: "", start: "", end: "", maybeEnd: "", length: "", startVague: false, endVague: false, notes: "", ...o })

describe("resolveDay", () => {
  it("finds the latest Friday, a dated day, and yesterday", () => {
    expect(resolveDay("Friday", NOW)).toBe("2026-10-30")
    expect(resolveDay("october 31st", NOW)).toBe("2026-10-31")
    expect(resolveDay("last night", NOW)).toBe("2026-10-31")
    expect(resolveDay("12/25", NOW)).toBe("2025-12-25")
    expect(resolveDay("last sunday", NOW)).toBe("2026-10-25")
  })
})

describe("tokenize", () => {
  it("tags days, clocks and lengths, and reads hedges and strong words", () => {
    const { tokens, marked } = tokenize(FRIDAY)
    expect(marked).toContain("Friday[D1]")
    expect(tokens.filter((t) => t.kind === "clock").map((t) => t.raw)).toEqual(["4:30", "5 pm", "5:30", "4:30", "5:55", "6:19", "6:22", "6:30", "7:19", "7:34", "5:50", "6:27", "7:30"])
    const by = (raw: string, n = 0) => tokens.filter((t) => t.raw === raw)[n]!
    expect(by("4:30", 1).cue).toBe("strong")
    expect(by("5:55").cue).toBe("hedge")
    expect(by("6:19").cue).toBe("plain")
    expect(by("7:19").cue).toBe("hedge")
    expect(by("7:34").cue).toBe("hedge")
    expect(by("5:50").cue).toBe("hedge")
    expect(by("6:27").cue).toBe("strong")
  })
  it("does not read plain numbers as clocks", () => {
    expect(tokenize("I ate 3 eggs and ran 5 miles for 20 minutes").tokens.map((t) => t.id)).toEqual(["U1"])
    expect(tokenize("left around 5, home by 7").tokens.filter((t) => t.kind === "clock")).toHaveLength(2)
  })
})

describe("placeClocks", () => {
  it("climbs through the evening by continuity and resets at a day word", () => {
    const { tokens } = tokenize("from 4:30 - 5 pm, then 5:55 until 6:19, 7:34 later. october 31st 5:50 until 6:27")
    const m = placeClocks(tokens)
    expect([...m.values()].map(clockText)).toEqual(["4:30 PM", "5:00 PM", "5:55 PM", "6:19 PM", "7:34 PM", "5:50 PM", "6:27 PM"])
  })
  it("uses a morning word and waking-hour sense for the first clock", () => {
    expect(clockText([...placeClocks(tokenize("this morning at 9 I ran").tokens).values()][0]!)).toBe("9:00 AM")
    expect(clockText([...placeClocks(tokenize("at 9 I ran").tokens).values()][0]!)).toBe("9:00 AM")
    expect(clockText([...placeClocks(tokenize("at 3 I napped").tokens).values()][0]!)).toBe("3:00 PM")
  })
})

describe("the Friday account", () => {
  const { tokens } = tokenize(FRIDAY)
  const id = (raw: string, n = 0) => tokens.filter((t) => t.raw === raw)[n]!.id
  const wiring: Wiring = {
    segments: [
      seg({ activity: "walking", place: "Ocean Beach", day: "D1", start: id("4:30"), end: id("5 pm"), maybeEnd: id("5:30"), endVague: true }),
      seg({ activity: "dishes", start: id("5:55"), end: id("6:19") }),
      seg({ activity: "taking out trash", end: id("6:22"), notes: "overcame resistance; took out a neighbor's trash too (good deed)" }),
      seg({ activity: "scrolling", start: id("6:30"), end: id("7:19") }),
      seg({ activity: "foxtide cd work", start: id("7:34") }),
      seg({ activity: "walking", day: "D2", start: id("5:50"), end: id("6:27") }),
      seg({ activity: "scrolling", end: id("7:30") }),
    ],
  }
  const { blocks, unplaced } = assemble(wiring, tokens, FRIDAY, ctx())
  const row = (b: (typeof blocks)[number]) => [b.day, b.activity, clockText(b.startMin!), b.startCert, clockText(b.endMin!), b.endCert, b.place?.name ?? "", b.place?.source ?? ""]

  it("makes seven blocks on two days with every time placed", () => {
    expect(unplaced).toEqual([])
    expect(blocks.map(row)).toEqual([
      ["2026-10-30", "walking", "4:30 PM", "exact", "5:00 PM", "estimated", "Ocean Beach", "stated"],
      ["2026-10-30", "dishes", "5:55 PM", "estimated", "6:19 PM", "exact", "Home", "assumed"],
      ["2026-10-30", "taking out trash", "6:19 PM", "exact", "6:22 PM", "exact", "Home", "assumed"],
      ["2026-10-30", "scrolling", "6:30 PM", "estimated", "7:19 PM", "estimated", "", ""],
      ["2026-10-30", "foxtide cd work", "7:34 PM", "estimated", "8:04 PM", "estimated", "", ""],
      ["2026-10-31", "walking", "5:50 PM", "estimated", "6:27 PM", "exact", "", ""],
      ["2026-10-31", "scrolling", "6:27 PM", "exact", "7:30 PM", "estimated", "", ""],
    ])
  })
  it("chains edges, flags the open end, and keeps the maybe-end", () => {
    expect(blocks[2]!.startChained).toBe(true)
    expect(blocks[6]!.startChained).toBe(true)
    expect(blocks[4]!.openEnd).toBe(true)
    expect(blocks[0]!.notes).toContain("may have run until 5:30 PM")
  })
})

describe("places and pens", () => {
  it("matches a pen by its words", () => {
    const pens = [{ name: "Trash" }, { name: "Dishes" }]
    expect(matchPen("taking out trash", pens)?.name).toBe("Trash")
    expect(matchPen("doing the dishes", pens)?.name).toBe("Dishes")
    expect(matchPen("scrolling", pens)).toBeNull()
  })
  it("learns where an activity usually happens from history", () => {
    const h = (date: string, scopeId: string, pen: string) => ({ date, scopeId, pen, startMin: 600, endMin: 660 })
    const history = [h("2026-10-01", "activity", "Gym"), h("2026-10-01", "location", "Iron Works"), h("2026-10-03", "activity", "Gym"), h("2026-10-03", "location", "Iron Works"), h("2026-10-05", "activity", "Gym"), h("2026-10-05", "location", "Home")]
    expect(learnedPlace("gym", history)?.name).toBe("Iron Works")
    expect(resolvePlace("", "gym", [], history)).toMatchObject({ name: "Iron Works", source: "learned" })
    expect(resolvePlace("", "scrolling", [], [])).toBeNull()
    expect(resolvePlace("ocean beach", "walking", [{ name: "Ocean Beach" }], [])).toMatchObject({ name: "Ocean Beach", isNew: false })
  })
})

describe("routing and rules", () => {
  it("routes by code", () => {
    const flow = starterFlow()
    expect(routeOf("I walked from 4 to 5", flow, null)).toBe("log")
    expect(routeOf("what can you do?", flow, null)).toBe("question")
    expect(routeOf("actually the walk ended at 4:45", flow, "I walked from 4 to 5")).toBe("revise")
    expect(routeOf("actually the walk ended at 4:45", flow, null)).toBe("log")
  })
  it("reads clean text without a model", () => {
    const { tokens, marked } = tokenize("yesterday I did dishes from 5 until 6:15. then I folded laundry by 7")
    const w = wireByRules(marked, tokens, ctx())
    const out = assemble(w, tokens, "x", ctx())
    expect(out.blocks.map((b) => [b.day, b.activity, clockText(b.startMin!), clockText(b.endMin!)])).toEqual([
      ["2026-10-31", "dishes", "5:00 PM", "6:15 PM"],
      ["2026-10-31", "folded laundry", "6:15 PM", "7:00 PM"],
    ])
  })
  it("runs end to end with a stub model and answers a question with no model", async () => {
    const call = async () => ({ segments: [seg({ activity: "walking", start: "T1", end: "T2" })] })
    const run = await runHelper({ text: "walked 4:30 to 5:10 yesterday", flow: starterFlow(), ctx: ctx(), call, ladder: ["m"] })
    expect(run.route).toBe("log")
    expect(run.blocks).toHaveLength(1)
    expect(run.trace.map((t) => t.stage)).toEqual(["route", "tokenize", "wire", "place"])
    expect((await runHelper({ text: "how does this work?", flow: starterFlow(), ctx: ctx(), call, ladder: ["m"] })).route).toBe("question")
  })
})

describe("typed clocks", () => {
  it("reads what a card field holds", () => {
    expect(parseTyped("17:55")).toBe(1075)
    expect(parseTyped("5:55 pm")).toBe(1075)
    expect(parseTyped("555pm")).toBe(1075)
    expect(parseTyped("nope")).toBeNull()
  })
})

describe("shipped lab tests replay green", () => {
  for (const t of SHIPPED_TESTS) {
    it(t.name, () => {
      const r = replay(t, { activityPens: [], locationPens: [], history: [] })
      expect(r.diff).toEqual([])
      expect(r.pass).toBe(true)
    })
  }
})

describe("what the live 14B got wrong, caught in code", () => {
  const { tokens } = tokenize(FRIDAY)
  const wiring: Wiring = {
    segments: [
      seg({ activity: "dishes", start: "T5", end: "T6" }),
      seg({ activity: "taking out trash" }),
      seg({ activity: "scrolling", start: "T8", end: "T9", maybeEnd: "T10" }),
      seg({ activity: "foxtide", start: "T10" }),
    ],
  }
  const { blocks } = assemble(wiring, tokens, FRIDAY, ctx())
  it("gives the trash its end from the unused 'by 6:22' clock, with its start chained", () => {
    const trash = blocks.find((b) => b.activity === "taking out trash")!
    expect([clockText(trash.startMin!), clockText(trash.endMin!), trash.startChained, trash.openEnd]).toEqual(["6:19 PM", "6:22 PM", true, undefined])
  })
  it("drops a maybe-end that is really the next entry's start", () => {
    expect(blocks.find((b) => b.activity === "scrolling")!.notes).toBe("")
  })
})

describe("compare", () => {
  const r = (activity: string, place = "") => ({ day: "2026-10-30", activity, start: "7:34 PM", startCert: "estimated" as const, end: "8:04 PM", endCert: "estimated" as const, place })
  it("pairs rows by times and the activity's content words, and reports the rest", () => {
    expect(compare([r("working on foxtide cd stuff", "ocean beach")], [r("foxtide cd work", "Ocean Beach")]).pass).toBe(true)
    const miss = compare([r("scrolling")], [r("foxtide cd work")])
    expect(miss.pass).toBe(false)
    expect(miss.diff).toHaveLength(2)
  })
})

describe("overnight blocks", () => {
  const text = "Yesterday I woke up at 5pm and scrolled until 9 then from then until about 6am working on brain 2"
  const { tokens } = tokenize(text)
  const id = (raw: string) => tokens.find((t) => t.raw === raw)!.id
  it("ends a block the next morning when its end reads earlier than its start", () => {
    const wiring: Wiring = { segments: [seg({ activity: "scrolling", start: id("5pm"), end: id("9") }), seg({ activity: "working", start: id("9"), end: id("6am") })] }
    const { blocks } = assemble(wiring, tokens, text, ctx())
    const work = blocks.find((b) => b.activity === "working")!
    expect(work.startMin).toBe(21 * 60)
    expect(work.endMin).toBe(30 * 60)
    expect(work.openEnd).toBeUndefined()
  })
  it("wraps a 13 hour block too", () => {
    const wiring: Wiring = { segments: [seg({ activity: "working", start: id("5pm"), end: id("6am") })] }
    expect(assemble(wiring, tokens, text, ctx()).blocks[0]!.endMin).toBe(30 * 60)
  })
})

describe("untimed entries", () => {
  const text = "on october 9th I went walking for 5 hours with patricia and we were happy the whole time, we went to mission beach and at 3pm i had a dentist appointment until around 5 and then i got ice cream with elijah"
  const { tokens } = tokenize(text)
  const id = (raw: string) => tokens.find((t) => t.raw === raw)!.id
  const wiring: Wiring = {
    segments: [
      seg({ activity: "walking", place: "mission beach", day: id("october 9th"), length: id("5 hours"), with: "patricia", mood: "happy" }),
      seg({ activity: "dentist appointment", start: id("3pm"), end: id("5"), endVague: true }),
      seg({ activity: "getting ice cream", with: "elijah" }),
    ],
  }
  it("hangs a length-only walk off the next start and chains an untimed entry after the last end", () => {
    const { blocks, unplaced } = assemble(wiring, tokens, text, ctx({ locationPens: [{ id: "p", name: "mission beach" }] }))
    expect(unplaced).toEqual([])
    const by = (a: string) => blocks.find((b) => b.activity === a)!
    expect([by("walking").startMin, by("walking").endMin]).toEqual([10 * 60, 15 * 60])
    expect(by("walking").with).toBe("patricia")
    expect(by("walking").mood).toBe("happy")
    expect(by("walking").place?.name).toBe("mission beach")
    expect(by("getting ice cream").startMin).toBe(17 * 60)
    expect(by("getting ice cream").startCert).toBe("estimated")
    expect(by("getting ice cream").with).toBe("elijah")
  })
})

describe("sleep is read by code", () => {
  // Saturday 7 Nov 2026, 2:17 PM, as in the report.
  const now = new Date(2026, 10, 7, 14, 17)
  const run = (text: string) => runHelper({ text, flow: starterFlow(), ctx: ctx({ now }), call: null, ladder: [] })
  it("files bed at 9 PM yesterday and wake at 1:30 AM, not 9 AM to 9:05", async () => {
    const { blocks } = await run("woke up at 1:30 am after going to bed yesterday at around 9")
    expect(blocks).toHaveLength(1)
    const b = blocks[0]!
    expect(b.activity).toBe("sleeping")
    expect(b.day).toBe("2026-11-06")
    expect([b.startMin, b.endMin]).toEqual([21 * 60, 24 * 60 + 90])
    expect(b.startCert).toBe("estimated")
    expect(b.openEnd).toBeUndefined()
  })
  it("reads a range: slept from 10 to 6", async () => {
    const { blocks } = await run("slept from 10 to 6 last night")
    expect([blocks[0]!.startMin, blocks[0]!.endMin]).toEqual([22 * 60, 24 * 60 + 360])
  })
  it("reads bed at 1 as after midnight and wake at 9 as morning", async () => {
    const { blocks } = await run("today I went to bed at 1 and woke up at 9")
    expect([blocks[0]!.startMin, blocks[0]!.endMin]).toEqual([60, 540])
  })
})
