import { describe, expect, it } from "vitest"
import { collectSuggestions, readable, type StoredResult } from "./suggestions"
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

describe("readable", () => {
  it("skips links and bare digits", () => {
    expect(readable("https://x.com")).toBe(false)
    expect(readable("3")).toBe(false)
    expect(readable("making confit")).toBe(true)
  })
})
