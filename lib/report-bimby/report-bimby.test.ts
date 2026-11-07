import { describe, expect, it } from "vitest"
import type { Visit } from "@/lib/browser-history"
import { looksLikeReport, parseReport } from "./parse"
import { buildPlan, type PlanDeps } from "./plan"
import { fmtDateTime } from "./time"
import { fieldValue } from "./types"

const MSG = "started my period today. have been working on baby animal game for a while, and before that mostly watching youtube videos and scrolling. had a coffee earlier and also took 1 adderall, only 3 left now."

describe("parseReport", () => {
  it("reads every part of the example message", () => {
    const p = parseReport(MSG)
    expect(p.period?.dayOffset).toBe(0)
    expect(p.doses).toMatchObject([{ name: "adderall", count: 1 }])
    expect(p.supply).toMatchObject([{ remaining: 3, name: "adderall" }])
    expect(p.drinks).toMatchObject([{ name: "coffee", earlier: true }])
    expect(p.segments.map((s) => [s.label, s.vague, s.before])).toEqual([
      ["Baby animal game", true, false],
      ["Watching YouTube videos and scrolling", false, true],
    ])
  })

  it("leaves plain log lines to the ladder", () => {
    for (const t of ["reading a book", "took out the trash", "took a nap", "had a coffee", "watching tv"]) expect(looksLikeReport(t)).toBe(false)
    expect(looksLikeReport("been watching youtube for 2 hours")).toBe(true)
    expect(looksLikeReport("took 2 ibuprofen")).toBe(true)
  })

  it("reads stated durations", () => {
    expect(parseReport("been coding for 90 minutes").segments[0]).toMatchObject({ minutes: 90, vague: false })
    expect(parseReport("was reading for 2 hours").segments[0]).toMatchObject({ minutes: 120 })
  })
})

const now = new Date(2026, 10, 7, 18, 0)
const at = (h: number, m = 0) => new Date(2026, 10, 7, h, m).getTime()
const visit = (t: number, host: string, title = ""): Visit => ({ t, url: `https://${host}/`, host, title, transition: "link", profile: "Chrome" })

const deps = (over: Partial<PlanDeps> = {}): PlanDeps => ({
  inventory: (name) => (name === "adderall" ? { name: "Adderall", qty: 5 } : null),
  lastTrackedEnd: () => at(11, 0),
  matchPen: () => null,
  visits: null,
  ...over,
})

describe("buildPlan", () => {
  it("makes inventory, cycle, intake, and two blocks from the example", () => {
    const plan = buildPlan(MSG, parseReport(MSG), now, deps())
    expect(plan.effects.map((e) => e.kind)).toEqual(["cycle", "inventory", "intake", "intake", "timeblock", "timeblock"])
    const inv = plan.effects.find((e) => e.kind === "inventory")!
    expect(fieldValue(inv, "qty")).toBe("3")
    expect(fieldValue(inv, "name")).toBe("Adderall")
    expect(inv.reasoning.join(" ")).toMatch(/Inventory said 5; minus this dose is 4/)
    const [game, tube] = plan.effects.filter((e) => e.kind === "timeblock")
    expect(fieldValue(game!, "end")).toBe(fmtDateTime(now.getTime(), true))
    expect(fieldValue(game!, "start")).toBe(fmtDateTime(at(15), true))
    expect(fieldValue(tube!, "end")).toBe(fieldValue(game!, "start"))
    expect(fieldValue(tube!, "start")).toBe(fmtDateTime(at(11), true))
    expect(plan.effects.every((e) => e.status === "pending")).toBe(true)
    expect(plan.trace.some((t) => /No Chrome history/.test(t))).toBe(true)
  })

  it("counts down when no supply is said", () => {
    const plan = buildPlan("took 1 adderall", parseReport("took 1 adderall"), now, deps())
    expect(fieldValue(plan.effects[0]!, "qty")).toBe("4")
  })

  it("lets Chrome move the switch and the assumed start", () => {
    const visits = [
      visit(at(12, 20), "youtube.com", "Video A"),
      visit(at(13, 0), "youtube.com", "Video B"),
      visit(at(14, 10), "youtube.com", "Video C"),
      visit(at(14, 30), "localhost:3000", "Baby animal game"),
      visit(at(16, 0), "localhost:3000", "Baby animal game"),
    ]
    const plan = buildPlan(MSG, parseReport(MSG), now, deps({ visits }))
    const [game, tube] = plan.effects.filter((e) => e.kind === "timeblock")
    // Videos run 12:20 to 14:10; the game's first page is 14:30. The switch lands between them.
    expect(fieldValue(tube!, "start")).toBe(fmtDateTime(at(12, 20), true))
    expect(fieldValue(tube!, "end")).toBe(fieldValue(game!, "start"))
    expect(fieldValue(game!, "start")).toBe(fmtDateTime(at(14, 20), true))
    expect(tube!.reasoning.join(" ")).toMatch(/Chrome moved the switch/)
    expect(tube!.evidence[0]).toMatch(/youtube\.com ×3/)
    expect(game!.evidence[0]).toMatch(/matching pages/)
  })

  it("says so when Chrome has nothing in the window", () => {
    const visits = [visit(at(9, 0), "youtube.com")]
    const plan = buildPlan(MSG, parseReport(MSG), now, deps({ visits }))
    const game = plan.effects.filter((e) => e.kind === "timeblock")[0]!
    expect(game.evidence[0]).toMatch(/no dev visits/)
    expect(game.evidence[0]).toMatch(/may not have synced/)
  })

  it("never starts a block before the last tracked activity ended", () => {
    const plan = buildPlan("been watching youtube for 10 hours", parseReport("been watching youtube for 10 hours"), now, deps())
    const block = plan.effects[0]!
    expect(fieldValue(block, "start")).toBe(fmtDateTime(at(11), true))
    expect(block.reasoning.join(" ")).toMatch(/Clamped/)
  })
})
