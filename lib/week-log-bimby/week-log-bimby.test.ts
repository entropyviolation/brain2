import { describe, expect, it } from "vitest"
import type { DaySources } from "@/lib/day-log-bimby/types"
import { gatherDay } from "@/lib/day-log-bimby/gather"
import { composeWeek, dayBlock } from "./compose"
import { codeWeekBrief, renderWeekLog } from "./render"
import { autoWeekPlan } from "./schedule"
import { emptyDay, stripCitations, summarizeDay } from "./summarize"
import { isoWeek, readWeek, readWeekLogAsk, weekDays, weekLogStartOf, weekLogTitle, weekRangeLabel, weekStartKey } from "./week"

const MON = "2026-11-23"
const NOW = new Date(2026, 10, 25, 15, 0) // Wednesday

function day(date: string, over: Partial<DaySources> = {}): DaySources {
  return {
    date,
    scopes: [
      { id: "activity", name: "Activity", pens: [{ id: "act-work", name: "Work" }, { id: "act-walk", name: "Walking" }] },
      { id: "location", name: "Location", pens: [{ id: "loc-home", name: "Home" }, { id: "loc-park", name: "Park" }] },
      { id: "company", name: "Company", pens: [{ id: "co-mm", name: "Marilyn Monroe" }] },
      { id: "mood", name: "Mood", pens: [{ id: "mood-good", name: "Good" }] },
    ],
    entries: [
      { id: `${date}-1`, date, scopeId: "activity", penId: "act-work", startMin: 540, endMin: 720 },
      { id: `${date}-2`, date, scopeId: "location", penId: "loc-home", startMin: 0, endMin: 1020, generatedBy: { kind: "phone-sync", id: "v1" } },
      { id: `${date}-3`, date, scopeId: "activity", penId: "act-walk", startMin: 1080, endMin: 1125 },
      { id: `${date}-4`, date, scopeId: "location", penId: "loc-park", startMin: 1085, endMin: 1120, generatedBy: { kind: "phone-sync", id: "v2" } },
      { id: `${date}-5`, date, scopeId: "company", penId: "co-mm", startMin: 1080, endMin: 1125 },
      { id: `${date}-6`, date, scopeId: "mood", penId: "mood-good", kind: "instant", startMin: 1140, endMin: 1140 },
    ],
    sleep: { woke: { sleptMin: -60, wokeMin: 480 } },
    health: { steps: 8000 },
    bim: [],
    telegram: [{ at: new Date(2026, 10, 23, 21, 15).toISOString(), text: "tired but a good day, the park walk helped" }],
    logs: [],
    docs: [],
    done: [{ at: new Date(2026, 10, 23, 11, 45).toISOString(), title: "Sketch the week log" }],
    events: [],
    plans: [],
    amendments: [],
    ...over,
  }
}

describe("weeks", () => {
  it("keys a week by its Monday and titles it with the ISO week", () => {
    expect(weekStartKey("2026-11-29")).toBe(MON)
    expect(weekStartKey(MON)).toBe(MON)
    expect(weekDays(MON)).toEqual(["2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27", "2026-11-28", "2026-11-29"])
    expect(isoWeek(MON)).toBe("2026-W48")
    expect(isoWeek("2025-12-29")).toBe("2026-W01")
    expect(weekLogTitle(MON)).toBe("WEEK LOG · 2026-W48 · Nov 23–29")
    expect(weekRangeLabel("2026-11-30")).toBe("Nov 30–Dec 6")
    expect(weekLogStartOf({ id: "doc_weeklog_2026-11-23" })).toBe(MON)
    expect(weekLogStartOf({ id: "x", attributes: { weekLogStart: "2026-11-16" } })).toBe("2026-11-16")
    expect(weekLogStartOf({ id: "doc_daylog_2026-11-23" })).toBeNull()
  })

  it("reads a week out of words", () => {
    expect(readWeek("this week", NOW)).toBe(MON)
    expect(readWeek("last week's", NOW)).toBe("2026-11-16")
    expect(readWeek("2 weeks ago", NOW)).toBe("2026-11-09")
    expect(readWeek("week of nov 4", NOW)).toBe("2026-11-02")
  })

  it("reads chat lines for the Week Log BIMBY and leaves Day Log lines alone", () => {
    expect(readWeekLogAsk("week log", NOW)).toEqual({ kind: "build", start: MON })
    expect(readWeekLogAsk("make last week's week log", NOW)).toEqual({ kind: "build", start: "2026-11-16" })
    expect(readWeekLogAsk("week log: Tuesday I was home sick all day", NOW)).toEqual({ kind: "amend", start: MON, text: "Tuesday I was home sick all day" })
    expect(readWeekLogAsk("last week's week log: the move took all of it", NOW)).toEqual({ kind: "amend", start: "2026-11-16", text: "the move took all of it" })
    expect(readWeekLogAsk("day log", NOW)).toBeNull()
    expect(readWeekLogAsk("I went for a walk", NOW)).toBeNull()
  })
})

