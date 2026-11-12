import { describe, expect, it } from "vitest"
import { getBlueprint } from "@/lib/agents/registry"
import { recorder, takenBy, validateTrace } from "@/lib/agents/trace"
import { CHAT_LANES, runLanes, type LaneDef, type LaneGuard } from "./bim-lanes"

const LANES = [
  { id: "a", cost: "code", does: "first", skipWhen: ["tell-open"] },
  { id: "b", cost: "code", does: "second", agent: "plan-bimby" },
  { id: "c", cost: "code", does: "last" },
] as const satisfies readonly LaneDef[]

const none = () => false

describe("runLanes", () => {
  it("returns the first lane that answers and never runs the ones after it", async () => {
    const ran: string[] = []
    const hit = await runLanes(
      LANES,
      {
        a: () => (ran.push("a"), null),
        b: async () => (ran.push("b"), "from b"),
        c: () => (ran.push("c"), "from c"),
      },
      {},
      { is: none },
    )
    expect(hit).toEqual({ lane: "b", line: "from b" })
    expect(ran).toEqual(["a", "b"])
  })

  it("skips a lane whose guard holds, and reads the guard when the lane comes up", async () => {
    let tellOpen = true
    const asked: LaneGuard[] = []
    const rec = recorder({ blueprint: { id: "bim-chat", rev: "1" }, input: "hi", origin: "test" })
    const hit = await runLanes(
      [LANES[1], LANES[0], LANES[2]],
      { a: () => "from a", b: () => ((tellOpen = false), null), c: () => "from c" },
      {},
      { is: (g) => (asked.push(g), g === "tell-open" && tellOpen), rec },
    )
    // `b` closed the question before `a` came up, so `a` was not skipped.
    expect(hit?.lane).toBe("a")
    expect(asked).toEqual(["tell-open"])
    expect(rec.finish("done").events.map((e) => `${e.actor}:${e.status}`)).toEqual(["b:pass", "a:ok"])
  })

  it("leaves one event per lane tried, with the guard, the agent and the note", async () => {
    const rec = recorder({ blueprint: { id: "bim-chat", rev: "1" }, input: "hi", origin: "test" })
    await runLanes(LANES, { a: () => "x", b: () => "from b", c: () => null }, {}, { is: (g) => g === "tell-open", rec, note: (l) => `said ${l}` })
    const trace = rec.finish("done", { text: "from b" })
    expect(trace.events).toMatchObject([
      { actor: "a", kind: "decision", status: "skip", note: "tell-open" },
      { actor: "b", kind: "decision", status: "ok", note: "said from b", agent: "plan-bimby" },
    ])
    expect(takenBy(trace)).toBe("b")
    expect(validateTrace(trace)).toEqual([])
  })

  it("records a throw and lets it go on to the caller", async () => {
    const rec = recorder({ blueprint: { id: "bim-chat", rev: "1" }, input: "hi", origin: "test" })
    const run = runLanes(LANES, { a: () => null, b: () => Promise.reject(new Error("model down")), c: () => "c" }, {}, { is: none, rec })
    await expect(run).rejects.toThrow("model down")
    expect(rec.finish("error").events.at(-1)).toMatchObject({ actor: "b", kind: "error", status: "error", note: "model down" })
  })

  it("returns null when no lane answers", async () => {
    expect(await runLanes(LANES, { a: () => null, b: () => null, c: () => null }, {}, { is: none })).toBeNull()
  })
})

describe("CHAT_LANES", () => {
  it("has unique ids and ends with the ladder, which no guard can skip", () => {
    const ids = CHAT_LANES.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    const last: LaneDef = CHAT_LANES[CHAT_LANES.length - 1]!
    expect(last.id).toBe("ladder")
    expect(last.skipWhen).toBeUndefined()
  })

  it("names only registered Blueprints", () => {
    for (const lane of CHAT_LANES as readonly LaneDef[]) {
      if (lane.agent) expect(getBlueprint(lane.agent), `${lane.id} → ${lane.agent}`).toBeDefined()
    }
  })

  // The order is behavior: a booking must be filed before its clocks read as facts, and a kept fact must
  // answer before the tell shapes do. A change here should be a decision, so the whole order is pinned.
  it("keeps the order a line meets them in", () => {
    expect(CHAT_LANES.map((l) => l.id)).toEqual([
      "handoff",
      "ask-back",
      "follow-through",
      "flight-file",
      "flight-ask",
      "keep",
      "money",
      "day",
      "stream",
      "social",
      "texts",
      "fact",
      "tell",
      "wire",
      "habit-auto",
      "report",
      "resistance-outcome",
      "resistance",
      "ladder",
    ])
  })
})
