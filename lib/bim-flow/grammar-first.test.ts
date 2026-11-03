import { describe, expect, it } from "vitest"
import { runFlow } from "./run-flow"
import { message, scriptedModel, SCENARIO_VAULT } from "./scenarios"
import { grammarFirstFlow, routedLogFlow } from "./task-flows"
import type { Flow } from "./types"

const flows: Record<string, Flow> = { "log-routed": routedLogFlow() }

async function door(text: string) {
  const m = scriptedModel([])
  const r = await runFlow(grammarFirstFlow(), [message(text, { entry: "bim-text" })], m.call, SCENARIO_VAULT, { model: "t", getFlow: (id) => flows[id] })
  const route = r.messages[0]!.steps.find((s) => s.nodeId === "r-verb")!
  return { route: (route.output as { routes: string[]; by: string }).routes[0], by: (route.output as { by: string }).by, ran: r.messages[0]!.steps.map((s) => s.nodeId), calls: m.calls.length }
}

describe("grammar first: BIM's own verbs never reach a model at the front door", () => {
  const cases: [string, string][] = [
    ["groc", "read"],
    ["GROC", "read"],
    ["lists", "read"],
    ["info", "read"],
    ["ping?", "read"],
    ["all commands", "read"],
    ["https://example.com/a-recipe", "link"],
    ["www.example.com garlic confit ideas", "link"],
    ["  https://example.com with leading spaces", "link"],
    ["dh: hemisync", "habit"],
    ["dh:studied for 20 min", "habit"],
    ["DH: Stretch", "habit"],
    ["intake: addy 20mg", "intake"],
    ["log: making garlic confit now", "log"],
    ["Log:  walking", "log"],
    ["making garlic confit now", "free"],
    ["need more macbook bricks", "free"],
    ["woke from a dream about school", "free"],
    ["écrit un peu de français ce matin", "free"],
    ["o x2", "free"],
    ["check out https://example.com later", "free"],
    ["log without a colon", "free"],
    ["dh:", "free"],
    ["information about trains", "free"],
  ]
  for (const [text, want] of cases) {
    it(`"${text}" → ${want}, decided by code`, async () => {
      const o = await door(text)
      expect(o.route).toBe(want)
      expect(o.by).toBe("code")
    })
  }

  it("a verb line writes its proposal with no model call at all", async () => {
    for (const t of ["https://example.com/x", "dh: stretch", "intake: coffee"]) {
      const o = await door(t)
      expect(o.calls).toBe(0)
      expect(o.ran).toHaveLength(3)
    }
  })

  it("a read command follows nothing", async () => {
    expect((await door("groc")).ran).toEqual(["s-bim", "r-verb"])
  })

  it("a plain line is handed to the routed log flow, which then asks the model", async () => {
    const o = await door("making garlic confit now")
    expect(o.ran).toContain("h-free")
    expect(o.calls).toBeGreaterThan(0)
  })

  it("first match wins when two verbs could apply", async () => {
    expect((await door("https://x.com log: no")).route).toBe("link")
  })
})