describe("summarizeDay", () => {
  it("folds a day's ledger into what a week needs", () => {
    const s = summarizeDay(MON, gatherDay(day(MON)), { windows: [], brief: "Worked all morning [E3] then walked [E7, E8].", feelings: "", questions: [] })
    expect(s.brief).toBe("Worked all morning then walked.")
    expect(s.narrated).toBe(true)
    expect(s.activities[0]).toEqual(["Work", 180])
    expect(s.places).toEqual(["Home", "Park"])
    expect(s.people[0]!.name).toBe("Marilyn Monroe")
    expect(s.people[0]!.togetherMin).toBe(45)
    expect(s.woke).toBe("08:00")
    expect(s.steps).toBe(8000)
    expect(s.moods[0]).toMatch(/^Good at 19:00/)
    expect(s.done).toEqual(["Finished “Sketch the week log”"])
    expect(s.words.some((w) => w.text.includes("park walk helped"))).toBe(true)
  })

  it("strips day citations", () => {
    expect(stripCitations("Walked [E3, E4]. Slept [E9].")).toBe("Walked. Slept.")
  })
})

function week() {
  return weekDays(MON).map((d) => (d > "2026-11-25" ? emptyDay(d, true) : d === "2026-11-24" ? emptyDay(d, false) : summarizeDay(d, gatherDay(day(d)), null)))
}

describe("renderWeekLog", () => {
  it("writes every section with exact totals, with or without a model", () => {
    const html = renderWeekLog({ start: MON, days: week(), narrative: null, amendments: [], builtAt: NOW, version: 1 })
    for (const h of ["1. The week in brief", "2. At a glance", "3. Day by day", "4. Where the time went", "5. Where I was", "6. Who I was with", "7. Screens", "8. Body", "9. How I felt", "10. In my own words", "11. Plans and what got done", "12. What I wrote", "13. Gaps and open questions", "14. Amendments"]) expect(html).toContain(h)
    expect(html).toContain("WEEK LOG · 2026-W48 · Nov 23–29")
    expect(html).toContain("Days on record: <strong>2</strong> of 7")
    expect(html).toContain("<strong>Work</strong> · 6 h")
    expect(html).toContain("Tue Nov 24 · nothing on record")
    expect(html).toContain("Not yet.")
    expect(html).not.toMatch(/Merriweather/)
  })

  it("has a code brief when the model is off", () => {
    expect(codeWeekBrief(week())).toMatch(/^2 of 7 days have something on record/)
  })
})

describe("composeWeek", () => {
  it("asks once with every day and keeps amendments first", async () => {
    let seen = ""
    const n = await composeWeek(MON, week(), [{ id: "a", date: MON, at: NOW.toISOString(), text: "Tuesday I was home sick", kind: "note", via: "docs" }], async (req) => {
      seen = req.user
      return { brief: "A quiet week.", feelings: "No information about feelings.", questions: ["What happened Tuesday?"] }
    })
    expect(seen).toContain("Amendments (these win)")
    expect(seen).toContain("Tue Nov 24: nothing recorded.")
    expect(seen).toContain("Thu Nov 26: not yet.")
    expect(n).toEqual({ brief: "A quiet week.", feelings: "", questions: ["What happened Tuesday?"] })
    expect(dayBlock(week()[0]!).length).toBeLessThanOrEqual(950)
  })

  it("returns null when the model fails", async () => {
    expect(await composeWeek(MON, week(), [], async () => Promise.reject(new Error("down")))).toBeNull()
  })
})

describe("autoWeekPlan", () => {
  const has = () => true
  it("refreshes this week with code and finishes last week with the model", () => {
    expect(autoWeekPlan(NOW, [], has, true)).toEqual([
      { start: MON, llm: false },
      { start: "2026-11-16", llm: true },
      { start: "2026-11-09", llm: true },
    ])
  })
  it("leaves a finished, narrated last week alone", () => {
    const recs = [
      { id: "2026-11-16", builtAt: new Date(2026, 10, 23, 5).toISOString(), narrated: true },
      { id: "2026-11-09", builtAt: new Date(2026, 10, 16, 5).toISOString(), narrated: true },
    ]
    expect(autoWeekPlan(NOW, recs, has, true).map((p) => p.start)).toEqual([MON, "2026-11-02"])
  })
  it("counts Monday before 04:00 as last week", () => {
    const early = new Date(2026, 10, 23, 2, 0)
    expect(autoWeekPlan(early, [], has, false)[0]).toEqual({ start: "2026-11-16", llm: false })
  })
})
