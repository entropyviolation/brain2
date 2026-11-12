import { describe, expect, it } from "vitest"
import type { Visit } from "@/lib/browser-history"
import type { TextRow } from "@/lib/bim-flow/texts"
import type { HistoryEntry } from "@/lib/bim-flow/vault-search"
import { buildEvidence } from "./evidence"
import { parseReport } from "./parse"
import { buildPlan, type PlanDeps } from "./plan"
import { fmtDateTime } from "./time"
import { fieldValue } from "./types"

const MSG =
  "started my period today. 4 hours ago stopped working on baby animal game after working on it for a while, and before that mostly watching youtube videos and scrolling. had a coffee earlier and also took 1 adderall (both at the very beginning of working on baby animal game), only 3 adderall left now. I was pretty much just scrolling and watching youtube since i woke up at 1:30 am after falling asleep at around 8 or something yesterday (check when my last sent text was or whatever im not exactly sure about this time but yeah definitely woke up at 1:30 i think)"

// Saturday 7 Nov 2026, 13:36. Game stopped 09:36. Woke 01:30. Fell asleep ~20:00 on the 6th.
const now = new Date(2026, 10, 7, 13, 36)
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).getTime()
const visit = (t: number, host: string, title = ""): Visit => ({ t, url: `https://${host}/`, host, title, transition: "link", profile: "Chrome" })
const text = (t: number, dir: "in" | "out"): TextRow => ({ at: new Date(t).toISOString(), dir, who: "Sam", thread: "t", group: false, text: "hi" })
const mac = (date: string, pen: string, startMin: number, endMin: number): HistoryEntry => ({ date, scope: "screentime", pen, startMin, endMin, text: "", confirmed: false, source: "screentime" })

function deps(over: Partial<PlanDeps> = {}, ev = true): PlanDeps {
  const visits = [
    ...[1 * 60 + 35, 2 * 60 + 10, 3 * 60 + 40, 5 * 60, 6 * 60 + 30].map((m) => visit(at(7, 0, m), "www.youtube.com", "A video")),
    visit(at(7, 7, 15), "localhost:3000", "Baby animal game"),
    visit(at(7, 8, 30), "localhost:3000", "Baby animal game"),
  ]
  return {
    inventory: (name) => (name === "adderall" ? { name: "Adderall", qty: 4 } : null),
    lastTrackedEnd: () => null,
    matchPen: () => null,
    visits,
    existingSleep: () => null,
    evidence: ev
      ? buildEvidence({
          visits,
          entries: [mac("2026-11-07", "Cursor", 7 * 60 + 10, 9 * 60 + 30), mac("2026-11-07", "Google Chrome", 1 * 60 + 40, 6 * 60 + 50)],
          texts: [text(at(6, 19, 40), "out"), text(at(7, 3, 0), "in"), text(at(7, 10, 0), "out")],
          files: [],
          feed: [],
          logs: [],
          items: [],
        })
      : null,
    ...over,
  }
}

describe("parseReport on the night message", () => {
  it("reads the ended-ago block, the anchors, the wake and the bedtime", () => {
    const p = parseReport(MSG)
    expect(p.segments.map((s) => [s.label, s.endedAgoMin ?? null, s.sinceWake ?? false])).toEqual([
      ["Baby animal game", 240, false],
      ["Watching YouTube videos and scrolling", null, true],
    ])
    expect(p.doses[0]!.anchor?.label).toBe("baby animal game")
    expect(p.drinks[0]!.anchor?.label).toBe("baby animal game")
    expect(p.wake).toMatchObject({ minute: 90, ampm: true, sure: true })
    expect(p.bed).toMatchObject({ minute: 480, ampm: false, earlierDay: true })
    expect(parseReport("stopped working on the app 90 minutes ago").segments[0]).toMatchObject({ label: "The app", endedAgoMin: 90 })
  })
})

describe("a night, a game, and a scroll", () => {
  it("places sleep, both blocks, and ties the dose and coffee to the game's start", () => {
    const plan = buildPlan(MSG, parseReport(MSG), now, deps())
    expect(plan.effects.map((e) => e.kind)).toEqual(["cycle", "sleep", "inventory", "intake", "intake", "timeblock", "timeblock"])
    const sleep = plan.effects.find((e) => e.kind === "sleep")!
    expect(fieldValue(sleep, "bed")).toBe(fmtDateTime(at(6, 20), true))
    expect(fieldValue(sleep, "wake")).toBe(fmtDateTime(at(7, 1, 30), true))
    expect(fieldValue(sleep, "wakeSure")).toBe("definite")
    const [game, tube] = plan.effects.filter((e) => e.kind === "timeblock")
    expect(fieldValue(game!, "end")).toBe(fmtDateTime(at(7, 9, 36), true))
    expect(fieldValue(game!, "start")).toBe(fmtDateTime(at(7, 7, 10), true))
    expect(fieldValue(tube!, "start")).toBe(fmtDateTime(at(7, 1, 30), true))
    expect(fieldValue(tube!, "end")).toBe(fieldValue(game!, "start"))
    const intakes = plan.effects.filter((e) => e.kind === "intake")
    for (const i of intakes) expect(fieldValue(i, "at")).toBe(fmtDateTime(at(7, 7, 10), true))
    expect(fieldValue(plan.effects.find((e) => e.kind === "inventory")!, "qty")).toBe("3")
    expect(game!.reasoning.join(" ")).toMatch(/Signs of life moved the start/)
  })

  it("moves the bedtime later when a sign of life shows you up after it", () => {
    const d = deps()
    const withLate = buildEvidence({ visits: null, entries: [mac("2026-11-06", "Google Chrome", 21 * 60, 22 * 60 + 15)], texts: [], files: [], feed: [], logs: [], items: [] })
    const plan = buildPlan(MSG, parseReport(MSG), now, { ...d, evidence: withLate })
    const sleep = plan.effects.find((e) => e.kind === "sleep")!
    expect(fieldValue(sleep, "bed")).toBe(fmtDateTime(at(6, 22, 25), true))
    expect(sleep.reasoning.join(" ")).toMatch(/you were up then/)
  })

  it("still works with no evidence at all and says the start is unknown", () => {
    const plan = buildPlan(MSG, parseReport(MSG), now, deps({ evidence: null, visits: null }, false))
    const game = plan.effects.filter((e) => e.kind === "timeblock")[0]!
    expect(game.title).toMatch(/start unknown/)
    expect(fieldValue(game, "start")).toBe(fmtDateTime(at(7, 6, 36), true))
    const sleep = plan.effects.find((e) => e.kind === "sleep")!
    expect(fieldValue(sleep, "bed")).toBe(fmtDateTime(at(6, 20), true))
    expect(sleep.reasoning.join(" ")).toMatch(/Nothing in the data contradicts/)
  })
})
