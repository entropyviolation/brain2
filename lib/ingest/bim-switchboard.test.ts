import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import type { Crew } from "@/lib/bim-flow/crew"
import type { FlowRun } from "@/lib/bim-flow/types"

const crew: Crew = { route: ["small"], gate: ["small"], pick: ["big"], extract: ["big"], prose: ["big"], check: ["big"], critic: ["big"], main: "big" }
const state = vi.hoisted(() => ({ crew: null as unknown, route: null as unknown, run: null as unknown }))

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
