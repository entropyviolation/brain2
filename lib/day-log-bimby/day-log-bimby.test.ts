import { describe, expect, it } from "vitest"
import { autoPlan } from "./schedule"
import { amendmentKind, makeAmendment, readDay, readDayLogAsk } from "./amend"
import { checkCitations, composeNarrative, windowLedger, windowsOf } from "./compose"
import { gatherDay, untrackedRuns } from "./gather"
import { codeBrief, DAY_LOG_FOLDER, dayLogTitle, renderDayLog } from "./render"
import type { DaySources } from "./types"

const DATE = "2026-11-23"

function day(over: Partial<DaySources> = {}): DaySources {
  return {
    date: DATE,
    scopes: [
      { id: "activity", name: "Activity", pens: [{ id: "act-work", name: "Work", variants: [{ id: "v-b2", name: "Brain2" }] }, { id: "act-walk", name: "Walking" }] },
      { id: "location", name: "Location", pens: [{ id: "loc-home", name: "Home" }, { id: "loc-park", name: "Park" }] },
      { id: "company", name: "Company", pens: [{ id: "co-sam", name: "Sam" }] },
      { id: "mood", name: "Mood", pens: [{ id: "mood-good", name: "Good" }] },
      { id: "iphone-calls", name: "iPhone Calls", pens: [{ id: "call-mom", name: "Mom" }] },
      { id: "iphone-texts", name: "iPhone Texts", pens: [{ id: "text-sam", name: "Sam" }] },
      { id: "screentime", name: "Screen Time", pens: [{ id: "st-cursor", name: "Cursor" }] },
      { id: "intake", name: "Intake", pens: [{ id: "in-lunch", name: "Lunch" }] },
    ],
    entries: [
      { id: "e1", date: DATE, scopeId: "activity", penId: "act-work", variantIds: ["v-b2"], startMin: 9 * 60 + 10, endMin: 11 * 60 + 40, notes: "deep in the day log idea" },
      { id: "e2", date: DATE, scopeId: "location", penId: "loc-home", startMin: 0, endMin: 17 * 60, generatedBy: { kind: "phone-sync", id: "visit:1" } },
      { id: "e3", date: DATE, scopeId: "iphone-calls", penId: "call-mom", startMin: 14 * 60, endMin: 14 * 60 + 12, title: "← call", generatedBy: { kind: "phone-sync", id: "calls:1" } },
      { id: "e4", date: DATE, scopeId: "iphone-texts", penId: "text-sam", kind: "instant", startMin: 16 * 60 + 2, endMin: 16 * 60 + 2, title: "→ park at 6?", generatedBy: { kind: "phone-sync", id: "messages:1" } },
      { id: "e5", date: DATE, scopeId: "iphone-texts", penId: "text-sam", kind: "instant", startMin: 16 * 60 + 5, endMin: 16 * 60 + 5, title: "← yes!!", generatedBy: { kind: "phone-sync", id: "messages:2" } },
      { id: "e6", date: DATE, scopeId: "activity", penId: "act-walk", startMin: 18 * 60, endMin: 18 * 60 + 45 },
      { id: "e7", date: DATE, scopeId: "location", penId: "loc-park", startMin: 18 * 60 + 5, endMin: 18 * 60 + 40, generatedBy: { kind: "phone-sync", id: "visit:2" } },
      { id: "e8", date: DATE, scopeId: "company", penId: "co-sam", startMin: 18 * 60, endMin: 18 * 60 + 45 },
      { id: "e9", date: DATE, scopeId: "mood", penId: "mood-good", kind: "instant", startMin: 19 * 60, endMin: 19 * 60 },
      { id: "e10", date: DATE, scopeId: "screentime", penId: "st-cursor", startMin: 9 * 60 + 15, endMin: 10 * 60 + 30, generatedBy: { kind: "screentime", id: DATE } },
      { id: "e11", date: DATE, scopeId: "intake", penId: "in-lunch", kind: "instant", intakeClass: "food", startMin: 12 * 60 + 30, endMin: 12 * 60 + 30, title: "ravioli" },
      { id: "secret", date: DATE, scopeId: "activity", penId: "act-work", startMin: 20 * 60, endMin: 21 * 60, secret: true },
      { id: "other", date: "2026-11-22", scopeId: "activity", penId: "act-work", startMin: 60, endMin: 120 },
    ],
    plateKcal: { e11: 640 },
    dayNote: "felt clear-headed most of the day",
    sleep: { woke: { sleptMin: -60, wokeMin: 8 * 60 + 5 }, tonight: { sleptMin: -30 } },
    health: { steps: 8412, distanceM: 5200, activeKcal: 410, heartAvg: 78, heartMin: 52, heartMax: 141 },
    bim: [
      { at: new Date(2026, 10, 23, 13, 1).toISOString(), who: "you", text: "had ravioli for lunch" },
      { at: new Date(2026, 10, 23, 13, 1).toISOString(), who: "bim", text: "Logged" },
    ],
    telegram: [
      { at: new Date(2026, 10, 23, 13, 2).toISOString(), text: "had ravioli for lunch" },
      { at: new Date(2026, 10, 23, 21, 15).toISOString(), text: "tired but good day" },
    ],
    logs: [],
    docs: [{ id: "d1", title: "Day log plan", at: new Date(2026, 10, 23, 10, 0).toISOString(), created: true, text: "every source, one doc" }],
    done: [{ at: new Date(2026, 10, 23, 11, 45).toISOString(), title: "Sketch the ledger" }],
    events: [{ title: "Dentist", time: "15:30" }],
    plans: [],
    photos: 2,
    amendments: [],
    ...over,
  }
}

