import { describe, expect, it } from "vitest"
import { collectSuggestions, readable, sameBlockGroups, type StoredResult } from "./suggestions"
import type { FlowMessage } from "./types"
import type { VaultSnapshot } from "./vault-search"

const now = new Date(2026, 9, 30, 18, 0)
const at = (h: number, m = 0, day = 29) => new Date(2026, 9, day, h, m).toISOString()
const msg = (id: string, text: string, when: string): FlowMessage => ({ id, text, at: when, prior: [] })

const snap = (over: Partial<VaultSnapshot> = {}): VaultSnapshot => ({
  items: [{ id: "i1", title: "Need macbook bricks", listIds: [] }],
  lists: [],
  habits: [{ id: "h1", title: "Stretch" }],
  scopes: [],
  skipListIds: new Set(),
  history: { entries: [], feed: [], logs: [], dayNotes: [], scopeNames: {} },
  ...over,
})

const run = (messages: FlowMessage[], results: Record<string, StoredResult>, s: VaultSnapshot, habitDone = () => false) =>
  collectSuggestions({ snap: s, messages, source: new Map(), results: new Map(Object.entries(results)), files: [], now, habitDone })

describe("collectSuggestions", () => {
  it("drops an item whose title is already saved, keeps a new one", () => {
    const messages = [msg("a", "need macbook bricks", at(9)), msg("b", "buy lemons", at(10))]
    const proposal = (id: string) => ({ messageId: id, nodeId: "p", action: "add-to-list" as const, summary: "", data: { picks: ["Groceries"] } })
    const out = run(messages, { a: { signals: [], proposals: [proposal("a")] }, b: { signals: [], proposals: [proposal("b")] } }, snap())
    expect(out.filter((s) => s.kind === "item").map((s) => s.title)).toEqual(["buy lemons"])
  })

  it("drops a habit already done that day", () => {
    const messages = [msg("a", "stretched", at(9))]
    const r = { a: { signals: [], proposals: [{ messageId: "a", nodeId: "p", action: "habit-done" as const, summary: "", data: { picks: ["Stretch"] } }] } }
    expect(run(messages, r, snap()).filter((s) => s.kind === "habit")).toHaveLength(1)
    expect(run(messages, r, snap(), () => true)).toHaveLength(0)
  })

  it("trims a block around saved Activity time and drops one fully inside it", () => {
    const messages = [msg("a", "starting dishes", at(10)), msg("b", "dishes done", at(11))]
    const signals = { a: { signals: [{ messageId: "a", at: at(10), activity: "Dishes", relation: "starting" as const }], proposals: [] }, b: { signals: [{ messageId: "b", at: at(11), activity: "Dishes", relation: "finished" as const }], proposals: [] } }
    expect(run(messages, signals, snap()).filter((s) => s.kind === "timeblock")).toHaveLength(1)
    const saved = snap({ history: { entries: [{ date: "2026-10-29", scope: "activity", pen: "Dishes", startMin: 570, endMin: 690, text: "" }], feed: [], logs: [], dayNotes: [], scopeNames: {} } })
    expect(run(messages, signals, saved).filter((s) => s.kind === "timeblock")).toHaveLength(0)
  })
})

describe("overlapping block suggestions", () => {
  const sig = (id: string, h: number, activity: string, relation: "starting" | "finished") => ({ signals: [{ messageId: id, at: at(h), activity, relation }], proposals: [] })

  it("keeps a message block and a Screen Time block that overlap, instead of trimming one", () => {
    const messages = [msg("a", "starting dishes", at(10)), msg("b", "dishes done", at(11))]
    const screen = snap({ history: { entries: [{ date: "2026-10-29", scope: "screentime", pen: "Cursor", startMin: 630, endMin: 720, text: "", source: "screentime" }], feed: [], logs: [], dayNotes: [], scopeNames: {} } })
    const out = run(messages, { a: sig("a", 10, "Dishes", "starting"), b: sig("b", 11, "Dishes", "finished") }, screen).filter((s) => s.kind === "timeblock")
    expect(out.map((s) => [s.title, s.detail.slice(11, 22)]).sort()).toEqual([["Computer Work", "10:30–12:00"], ["Dishes", "10:00–11:00"]])
  })

  it("merges the same activity seen by a message and by Screen Time into one suggestion with both detections", () => {
    const messages = [msg("a", "starting work on the mac", at(10)), msg("b", "done working", at(11))]
    const screen = snap({ history: { entries: [{ date: "2026-10-29", scope: "screentime", pen: "Cursor", startMin: 630, endMin: 720, text: "", source: "screentime" }], feed: [], logs: [], dayNotes: [], scopeNames: {} } })
    const out = run(messages, { a: sig("a", 10, "Computer Work", "starting"), b: sig("b", 11, "Computer Work", "finished") }, screen).filter((s) => s.kind === "timeblock")
    expect(out).toHaveLength(1)
    expect(out[0]!.detections?.map((d) => d.source)).toEqual(["bim", "screen"])
    expect(out[0]!.detail).toContain("10:00–12:00")
    expect(out[0]!.detail).toContain("DETECTED 2 TIMES")
  })

  it("does not trim a suggestion around an accepted LLM block", () => {
    const messages = [msg("a", "starting dishes", at(10)), msg("b", "dishes done", at(11))]
    const r = { a: sig("a", 10, "Dishes", "starting"), b: sig("b", 11, "Dishes", "finished") }
    const llm = snap({ history: { entries: [{ date: "2026-10-29", scope: "activity", pen: "Podcast", startMin: 570, endMin: 690, text: "", source: "llm" }], feed: [], logs: [], dayNotes: [], scopeNames: {} } })
    expect(run(messages, r, llm).filter((s) => s.kind === "timeblock")).toHaveLength(1)
  })

  it("groups same-titled detections that overlap", () => {
    const d = (start: number, end: number) => ({ start: at(start), end: at(end) })
    const groups = sameBlockGroups([{ title: "Dishes", d: d(10, 11) }, { title: "dishes", d: d(10.5, 12) }, { title: "Dishes", d: d(14, 15) }, { title: "Podcast", d: d(10, 11) }])
    expect(groups.map((g) => g.length)).toEqual([2, 1, 1])
  })
})

describe("readable", () => {
  it("skips links and bare digits", () => {
    expect(readable("https://x.com")).toBe(false)
    expect(readable("3")).toBe(false)
    expect(readable("making confit")).toBe(true)
  })
})
