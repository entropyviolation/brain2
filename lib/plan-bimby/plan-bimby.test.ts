import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { detectFlight, detectIntake, matchTasks, withLinks } from "./links"
import { cleanPlan, parseByRules, parsePlan, PLAN_EXAMPLE } from "./parse"
import { complete, elapsedMs, formatClock, isFinished, nextOpen, pause, play, reopen, skip, startRun } from "./run"
import type { PlanItem } from "./types"

const item = (title: string, extra: Partial<PlanItem> = {}): PlanItem => ({ id: title, title, subtasks: [], pace: "steady", ...extra })
const task = (id: string, title: string, completed = false): Task => ({ id, description: title, title, completed } as Task)
const t = (iso: string) => new Date(iso)

describe("detectIntake", () => {
  it("reads coffee and adderall from the sample plan", () => {
    expect(detectIntake("make more coffee")).toMatchObject({ label: "coffee", intakeClass: "drink" })
    expect(detectIntake("take another adderall")).toMatchObject({ label: "adderall", intakeClass: "drug" })
  })
  it("needs a taking verb and ignores other work", () => {
    expect(detectIntake("clean the coffee machine")).toBeNull()
    expect(detectIntake("activate new amex")).toBeNull()
    expect(detectIntake("finish cds")).toBeNull()
  })
})

describe("detectFlight", () => {
  it("wants the verb and the word", () => {
    expect(detectFlight("book ny flights")).toBe(true)
    expect(detectFlight("flight attendant notes")).toBe(false)
  })
})

describe("matchTasks", () => {
  const tasks = [task("a", "Finish CDs for release"), task("b", "Clean garage"), task("c", "Finish CDs", true)]
  it("matches the plan item to an open task and leaves finished ones out", () => {
    const hits = matchTasks(item("finish cds"), tasks)
    expect(hits[0]?.taskId).toBe("a")
    expect(hits.map((h) => h.taskId)).not.toContain("c")
  })
  it("does not link on one shared word out of two", () => {
    expect(matchTasks(item("clean space"), [task("p", "The Poetics of Space")])).toEqual([])
  })
  it("offers nothing for an unrelated item", () => {
    expect(matchTasks(item("activate new amex"), tasks)).toEqual([])
  })
})

describe("withLinks", () => {
  it("links intake, flight and an unconfirmed task match", () => {
    const out = withLinks([item("make more coffee"), item("book ny flights"), item("finish cds")], [task("a", "Finish CDs")])
    expect(out[0]!.link?.kind).toBe("intake")
    expect(out[1]!.link?.kind).toBe("flight")
    expect(out[2]!.link).toMatchObject({ kind: "task", taskId: "a", confirmed: false })
  })
  it("keeps a link the model or person already set", () => {
    const set = item("make more coffee", { link: { kind: "flight" } })
    expect(withLinks([set], [])[0]!.link?.kind).toBe("flight")
  })
})

describe("parseByRules", () => {
  it("splits the sample on commas and then, with pace and minutes", () => {
    const { items } = parseByRules(PLAN_EXAMPLE.text)
    const titles = items.map((i) => i.title.toLowerCase())
    expect(titles[0]).toBe("make more coffee")
    expect(titles).toContain("take another adderall")
    const flights = items.find((i) => /flights/i.test(i.title))!
    expect(flights.pace).toBe("urgent")
    expect(items.find((i) => /clean space/i.test(i.title))?.minutes).toBe(15)
  })
  it("keeps a feeling as a remark, not a task", () => {
    expect(parseByRules("make coffee, I'm super happy with this").remarks).toHaveLength(1)
  })
})

describe("cleanPlan", () => {
  it("drops empty rows and bad paces", () => {
    const out = cleanPlan({ items: [{ title: " " }, { title: "finish cds", pace: "frantic", minutes: 0, subtasks: [{ title: "chaos", due: "by 8am" }, { title: "" }] }], remarks: [" ok "] })
    expect(out.items).toHaveLength(1)
    expect(out.items[0]).toMatchObject({ title: "finish cds", pace: "steady" })
    expect(out.items[0]!.subtasks.map((s) => s.due)).toEqual(["by 8am"])
    expect(out.remarks).toEqual(["ok"])
  })
})

