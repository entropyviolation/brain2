import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import type { Crew } from "@/lib/bim-flow/crew"
import type { FlowRun } from "@/lib/bim-flow/types"

const crew: Crew = { route: ["small"], gate: ["small"], pick: ["big"], extract: ["big"], prose: ["big"], check: ["big"], critic: ["big"], main: "big" }
const state = vi.hoisted(() => ({ crew: null as unknown, route: null as unknown, run: null as unknown, chat: null as unknown, chatInputs: [] as unknown[] }))

// The lane's own steps are tested in `lib/bim-flow/chat-lane.test.ts`; here only its reply (or its failure) is scripted.
vi.mock("@/lib/bim-flow/chat-lane", async (original) => ({
  ...(await original<typeof import("@/lib/bim-flow/chat-lane")>()),
  runChatLane: async (input: unknown) => {
    state.chatInputs.push(input)
    if (!state.chat) throw new Error("no model")
    return state.chat
  },
}))

vi.mock("@/lib/bim-flow/chat-models", () => ({ chatCrew: async () => state.crew }))
vi.mock("@/lib/bim-flow/chat-router", () => ({ routeChat: async () => state.route }))
vi.mock("@/lib/bim-flow/run-flow", () => ({ runFlow: async () => state.run }))

import { routable } from "./bim-switchboard"
import { checkInLine, openAskBack, sendToBim } from "./bim-chat"
import { useIngestStore } from "./ingest-store"

const answered = (text: string): FlowRun => ({
  model: "big",
  startedAt: "",
  ms: 1,
  blocks: [],
  messages: [{
    message: { id: "m", text: "", at: "", prior: [] },
    steps: [],
    proposals: [],
    signals: [],
    answers: [{ nodeId: "chk", mode: "check", text, confidence: "high", evidence: [{ when: "Oct 30", source: "entry", text: "Shower" }], used: [1], facts: ["last: Oct 30"] }],
  }],
})

