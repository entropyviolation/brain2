import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import type { Crew } from "@/lib/bim-flow/crew"
import type { FlowRun } from "@/lib/bim-flow/types"

const crew: Crew = { route: ["small"], gate: ["small"], pick: ["big"], extract: ["big"], prose: ["big"], check: ["big"], main: "big" }
const state = vi.hoisted(() => ({ crew: null as unknown, route: null as unknown, run: null as unknown }))

vi.mock("@/lib/bim-flow/chat-models", () => ({ chatCrew: async () => state.crew }))
vi.mock("@/lib/bim-flow/chat-router", () => ({ routeChat: async () => state.route }))
vi.mock("@/lib/bim-flow/run-flow", () => ({ runFlow: async () => state.run }))

import { routable } from "./bim-switchboard"
import { sendToBim } from "./bim-chat"
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

  it("on, but the Ask flow fails: the line is still captured and the chip says why", async () => {
    state.run = { ...answered(""), messages: [{ ...answered("").messages[0]!, answers: [], steps: [{ nodeId: "x", ms: 1, port: "out", output: null, error: "Ollama 500" }] }] }
    const line = await sendToBim("when did I last shower?", new Date(), { llm: true })
    expect(line.route).toMatch(/ask failed: Ollama 500/)
    expect(useIngestStore.getState().events).toHaveLength(1)
  })
})