describe("gatherDay", () => {
  it("reads every source into one ledger in clock order, untimed rows last", () => {
    const ev = gatherDay(day())
    expect(ev.map((e) => e.n)).toEqual(ev.map((_, i) => i + 1))
    const timed = ev.filter((e) => e.startMin !== null).map((e) => e.startMin!)
    expect(timed).toEqual([...timed].sort((a, b) => a - b))
    const firstUntimed = ev.findIndex((e) => e.startMin === null)
    expect(ev.slice(firstUntimed).every((e) => e.startMin === null)).toBe(true)
    const sources = new Set(ev.map((e) => e.source))
    for (const s of ["activity", "place", "company", "mood", "call", "text", "screen-mac", "food", "sleep", "health", "bim", "telegram", "day-note", "doc", "done", "event", "photo"]) expect(sources).toContain(s)
  })

  it("keeps secret rows and other days out", () => {
    const ev = gatherDay(day())
    expect(ev.some((e) => e.startMin === 20 * 60)).toBe(false)
    expect(ev.some((e) => e.startMin === 60)).toBe(false)
  })

  it("words each kind and keeps own words verbatim", () => {
    const ev = gatherDay(day())
    expect(ev.find((e) => e.source === "activity" && e.startMin === 550)).toMatchObject({ what: "Work (Brain2)", ownWords: "deep in the day log idea", endMin: 700 })
    expect(ev.find((e) => e.source === "call")).toMatchObject({ what: "Incoming call · Mom", endMin: 852, person: "Mom", machine: true })
    expect(ev.filter((e) => e.source === "text").map((e) => e.dir)).toEqual(["out", "in"])
    expect(ev.find((e) => e.source === "food")?.what).toBe("Lunch · ravioli · 640 kcal")
    expect(ev.find((e) => e.source === "sleep" && e.what.startsWith("Woke"))?.what).toBe("Woke up after 9 h 5 min of sleep")
    expect(ev.find((e) => e.what === "Went to sleep")?.startMin).toBe(1410)
  })

  it("does not count a service short code as a person", () => {
    const ev = gatherDay(day({ entries: [{ id: "otp", date: DATE, scopeId: "iphone-texts", penId: "65161", kind: "instant", startMin: 333, endMin: 333, title: "← 569261 is your code" }] }))
    const otp = ev.find((e) => e.source === "text")
    expect(otp?.person).toBeUndefined()
    expect(otp?.what).toBe("Text from 65161 (a service): “569261 is your code”")
  })

  it("does not count a Telegram message twice when BIM chat has the same words", () => {
    const tg = gatherDay(day()).filter((e) => e.source === "telegram")
    expect(tg.map((e) => e.ownWords)).toEqual(["tired but good day"])
  })

  it("places an amendment with a clock at that minute", () => {
    const a = makeAmendment(DATE, "the call with mom was at 3pm, not 2", "docs", new Date(2026, 10, 24, 9))
    const ev = gatherDay(day({ amendments: [a] }))
    expect(ev.find((e) => e.source === "amendment")).toMatchObject({ startMin: 900, what: "My correction" })
  })

  it("finds untracked stretches of 30 minutes or more", () => {
    const runs = untrackedRuns(gatherDay(day()))
    expect(runs[0]).toEqual([0, 550])
    expect(runs).toContainEqual([700, 1080])
  })
})

