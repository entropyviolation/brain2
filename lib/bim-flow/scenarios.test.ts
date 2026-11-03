import { describe, expect, it } from "vitest"
import { askCalcFlow, askFlow, phoneCaptureFlow } from "./task-flows"
import { runFlow } from "./run-flow"
import { gateStarting, message, NOW, plan, say, scriptedModel, SCENARIO_VAULT, extract, pick } from "./scenarios"
import type { Flow } from "./types"

const ran = (r: Awaited<ReturnType<typeof runFlow>>) => new Set(r.messages[0]!.steps.map((s) => s.nodeId))
const ask = async (text: string, rules: Parameters<typeof scriptedModel>[0], flow: Flow = askCalcFlow()) => {
  const m = scriptedModel(rules)
  const r = await runFlow(flow, [message(text)], m.call, SCENARIO_VAULT, { model: "t", getFlow: () => undefined })
  return { r, m, ran: ran(r), answer: r.messages[0]!.answers[0], facts: r.messages[0]!.answers.flatMap((a) => a.facts) }
}

describe("ask-calc: counted by code, phrased by the model", () => {
  const lane = (q: string) => gateStarting(q, "yes")

  it("hours on a project this week", async () => {
    const o = await ask("how many hours did i spend on brain2 this week?", [plan({ intent: "duration", subject: "brain2", days: 7 }), lane("Does it ask how long"), say("high", "echo")])
    expect(o.ran.has("c-minutes")).toBe(true)
    expect(o.ran.has("c-streak")).toBe(false)
    expect(o.answer!.text).toContain("630 minutes (10h 30m)")
  })

  it("a streak", async () => {
    const o = await ask("how many days in a row have i walked?", [plan({ subject: "walking" }), lane("Does it ask about a streak"), say("high", "echo")])
    expect(o.answer!.text).toContain("current run 5 days")
  })

  it("days since", async () => {
    const o = await ask("how long since i showered?", [plan({ intent: "last_time", subject: "shower" }), lane("Does it ask how long it has been since"), say("high", "echo")])
    expect(o.answer!.text).toContain("2 days before 2026-10-30")
  })

  it("week over week", async () => {
    const o = await ask("am i walking more than last week this week?", [plan({ subject: "walking", days: 7 }), lane("Does it compare to before"), say("medium", "echo")])
    expect(o.answer!.text).toContain("Change +3h 15m")
  })

  it("two lanes can both fire when two gates say yes", async () => {
    const o = await ask("how long and how many times did i walk this week", [plan({ subject: "walking", days: 7 }), lane("Does it ask how long, how many"), lane("Does it ask how many times"), say("high", "echo")])
    expect(o.ran.has("c-minutes")).toBe(true)
    expect(o.ran.has("c-count")).toBe(true)
    // The SAY node reads both computations' facts.
    expect(o.facts.join(" ")).toMatch(/MINUTES[\s\S]*COUNT|COUNT[\s\S]*MINUTES/)
  })

  it("a model that says 'yes' to nothing computes nothing, and the plain lane answers instead of ending silent", async () => {
    const o = await ask("what is the meaning of walking", [plan({ subject: "walking" }), say("medium", "plain lane answer")])
    expect([...o.ran].filter((id) => /^c-(minutes|streak|since|gap|compare|count)$/.test(id))).toEqual([])
    expect(o.ran.has("fb")).toBe(true)
    expect(o.ran.has("a-fb")).toBe(true)
    expect(o.answer!.text).toBe("plain lane answer")
  })

  it("stops at the premise guard when the notes never mention the subject", async () => {
    const o = await ask("what color were my socks on my trip to mars?", [plan({ subject: "socks mars" }), lane("Does it ask how long"), say("high", "should not run")])
    expect(o.ran.has("k-known")).toBe(true)
    expect([...o.ran].some((id) => id.startsWith("g-"))).toBe(false)
    expect(o.answer!.confidence).toBe("none")
    expect(o.answer!.text).toContain("socks")
    // No model call for the gates or the answer: only the plan.
    expect(o.m.calls).toHaveLength(1)
  })

  it("asks which Elijah instead of planning, when the name fits two people", async () => {
    const o = await ask("how long was i with elijah this week?", [plan({ subject: "elijah" }), say("high")])
    expect(o.ran.has("c-who")).toBe(true)
    expect(o.ran.has("x-plan")).toBe(false)
    expect(o.answer!.text).toMatch(/^Which Elijah: Elijah (Gibbins-Croft or Elijah Moore|Moore or Elijah Gibbins-Croft)\?$/)
    expect(o.m.calls).toHaveLength(0)
  })

  it("goes on when the full name settles it", async () => {
    const o = await ask("how long was i with Elijah Moore this week?", [plan({ subject: "elijah" }), lane("Does it ask how long"), say("high", "echo")])
    expect(o.ran.has("x-plan")).toBe(true)
    expect(o.ran.has("c-minutes")).toBe(true)
  })

  it("a nickname settles it too", async () => {
    const o = await ask("how long was i with Lex this week?", [plan({ subject: "lex" }), say("none")])
    expect(o.ran.has("x-plan")).toBe(true)
  })

  it("an unrelated question with no name just goes through", async () => {
    const o = await ask("how long did i cook yesterday", [plan({ subject: "cooking" }), lane("Does it ask how long"), say("high", "echo")])
    expect(o.answer!.text).toContain("30 minutes")
    expect(o.answer!.text).toContain("yesterday")
  })
})

describe("clarify and guard in the existing flows", () => {
  it("the plain Ask flow is unchanged: its first step is still the plan", async () => {
    const m = scriptedModel([plan({ subject: "shower" })])
    const r = await runFlow(askFlow(), [message("when did i shower")], m.call, SCENARIO_VAULT, { model: "t" })
    expect(r.messages[0]!.steps[1]!.nodeId).toBe("x-plan")
  })

  it("hands a phone question to the Ask flow with the vault in the room", async () => {
    const flows: Record<string, Flow> = { ask: askFlow() }
    const m = scriptedModel([gateStarting("Is it a request or question to the app", "yes"), plan({ subject: "shower" }), say("low", "x")])
    const r = await runFlow(phoneCaptureFlow(), [message("when did i last shower", { entry: "phone-capture" })], m.call, SCENARIO_VAULT, { model: "t", getFlow: (id) => flows[id] })
    expect(r.messages[0]!.steps.some((s) => s.nodeId === "h-ask")).toBe(true)
  })
})

describe("scripted model", () => {
  it("answers extracts and picks by field name, and defaults to the safe answer", async () => {
    const m = scriptedModel([extract(["task", "pole"], { task: "taxes", pole: "resistance" }), pick(["Errands"])])
    expect(await m.call({ system: "", user: "", schema: { type: "object", properties: { task: {}, pole: {} } } })).toEqual({ task: "taxes", pole: "resistance" })
    expect(await m.call({ system: "", user: "", schema: { type: "object", properties: { picks: {} } } })).toEqual({ picks: ["Errands"] })
    expect(await m.call({ system: "", user: "", schema: { type: "object", properties: { answer: {} } } })).toEqual({ answer: "no" })
    expect(m.calls).toHaveLength(3)
  })
  it("NOW is a Friday", () => expect(NOW.getDay()).toBe(5))
})
