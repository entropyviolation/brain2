import { beforeEach, describe, expect, it, vi } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import type { Crew } from "@/lib/bim-flow/crew"
import type { LinkedMention } from "@/lib/bim-flow/entity-link"
import type { FlowMessage, FlowRun } from "@/lib/bim-flow/types"

const crew: Crew = { route: ["small"], gate: ["small"], pick: ["big"], extract: ["big"], prose: ["big"], check: ["big"], critic: ["big"], main: "big" }
const state = vi.hoisted(() => ({ asked: [] as string[] }))

vi.mock("@/lib/bim-flow/chat-models", () => ({ chatCrew: async () => crew }))
vi.mock("@/lib/bim-flow/chat-router", () => ({ routeChat: async () => ({ intent: "ask", sure: true, answeredBy: "code", why: "", hops: [] }) }))
vi.mock("@/lib/bim-flow/run-flow", () => ({
  runFlow: async (_flow: unknown, messages: FlowMessage[]): Promise<FlowRun> => {
    state.asked.push(messages[0]!.text)
    return {
      model: "big",
      startedAt: "",
      ms: 1,
      blocks: [],
      messages: [{
        message: messages[0]!,
        steps: [],
        proposals: [],
        signals: [],
        answers: [{ nodeId: "chk", mode: "check", text: "6h 10m.", confidence: "high", evidence: [], used: [], facts: [] }],
      }],
    }
  },
}))

import { sendToBim, useBimChatStore } from "./bim-chat"
import { FOCUS_TTL_MS, resolveFollowUp, useBimThread, type ThreadFocus } from "./bim-thread"

/** A two-person vault: every "Shelby" or "Elijah" in the line is a linked person. */
const link = (text: string): LinkedMention[] =>
  [...text.matchAll(/\b(shelby|elijah)\b/gi)].map((m) => {
    const best = { id: m[1]!.toLowerCase(), kind: "person" as const, sub: "person" as const, label: m[1]!, score: 1, how: "full" as const, reasons: [] }
    return { text: m[0], start: m.index, end: m.index + m[0].length, status: "linked" as const, kind: "person" as const, best, candidates: [best] }
  })

const focus = (question: string): ThreadFocus => ({ question, at: 0 })
const read = (line: string, question: string) => resolveFollowUp(line, focus(question), link)?.text ?? null

describe("resolveFollowUp", () => {
  it("swaps the time window", () => {
    expect(read("and last week?", "how many hours of computer work this week?")).toBe("how many hours of computer work last week?")
    expect(read("what about yesterday", "how much did I sleep last night?")).toBe("how much did I sleep yesterday?")
    expect(read("and for the last 3 days?", "how many showers this month?")).toBe("how many showers last 3 days?")
  })

  it("adds a window when the question had none", () => {
    expect(read("last month?", "how many times did I see Shelby?")).toBe("how many times did I see Shelby last month?")
  })

  it("swaps the person", () => {
    expect(read("what about Elijah?", "when did I last see Shelby?")).toBe("when did I last see Elijah?")
    expect(read("and elijah", "When was the last time I saw Shelby?")).toBe("When was the last time I saw elijah?")
  })

  it("fills a pronoun from the one person in focus", () => {
    expect(read("where did she go after?", "when did I last see Shelby?")).toBe("where did Shelby go after?")
    expect(read("when is their birthday?", "when did I last see Shelby?")).toBe("when is Shelby's birthday?")
  })

  it("leaves everything else alone", () => {
    // A bare time or name is an answer or a log line, not a follow-up.
    expect(read("yesterday", "how much did I sleep last night?")).toBeNull()
    expect(read("Elijah", "when did I last see Shelby?")).toBeNull()
    // The same window, the same person, a whole new question, a log line.
    expect(read("and this week?", "how many hours this week?")).toBeNull()
    expect(read("what about Shelby?", "when did I last see Shelby?")).toBeNull()
    expect(read("how many showers this week?", "how many hours this week?")).toBeNull()
    expect(read("and then I went to bed", "how much did I sleep last night?")).toBeNull()
    // No person in focus, or two: a pronoun is never guessed.
    expect(read("where did she go?", "how many hours this week?")).toBeNull()
    expect(read("where did she go?", "did Shelby see Elijah?")).toBeNull()
    expect(read("what about Elijah?", "how many hours this week?")).toBeNull()
    expect(resolveFollowUp("and last week?", null, link)).toBeNull()
  })
})

describe("BIM chat thread", () => {
  const t0 = new Date("2026-11-09T12:00:00")
  const later = (ms: number) => new Date(t0.getTime() + ms)

  beforeEach(() => {
    resetAllStores()
    useBimThread.getState().setFocus(null)
    state.asked = []
  })

  it("answers a follow-up as the whole question and says what it read", async () => {
    await sendToBim("how many hours of computer work this week?", t0, { llm: true })
    const line = await sendToBim("and last week?", later(60_000), { llm: true })
    expect(state.asked).toEqual(["how many hours of computer work this week?", "how many hours of computer work last week?"])
    expect(line.readAs).toBe("how many hours of computer work last week?")
    expect(line.text).toBe("6h 10m.")
    // The rewritten question is the new focus, so the next follow-up chains.
    const third = await sendToBim("what about yesterday?", later(120_000), { llm: true })
    expect(third.readAs).toBe("how many hours of computer work yesterday?")
  })

  it("forgets the focus after a while, and on clear", async () => {
    await sendToBim("how many hours of computer work this week?", t0, { llm: true })
    const stale = await sendToBim("and last week?", later(FOCUS_TTL_MS + 1), { llm: true })
    expect(stale.readAs).toBeUndefined()

    await sendToBim("how many hours of computer work this week?", t0, { llm: true })
    useBimChatStore.getState().clear()
    const cleared = await sendToBim("and last week?", later(60_000), { llm: true })
    expect(cleared.readAs).toBeUndefined()
  })

  it("does not take an open question's answer for a follow-up", async () => {
    await sendToBim("how many hours of computer work this week?", t0, { llm: true })
    useBimThread.getState().setFocus({ question: "how many hours of computer work this week?", at: t0.getTime() })
    const { checkInLine } = await import("./bim-chat")
    checkInLine("doing", later(1000))
    const line = await sendToBim("and last week", later(2000), { llm: true })
    expect(line.readAs).toBeUndefined()
  })
})