describe("BIM chat LLM mode", () => {
  beforeEach(() => {
    resetAllStores()
    state.crew = crew
    state.route = { intent: "ask", sure: true, answeredBy: "code", why: "", hops: [] }
    state.run = answered("Oct 30, 2 days ago.")
    state.chat = null
    state.chatInputs = []
  })

  it("on: a chat line gets a reply, is not filed, and offers to log your own words", async () => {
    state.route = { intent: "chat", sure: true, answeredBy: "model", why: "", hops: [{ model: "small", ms: 5 }] }
    state.chat = { text: "That sounds exhausting.", general: true, hops: [], evidence: [], models: ["big"], calls: 1 }
    const line = await sendToBim("I'm so tired of this", new Date(), { llm: true })
    expect(line.text).toBe("That sounds exhausting.")
    expect(line.general).toBe(true)
    expect(line.route).toMatch(/^CHAT · small · general · big · .* · 1 call$/)
    expect(line.choices).toEqual([{ label: "log it", text: "log: I'm so tired of this" }])
    expect(useIngestStore.getState().events).toHaveLength(0)
    const logged = await sendToBim(line.choices![0]!.text, new Date(), { llm: true })
    expect(logged.status).toBe("ok")
    expect(useIngestStore.getState().events.at(-1)?.raw).toBe("log: I'm so tired of this")
  })

  it("on: a chat reply with rows behind it shows them and is not marked general", async () => {
    state.route = { intent: "chat", sure: true, answeredBy: "model", why: "", hops: [{ model: "small", ms: 5 }] }
    state.chat = { text: "You logged 6h of computer work this week.", general: false, hops: [{ tool: "count", subject: "computer", found: 4 }], evidence: ["MINUTES: 360"], models: ["big", "big"], calls: 2 }
    const line = await sendToBim("feels like I've been on the computer a lot", new Date(), { llm: true })
    expect(line.general).toBeUndefined()
    expect(line.evidence).toEqual(["MINUTES: 360"])
    expect(line.route).toMatch(/^CHAT · small · count · big · .* · 2 calls$/)
  })

  it("on: a question about nothing in the vault skips the Ask flow and is answered as general", async () => {
    state.chat = { text: "Around 250°F, low and slow.", general: true, hops: [], evidence: [], models: ["big"], calls: 1 }
    const line = await sendToBim("what temp for garlic confit?", new Date(), { llm: true })
    expect(line.text).toBe("Around 250°F, low and slow.")
    expect(line.general).toBe(true)
    expect(line.choices).toBeUndefined()
    expect(useIngestStore.getState().events).toHaveLength(0)
    // A question about you ("I", a time word) still goes to the Ask flow.
    const mine = await sendToBim("when did I last shower?", new Date(), { llm: true })
    expect(mine.text).toBe("Oct 30, 2 days ago.")
    expect(state.chatInputs).toHaveLength(1)
  })

  it("on: words you corrected before go straight to the lane you named, whatever the router says", async () => {
    const { recordRouteVerdict } = await import("@/lib/bim-flow/route-verdicts")
    recordRouteVerdict({ text: "is the laundry done?", was: "ask", shouldBe: "log", at: "" })
    state.route = { intent: "ask", sure: true, answeredBy: "code", why: "", hops: [] }
    const line = await sendToBim("is the laundry done?", new Date(), { llm: true })
    expect(line.route).toMatch(/^LOG · code/)
  })

  it("on, but the chat lane fails: the line is filed as before", async () => {
    state.route = { intent: "chat", sure: true, answeredBy: "model", why: "", hops: [{ model: "small", ms: 5 }] }
    const line = await sendToBim("I'm so tired of this", new Date(), { llm: true })
    expect(line.route).toMatch(/chat failed$/)
    expect(useIngestStore.getState().events).toHaveLength(1)
  })

  it("routes only lines the ladder would capture", () => {
    expect(routable("when did I last shower?", false)).toBe(true)
    expect(routable("log: shower", false)).toBe(false)
    expect(routable("groc", false)).toBe(false)
    expect(routable("two\nlines", false)).toBe(false)
    expect(routable("when did I last shower?", true)).toBe(false)
  })

  it("off: a question is captured, exactly as before", async () => {
    const line = await sendToBim("when did I last shower?", new Date(), { llm: false })
    expect(line.route).toBeUndefined()
    expect(useIngestStore.getState().events).toHaveLength(1)
  })

  it("on: a question is answered with evidence and nothing is filed", async () => {
    const line = await sendToBim("when did I last shower?", new Date(), { llm: true })
    expect(line.text).toBe("Oct 30, 2 days ago.")
    expect(line.route).toMatch(/^ASK · code/)
    expect(line.evidence).toEqual(["last: Oct 30", "Oct 30 · entry · Shower"])
    expect(useIngestStore.getState().events).toHaveLength(0)
  })

  it("on: a log line still goes to the executor, with its route shown", async () => {
    state.route = { intent: "log", sure: true, answeredBy: "model", why: "", hops: [{ model: "small", ms: 5 }] }
    const line = await sendToBim("making garlic confit now", new Date(), { llm: true })
    expect(line.route).toMatch(/^LOG · small/)
    expect(useIngestStore.getState().events).toHaveLength(1)
  })

  it("on: log + ask files the line and answers the question", async () => {
    state.route = { intent: "log", second: "ask", sure: true, answeredBy: "model", why: "", hops: [{ model: "small", ms: 5 }] }
    const line = await sendToBim("back from Sam's, did I shower today", new Date(), { llm: true })
    expect(line.text).toContain("Oct 30, 2 days ago.")
    expect(useIngestStore.getState().events).toHaveLength(1)
  })

  it("on, but no model reachable: the old chat", async () => {
    state.crew = null
    const line = await sendToBim("when did I last shower?", new Date(), { llm: true })
    expect(line.route).toBeUndefined()
    expect(useIngestStore.getState().events).toHaveLength(1)
  })

  it("on, but the Ask flow fails: BIM says the lookup failed and why, and files nothing", async () => {
    state.run = { ...answered(""), messages: [{ ...answered("").messages[0]!, answers: [], steps: [{ nodeId: "x", ms: 1, port: "out", output: null, error: "Ollama 500" }] }] }
    const line = await sendToBim("when did I last shower?", new Date(), { llm: true })
    expect(line.route).toMatch(/ask failed$/)
    expect(line.text).toContain("model run failed (Ollama 500)")
    expect(line.status).toBe("error")
    expect(useIngestStore.getState().events).toHaveLength(0)
  })

  it("on, but no model reachable: BIM says it cannot reach the models, not that LLM is off", async () => {
    state.crew = null
    const line = await sendToBim("when did I last shower?", new Date(), { llm: true })
    expect(line.text).toMatch(/can't reach the local models/)
  })

  it("on, no evidence: BIM says it does not know, asks you, and files your answer as a log naming the question", async () => {
    const run = answered("The notes do not record when Elijah left for tour.")
    run.messages[0]!.answers[0]!.confidence = "none"
    state.run = run
    const line = await sendToBim("when did elijah leave for tour?", new Date(), { llm: true })
    expect(line.text).toMatch(/^I don't know\./)
    expect(line.text).toMatch(/Tell me and I'll keep it/)
    expect(openAskBack()).toEqual({ kind: "fact", question: "when did elijah leave for tour?" })
    const saved = await sendToBim("oct 19", new Date(), { llm: true })
    expect(saved.text).toMatch(/^Saved\./)
    expect(useIngestStore.getState().events.at(-1)?.raw).toBe('log: oct 19 (answer to "when did elijah leave for tour?")')
    expect(openAskBack()).toBeNull()
  })

  it("check-in: BIM asks what you are doing, and the answer is filed as doing:", async () => {
    const asked = checkInLine("doing")
    expect(asked.text).toBe("What are you doing right now?")
    expect(asked.choices?.map((c) => c.text)).toEqual(["skip"])
    await sendToBim("editing the zine", new Date(), { llm: false })
    expect(useIngestStore.getState().events.at(-1)?.raw).toBe("doing: editing the zine")
    checkInLine("mood")
    const skipped = await sendToBim("skip", new Date(), { llm: false })
    expect(skipped.text).toBe("Okay, skipped.")
    expect(openAskBack()).toBeNull()
  })

  it("check-in: a new question drops the check-in instead of being filed as the answer", async () => {
    checkInLine("doing")
    const line = await sendToBim("when did I last shower?", new Date(), { llm: true })
    expect(line.text).toBe("Oct 30, 2 days ago.")
    expect(openAskBack()).toBeNull()
  })
})