describe("parsePlan", () => {
  it("uses the model's answer and links it", async () => {
    const call = async () => JSON.parse(PLAN_EXAMPLE.json)
    const draft = await parsePlan({ text: PLAN_EXAMPLE.text, call, ladder: ["m1"], tasks: [task("cd", "Finish CDs")] })
    expect(draft.by).toBe("model")
    expect(draft.items.map((i) => i.link?.kind)).toEqual(["intake", "intake", "flight", undefined, "task", undefined])
    const cds = draft.items[4]!
    expect(cds.subtasks.map((s) => s.due)).toEqual(["by 8am", "by 9am (10 latest)"])
    expect(cds.pace).toBe("urgent")
  })
  it("falls back to rules when the model finds nothing or is absent", async () => {
    const empty = await parsePlan({ text: "make coffee, book flights", call: async () => ({ items: [], remarks: [] }), ladder: ["m1"], tasks: [] })
    expect(empty.by).toBe("rules")
    expect(empty.items).toHaveLength(2)
    const none = await parsePlan({ text: "make coffee", call: null, ladder: [], tasks: [] })
    expect(none.fallback).toBe("no model reachable")
  })
})

describe("run clock", () => {
  const start = () => startRun([item("a"), item("b"), item("c")], [], "x", t("2026-11-02T07:00:00"))

  it("plays one at a time and returns the closed span", () => {
    const r1 = play(start(), "a", t("2026-11-02T07:00:00")).run
    const step = play(r1, "b", t("2026-11-02T07:10:00"))
    expect(step.spans).toEqual([{ itemId: "a", startedAt: t("2026-11-02T07:00:00").toISOString(), endedAt: t("2026-11-02T07:10:00").toISOString() }])
    expect(step.run.items.map((i) => i.state)).toEqual(["paused", "running", "todo"])
    expect(elapsedMs(step.run.items[0]!, t("2026-11-02T09:00:00"))).toBe(600_000)
    expect(elapsedMs(step.run.items[1]!, t("2026-11-02T07:15:00"))).toBe(300_000)
  })

  it("pause then done keeps one total and flags the finished item once", () => {
    const r1 = play(start(), "a", t("2026-11-02T07:00:00")).run
    const r2 = pause(r1, "a", t("2026-11-02T07:05:00")).run
    const r3 = play(r2, "a", t("2026-11-02T07:10:00")).run
    const done = complete(r3, "a", t("2026-11-02T07:20:00"))
    expect(done.spans).toHaveLength(1)
    expect(done.finished?.accumMs).toBe(15 * 60_000)
    expect(complete(done.run, "a", t("2026-11-02T07:30:00")).finished).toBeUndefined()
  })

  it("done without play has no time; skip, reopen and finish work", () => {
    let run = complete(start(), "a", t("2026-11-02T07:00:00")).run
    expect(run.items[0]!.accumMs).toBe(0)
    expect(nextOpen(run, "a")?.id).toBe("b")
    run = skip(run, "b", t("2026-11-02T07:01:00")).run
    run = complete(run, "c", t("2026-11-02T07:02:00")).run
    expect(isFinished(run)).toBe(true)
    expect(reopen(run, "b").items[1]!.state).toBe("paused")
  })

  it("formats a clock", () => {
    expect(formatClock(65_000)).toBe("1:05")
    expect(formatClock(3_725_000)).toBe("1:02:05")
  })
})

describe("plan chat modes", () => {
  it("has one built mode first, and the rest are planned", async () => {
    const { PLAN_CHAT_MODES, modeById } = await import("./modes")
    expect(PLAN_CHAT_MODES[0]).toMatchObject({ id: "short-term", ready: true })
    expect(PLAN_CHAT_MODES.filter((m) => m.ready)).toHaveLength(1)
    expect(new Set(PLAN_CHAT_MODES.map((m) => m.id)).size).toBe(PLAN_CHAT_MODES.length)
    expect(modeById("week").ready).toBe(false)
  })
})
