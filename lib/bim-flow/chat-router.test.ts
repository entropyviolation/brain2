import { describe, expect, it } from "vitest"
import { routeByCode, routeChat } from "./chat-router"
import { crewFor, escalate } from "./crew"
import type { ModelCall } from "./ollama"

/** A model that answers by name, recording who was asked. */
function models(byModel: Record<string, unknown>) {
  const asked: string[] = []
  const call: ModelCall = async ({ model }) => {
    asked.push(model!)
    const out = byModel[model!]
    if (out instanceof Error) throw out
    return out
  }
  return { call, asked }
}

const LADDER = ["small", "big"]

describe("routeByCode", () => {
  it("settles plain questions and build requests with no model", () => {
    expect(routeByCode("when did I last see Shelby?")).toMatchObject({ intent: "ask", sure: true })
    expect(routeByCode("how many hours of computer work this week")).toMatchObject({ intent: "ask", sure: true })
    expect(routeByCode("make a new daily habit for being home")).toMatchObject({ intent: "build", sure: true })
  })

  it("only hints at a bare question mark, and leaves a log line alone", () => {
    expect(routeByCode("garlic confit tonight?")).toMatchObject({ intent: "ask", sure: false })
    expect(routeByCode("making garlic confit now")).toBeNull()
  })
})

describe("routeChat", () => {
  it("never asks a model when code is sure", async () => {
    const m = models({})
    const r = await routeChat("when did I last shower?", m.call, LADDER)
    expect(r).toMatchObject({ intent: "ask", answeredBy: "code" })
    expect(m.asked).toEqual([])
  })

  it("keeps the small model's sure label", async () => {
    const m = models({ small: { intent: "log", second: "none", sure: "high", why: "cooking now" } })
    const r = await routeChat("making garlic confit now", m.call, LADDER)
    expect(r).toMatchObject({ intent: "log", sure: true, answeredBy: "model" })
    expect(r.second).toBeUndefined()
    expect(m.asked).toEqual(["small"])
  })

  it("climbs when the small model is unsure", async () => {
    const m = models({
      small: { intent: "chat", second: "none", sure: "low", why: "" },
      big: { intent: "log", second: "ask", sure: "high", why: "two things" },
    })
    const r = await routeChat("back from Sam's, did I take my meds", m.call, LADDER)
    expect(m.asked).toEqual(["small", "big"])
    expect(r).toMatchObject({ intent: "log", second: "ask", sure: true })
    expect(r.hops[0]!.why).toBe("unsure")
  })

  it("climbs when the small model fights a code hint", async () => {
    const m = models({
      small: { intent: "log", second: "none", sure: "high", why: "" },
      big: { intent: "ask", second: "none", sure: "high", why: "" },
    })
    const r = await routeChat("garlic confit tonight?", m.call, LADDER)
    expect(r.intent).toBe("ask")
    expect(r.hops[0]!.why).toBe("code saw ask")
  })

  it("falls back to code when every model fails", async () => {
    const m = models({ small: new Error("down"), big: new Error("down") })
    const r = await routeChat("garlic confit tonight?", m.call, LADDER)
    expect(r).toMatchObject({ intent: "ask", answeredBy: "code", sure: false })
  })
})

describe("crew", () => {
  it("keeps only installed models, smallest first", () => {
    const crew = crewFor(["qwen2.5:14b-instruct", "qwen2.5:3b-instruct"])!
    expect(crew.route).toEqual(["qwen2.5:3b-instruct", "qwen2.5:14b-instruct"])
    expect(crew.prose).toEqual(["qwen2.5:14b-instruct"])
    expect(crew.main).toBe("qwen2.5:14b-instruct")
    expect(crewFor([])).toBeNull()
  })

  it("escalate keeps the last rung's answer even when unsure", async () => {
    const m = models({ small: { ok: false }, big: { ok: false } })
    const r = await escalate<{ ok: boolean }>(m.call, LADDER, { system: "", user: "", schema: {} }, (o) => (o.ok ? null : "no"))
    expect(r.out).toEqual({ ok: false })
    expect(r.hops.map((h) => h.model)).toEqual(["small", "big"])
  })
})
