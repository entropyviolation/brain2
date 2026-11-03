import { describe, expect, it } from "vitest"
import { askFlow, phoneCaptureFlow } from "./task-flows"
import { modelFor, runFlow } from "./run-flow"
import { message, plan, say, scriptedModel, SCENARIO_VAULT, type Rule } from "./scenarios"
import { judgeChecks } from "./tests"
import type { Flow, ModelPlan } from "./types"

const go = async (flow: Flow, text: string, rules: Rule[], models?: ModelPlan) => {
  const m = scriptedModel(rules)
  const asked: { model?: string; props: string[] }[] = []
  const call: typeof m.call = (req) => {
    asked.push({ model: req.model, props: Object.keys((req.schema as { properties?: object }).properties ?? {}) })
    return m.call(req)
  }
  const r = await runFlow(flow, [message(text)], call, SCENARIO_VAULT, { model: "main", models, getFlow: () => undefined })
  return { r, m, asked, ran: new Set(r.messages[0]!.steps.map((s) => s.nodeId)), answers: r.messages[0]!.answers }
}

describe("Ask: one route instead of four gates", () => {
  it("settles 'last time' by pattern, with no model call for the route", async () => {
    const o = await go(askFlow(), "when was the last time i showered?", [plan({ subject: "shower" }), say("high", "ok")])
    expect(o.ran.has("a-last")).toBe(true)
    expect(o.ran.has("a-count")).toBe(false)
    expect(o.ran.has("fb")).toBe(false)
    expect(o.m.calls.some((c) => c.props.includes("routes"))).toBe(false)
  })

  it("settles 'how many' and 'while with someone' by pattern", async () => {
    const a = await go(askFlow(), "how many hours did i spend on computer work this week?", [plan({ subject: "computer work" }), say("high")])
    expect(a.ran.has("a-count")).toBe(true)
    const b = await go(askFlow(), "when i hang out with elijah, what shirt do i wear most?", [plan({ subject: "shirt", person: "elijah" }), say("high")])
    expect(b.ran.has("a-with")).toBe(true)
  })

  it("asks the model once when no pattern fits, and runs only the lane it picks", async () => {
    const o = await go(askFlow(), "what do i usually wear at the zoo", [plan({ subject: "zoo" }), { when: (r) => "routes" in ((r.schema as { properties: object }).properties), reply: { routes: ["with"] } }, say("medium")])
    expect(o.m.calls.filter((c) => c.props.includes("routes"))).toHaveLength(1)
    expect(o.ran.has("a-with")).toBe(true)
    expect(o.ran.has("fb")).toBe(false)
  })
})

describe("fallback node: runs only when no other lane produced anything", () => {
  it("answers through the plain lane when the route picks nothing", async () => {
    const o = await go(askFlow(), "what color were my socks on my trip to mars?", [plan({ subject: "socks mars" }), say("none", "the notes do not record it")])
    expect(o.ran.has("fb")).toBe(true)
    expect([...o.ran].filter((id) => /^a-(last|count|with)$/.test(id))).toEqual([])
    expect(o.ran.has("r-fb-t")).toBe(true)
    expect(o.answers[0]!.text).toBe("the notes do not record it")
    expect(o.answers[0]!.confidence).toBe("none")
  })

  it("does not run when a lane already answered", async () => {
    const o = await go(askFlow(), "how many times did i walk", [plan({ subject: "walk" }), say("high")])
    expect(o.ran.has("fb")).toBe(false)
    expect(o.ran.has("a-fb")).toBe(false)
  })
})

describe("command gate examples", () => {
  it("shows the taught build requests to the gate, and none is a test input", async () => {
    const o = await go(phoneCaptureFlow(), "make me a list for movies", [])
    const gate = o.m.calls.find((c) => c.user.includes("Taught answers"))
    expect(gate).toBeTruthy()
    expect(gate!.user).toContain("need a place to track my water")
    const gate2 = phoneCaptureFlow().nodes.find((n) => n.id === "g-cmd")!
    for (const t of ["be home for more than 5 hours", "replace bike tube", "gift ideas", "somewhere to keep those"]) {
      expect(gate2.config.examples!.some((x) => x.text.includes(t))).toBe(false)
    }
  })
})

describe("per-node models", () => {
  it("gates and routes use the gate model, answers the prose model, extracts the main model", async () => {
    const o = await go(askFlow(), "what do i usually wear at the zoo", [plan({ subject: "zoo" }), { when: (r) => "routes" in ((r.schema as { properties: object }).properties), reply: { routes: ["with"] } }, say("medium")], { gates: "small", prose: "big" })
    const by = (p: string) => o.asked.filter((a) => a.props.includes(p)).map((a) => a.model)
    expect(by("routes")).toEqual(["small"])
    expect(by("answer").every((m) => m === "big")).toBe(true)
    expect(by("subject")).toEqual([undefined])
  })

  it("a node's own model beats the plan", () => {
    const flow = askFlow()
    const node = { ...flow.nodes.find((n) => n.id === "a-last")!, config: { ...flow.nodes.find((n) => n.id === "a-last")!.config, model: "mine" } }
    expect(modelFor(node, { prose: "big" })).toBe("mine")
    expect(modelFor(flow.nodes.find((n) => n.id === "a-last")!, { prose: "big" })).toBe("big")
    expect(modelFor(flow.nodes.find((n) => n.id === "x-plan")!, { gates: "small", prose: "big" })).toBeUndefined()
  })

  it("a step that asked a different model records it", async () => {
    const o = await go(askFlow(), "how many times did i walk", [plan({ subject: "walk" }), say("high")], { prose: "big" })
    const step = o.r.messages[0]!.steps.find((s) => s.nodeId === "a-count")!
    expect(step.model).toBe("big")
    expect(o.r.messages[0]!.steps.find((s) => s.nodeId === "x-plan")!.model).toBeUndefined()
  })
})

describe("test checks", () => {
  it("scores regexes, line counts, port steps, overlaps and long suggestions", async () => {
    const o = await go(askFlow(), "how many hours did i spend on computer work this week?", [plan({ subject: "computer" }), say("high", "You spent 10.17 hours.")])
    const checks = judgeChecks(
      { id: "t", name: "t", flowId: "ask", input: { kind: "question", text: "x" }, checks: { answerMatches: ["\\d+(\\.\\d+)?\\s*hours?"], answerMaxLines: 1, stepPorts: [{ nodeId: "r-kind", port: "r:count" }], blocksNoOverlap: true, proposalsMaxChars: 10, proposalsNotContain: ["x"] } },
      o.r,
    )
    expect(checks.every((c) => c.ok)).toBe(true)
    expect(checks.length).toBe(6)
  })
})