describe("windows", () => {
  it("folds texts per person and screen time per app", () => {
    const ev = gatherDay(day())
    const lines = windowLedger(ev.filter((e) => e.startMin !== null && e.startMin >= 720 && e.startMin < 1020))
    expect(lines.some((l) => /Texts with Sam: 1 sent, 1 received/.test(l))).toBe(true)
    const morning = windowLedger(ev.filter((e) => e.startMin !== null && e.startMin >= 360 && e.startMin < 720))
    expect(morning.some((l) => /Screen time in this stretch: Cursor on Mac 75 min/.test(l))).toBe(true)
  })

  it("splits a long part so each window fits one call", () => {
    const many = Array.from({ length: 300 }, (_, i) => ({ id: `t${i}`, date: DATE, scopeId: "activity", penId: "act-work", kind: "instant", startMin: 600 + (i % 100), endMin: 600 + (i % 100), notes: "x".repeat(60) }))
    const ws = windowsOf(gatherDay(day({ entries: many })))
    expect(ws.length).toBeGreaterThan(1)
    for (const w of ws) expect(w.lines.join("\n").length).toBeLessThanOrEqual(6000)
    expect(ws.reduce((s, w) => s + w.rows.filter((r) => r.source === "activity").length, 0)).toBe(300)
  })

  it("drops citations to rows that do not exist", () => {
    expect(checkCitations("I walked [E3, E99]. Then slept [E400].", new Set([3]))).toBe("I walked [E3]. Then slept.")
  })
})

describe("composeNarrative", () => {
  it("writes each window, then the brief, feelings and questions", async () => {
    const calls: string[] = []
    const fake = async (req: { system: string; user: string }) => {
      calls.push(req.user)
      if (req.system.startsWith("You finish")) return { brief: "A working day, then a walk with Sam [E1, E999].", feelings: "Good [E2].", questions: ["Where were you from 11:40 to 18:00?"] }
      return { text: "I worked [E1]." }
    }
    const n = await composeNarrative(DATE, gatherDay(day()), fake)
    expect(n?.windows.length).toBeGreaterThan(1)
    expect(n?.brief).toBe("A working day, then a walk with Sam [E1].")
    expect(n?.questions).toHaveLength(1)
    expect(calls.at(-1)).toContain("Untimed facts")
  })

  it("leaves How I felt empty when the model only says nothing is known", async () => {
    const fake = async (req: { system: string }) =>
      req.system.startsWith("You finish") ? { brief: "A day.", feelings: "The mood rows do not specify any feelings, so there is no information on how I felt.", questions: [] } : { text: "I worked [E1]." }
    const n = await composeNarrative(DATE, gatherDay(day()), fake)
    expect(n?.feelings).toBe("")
  })

  it("is null when every call fails, and the doc still renders", async () => {
    const n = await composeNarrative(DATE, gatherDay(day()), async () => {
      throw new Error("down")
    })
    expect(n).toBeNull()
  })
})

