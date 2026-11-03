import { describe, expect, it } from "vitest"
import { assembleBlocks, placeSinceClock } from "./blocks"
import { defaultFlow } from "./default-flow"
import type { ModelCall } from "./ollama"
import { runFlow } from "./run-flow"
import type { ActivitySignal, FlowMessage } from "./types"
import { contentWords, searchVault, skipListIdsFor, type VaultSnapshot } from "./vault-search"

const snap: VaultSnapshot = {
  items: [
    { id: "i1", title: "Garlic confit", listIds: ["cook"] },
    { id: "i2", title: "Macbook charger brick", listIds: ["needed"] },
    { id: "i3", title: "garlic fan account", listIds: ["ig"] },
    { id: "p1", title: "Elijah Gibbins-Croft", type: "person", listIds: [] },
  ],
  lists: [
    { id: "cook", name: "cook" },
    { id: "needed", name: "Needed" },
    { id: "ig", name: "People who follow me on Instagram" },
  ],
  habits: [{ id: "h1", title: "Go outside" }],
  scopes: [{ id: "activity", name: "Activity", pens: [{ id: "a1", name: "cooking" }, { id: "a2", name: "walking" }] }],
  skipListIds: new Set(["ig"]),
}

describe("vault search", () => {
  it("keeps content words only", () => {
    expect(contentWords("Then did the garlic confit, like 40 more min")).toEqual(["garlic", "confit", "min"])
  })

  it("ranks by words matched and offers the lists those items sit on", () => {
    const out = searchVault(snap, "garlic confit done", { source: "items" })
    expect(out.hits.map((h) => h.id)).toEqual(["i1"])
    expect(out.options).toEqual(["cook"])
  })

  it("finds a person by one word of their name", () => {
    expect(searchVault(snap, "called elijah", { source: "people" }).options).toEqual(["Elijah Gibbins-Croft"])
  })
})

describe("blocks", () => {
  const at = (hm: string, day = "2026-10-29") => new Date(`${day}T${hm}:00`).toISOString()

  it("places a bare since clock at the latest past moment", () => {
    expect(placeSinceClock("4:46", new Date(at("17:09")))?.getHours()).toBe(16)
    expect(placeSinceClock("4:46", new Date(at("05:10")))?.getHours()).toBe(4)
  })

  it("opens at since, closes at the next activity, and ends on minutes left", () => {
    const signals: ActivitySignal[] = [
      { messageId: "1", at: at("17:09"), activity: "walking", relation: "doing_now", since: "4:46" },
      { messageId: "2", at: at("17:40"), activity: "doing dishes", relation: "starting" },
      { messageId: "3", at: at("18:00"), activity: "cooking", relation: "doing_now", minutesLeft: 40 },
    ]
    const blocks = assembleBlocks(signals)
    expect(blocks.map((b) => [b.activity, new Date(b.start).getHours(), new Date(b.start).getMinutes(), b.estimated])).toEqual([
      ["walking", 16, 46, false],
      ["doing dishes", 17, 40, false],
      ["cooking", 18, 0, true],
    ])
    expect(new Date(blocks[2]!.end).getMinutes()).toBe(40)
  })

  it("does not stretch an open block across a silent night", () => {
    const blocks = assembleBlocks([
      { messageId: "1", at: at("20:00"), activity: "writing", relation: "starting" },
      { messageId: "2", at: at("02:00", "2026-10-30"), activity: "cooking", relation: "starting" },
    ])
    expect(blocks[0]!.estimated).toBe(true)
    expect(new Date(blocks[0]!.end).getHours()).toBe(21)
  })
})

describe("runFlow", () => {
  it("routes by gate answers and proposes without writing", async () => {
    const call: ModelCall = async ({ user, schema }) => {
      const props = (schema as { properties: Record<string, unknown> }).properties
      if ("answer" in props) {
        const q = user.split("\n")[0]!
        return { answer: /doing|Keep on a list|idea, task/.test(q) || q.includes("is doing") ? "yes" : "no" }
      }
      if ("picks" in props) return { picks: user.includes("activity pen") ? ["cooking"] : ["cook"] }
      return { relation: "doing_now", since: "", minutes_left: 40 }
    }
    const msg: FlowMessage = { id: "m1", text: "Garlic confit like 40 more min", at: new Date(2026, 9, 30, 2, 58).toISOString(), prior: [] }
    const run = await runFlow(defaultFlow(), [msg], call, snap, { model: "fake" })
    const ran = run.messages[0]!.steps.map((s) => s.nodeId)
    expect(ran).toContain("blocks")
    expect(ran).not.toContain("s-people")
    expect(run.blocks).toHaveLength(1)
    expect(run.blocks[0]!.activity).toBe("cooking")
    expect(run.messages[0]!.proposals.map((p) => p.summary)).toEqual(['Add "Garlic confit like 40 more min" to cook'])
  })
})

describe("echoes and system lists", () => {
  it("ignores a since clock that is just the send minute", () => {
    const at = new Date("2026-10-30T02:56:00").toISOString()
    const [b] = assembleBlocks([{ messageId: "1", at, activity: "cooking", relation: "starting", since: "2:56" }])
    expect(b!.why.startsWith("started")).toBe(true)
  })

  it("never offers the Log list", () => {
    const s: VaultSnapshot = {
      ...snap,
      items: [{ id: "x", title: "Garlic log", listIds: ["log"] }],
      lists: [{ id: "log", name: "Log" }],
      skipListIds: skipListIdsFor([{ id: "log", name: "Log" }]),
    }
    expect(searchVault(s, "garlic", { source: "items" }).options).toEqual([])
  })
})

describe("termsMatched stems", () => {
  it("matches showered ~ shower but not show ~ shower", async () => {
    const { termsMatched } = await import("./retrieve")
    expect(termsMatched("Showered", ["shower"])).toBe(1)
    expect(termsMatched("Wrapping up show rn", ["shower"])).toBe(0)
  })
})
