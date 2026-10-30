/**
 * Opt-in: the new flows against a real local model, on the made-up week in `scenarios.ts`.
 * `BIM_LIVE=1 npx vitest run lib/bim-flow/scenarios.live.test.ts`
 * Needs Ollama with the model (BIM_MODEL, default qwen2.5:14b-instruct). The
 * vault is the fixture, so the right numbers are known; each case names a
 * number code must have counted and checks the model repeated it. Results go
 * to the scratchpad dir named by BIM_LIVE_OUT, else are only printed.
 */
import fs from "node:fs"
import { describe, expect, it } from "vitest"
import { DEFAULT_MODEL, ollamaCall } from "./ollama"
import { runFlow } from "./run-flow"
import { message, SCENARIO_VAULT } from "./scenarios"
import { askCalcFlow, grammarFirstFlow, routedLogFlow } from "./task-flows"
import type { Flow } from "./types"

const live = process.env.BIM_LIVE === "1"
const model = process.env.BIM_MODEL ?? DEFAULT_MODEL

const CASES: { q: string; lane: string; expect: RegExp }[] = [
  { q: "how many hours did i spend on brain2 this week?", lane: "c-minutes", expect: /10\s*(h|hours?)\s*(and\s*)?30|630/ },
  { q: "how many days in a row have i walked?", lane: "c-streak", expect: /\b5\b|five/i },
  { q: "how long since i last showered?", lane: "c-since", expect: /\b2\b|two/i },
  { q: "what is the longest i have gone without the gym this month?", lane: "c-gap", expect: /17/ },
  { q: "am i walking more this week than last week?", lane: "c-compare", expect: /more|3h 15|195|\+/i },
  { q: "how many times did i walk in the last 3 days?", lane: "c-count", expect: /\b3\b|three/i },
  { q: "how long did i spend walking yesterday?", lane: "c-minutes", expect: /45/ },
]

describe.skipIf(!live)("live: ask-calc on the fixture week", () => {
  const out: unknown[] = []
  for (const c of CASES) {
    it(c.q, async () => {
      const r = await runFlow(askCalcFlow(), [message(c.q)], ollamaCall(model), SCENARIO_VAULT, { model })
      const steps = r.messages[0]!.steps
      const ran = steps.map((s) => s.nodeId)
      const text = r.messages[0]!.answers.map((a) => a.text).join(" | ")
      out.push({ q: c.q, want: c.lane, ran, answer: text, ms: r.ms })
      console.log(`${c.q}\n  lanes: ${ran.filter((i) => i.startsWith("c-")).join(",") || "(none)"}  ${r.ms}ms\n  ${text}`)
      expect(ran).toContain(c.lane)
      expect(text).toMatch(c.expect)
    }, 180_000)
  }
  it("saves", () => {
    if (process.env.BIM_LIVE_OUT) fs.writeFileSync(process.env.BIM_LIVE_OUT, JSON.stringify(out, null, 2))
  })
})

describe.skipIf(!live)("live: grammar first and the unknown guard", () => {
  const flows: Record<string, Flow> = { "log-routed": routedLogFlow() }
  it("a verb line costs no model call; a plain line does", async () => {
    const call = ollamaCall(model)
    let n = 0
    const counted: typeof call = (r) => (n++, call(r))
    await runFlow(grammarFirstFlow(), [message("dh: stretch", { entry: "bim-text" })], counted, SCENARIO_VAULT, { model, getFlow: (id) => flows[id] })
    expect(n).toBe(0)
    await runFlow(grammarFirstFlow(), [message("making garlic confit now", { entry: "bim-text" })], counted, SCENARIO_VAULT, { model, getFlow: (id) => flows[id] })
    expect(n).toBeGreaterThan(0)
  }, 180_000)
  it("stops a question about Mars at the guard", async () => {
    const r = await runFlow(askCalcFlow(), [message("what color were my socks on my trip to mars?")], ollamaCall(model), SCENARIO_VAULT, { model })
    expect(r.messages[0]!.answers[0]!.confidence).toBe("none")
    expect(r.messages[0]!.steps.some((s) => s.nodeId.startsWith("g-"))).toBe(false)
  }, 180_000)
})