describe("renderDayLog", () => {
  it("has the fourteen sections in order, own words marked, and the ledger", () => {
    const ev = gatherDay(day())
    const html = renderDayLog({ date: DATE, evidence: ev, narrative: null, amendments: [], builtAt: new Date(2026, 10, 24, 4, 10), version: 1, untilMin: 1440 })
    const heads = [...html.matchAll(/<h2>(\d+)\./g)].map((m) => Number(m[1]))
    expect(heads).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14])
    expect(html).toContain("<h1>DAY LOG · Monday, November 23, 2026</h1>")
    expect(html).toContain("❝deep in the day log idea❞")
    expect(html).toContain("<blockquote>")
    expect(html).toContain("8,412 steps")
    expect(html).toContain("640 kcal")
    expect(html).toContain("Calls: <strong>1</strong>")
    expect(html).not.toMatch(/<table|<script/)
  })

  it("has a code brief when no model wrote one", () => {
    expect(codeBrief(gatherDay(day()))).toMatch(/^The first thing on record is at 00:00/)
  })

  it("names the doc by a sortable standard title", () => {
    expect(dayLogTitle(DATE)).toBe("DAY LOG · 2026-11-23 · Monday")
    expect(DAY_LOG_FOLDER).toBe("LOG DOCS/DAY LOGS")
  })
})

describe("reading BIM chat lines", () => {
  const now = new Date(2026, 10, 24, 10) // Tuesday

  it("reads days in words", () => {
    expect(readDay("yesterday's", now)).toBe("2026-11-23")
    expect(readDay("monday", now)).toBe("2026-11-23")
    expect(readDay("last tuesday", now)).toBe("2026-11-17")
    expect(readDay("3 days ago", now)).toBe("2026-11-21")
    expect(readDay("nov 20", now)).toBe("2026-11-20")
    expect(readDay("11/20", now)).toBe("2026-11-20")
    expect(readDay("2026-10-02", now)).toBe("2026-10-02")
  })

  it("tells a build from an amendment", () => {
    expect(readDayLogAsk("day log", now)).toEqual({ kind: "build", date: "2026-11-24" })
    expect(readDayLogAsk("make yesterday's masterlog", now)).toEqual({ kind: "build", date: "2026-11-23" })
    expect(readDayLogAsk("build my day log for monday", now)).toEqual({ kind: "build", date: "2026-11-23" })
    expect(readDayLogAsk("day log yesterday: the call with mom was at 3", now)).toEqual({ kind: "amend", date: "2026-11-23", text: "the call with mom was at 3" })
    expect(readDayLogAsk("amend today's day log: add walked 20 min at 8am", now)).toEqual({ kind: "amend", date: "2026-11-24", text: "add walked 20 min at 8am" })
  })

  it("leaves other lines alone", () => {
    expect(readDayLogAsk("what did I log today?", now)).toBeNull()
    expect(readDayLogAsk("log: walked the dog", now)).toBeNull()
    expect(readDayLogAsk("can you make my day log?", now)).toBeNull()
    expect(readDayLogAsk("my log of the day was weird", now)).toBeNull()
  })

  it("sorts amendments", () => {
    expect(amendmentKind("no, it was at 3")).toBe("correction")
    expect(amendmentKind("add: walked to the park")).toBe("addition")
    expect(amendmentKind("i was anxious all morning")).toBe("note")
  })
})

describe("autoPlan", () => {
  it("refreshes today, finishes yesterday after 4 am, backfills two missing days", () => {
    const now = new Date(2026, 10, 24, 9)
    const plan = autoPlan(now, [{ id: "2026-11-23", builtAt: new Date(2026, 10, 23, 22).toISOString(), narrated: true }], () => true, true)
    expect(plan).toEqual([
      { date: "2026-11-24", llm: false },
      { date: "2026-11-23", llm: true },
      { date: "2026-11-22", llm: true },
      { date: "2026-11-21", llm: true },
    ])
  })

  it("leaves a finished yesterday alone and treats 2 am as the night before", () => {
    const now = new Date(2026, 10, 24, 2)
    const plan = autoPlan(now, [{ id: "2026-11-22", builtAt: new Date(2026, 10, 23, 5).toISOString(), narrated: true }], (d) => d >= "2026-11-22", true)
    expect(plan).toEqual([{ date: "2026-11-23", llm: false }])
  })
})
