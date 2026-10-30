import { describe, expect, it } from "vitest"
import { BUILTIN_ANALYSES, buildAnalysisFlow } from "./analyses"
import type { ModelCall } from "./ollama"
import { retrieve } from "./retrieve"
import { runFlow } from "./run-flow"
import { askFlow, nightRitualFlow, phoneCaptureFlow, reasonFlow, routedLogFlow, timeGridNoteFlow } from "./task-flows"
import type { Flow, FlowMessage } from "./types"
import type { VaultSnapshot } from "./vault-search"

const snap: VaultSnapshot = {
  items: [],
  lists: [],
  habits: [],
  scopes: [{ id: "activity", name: "Activity", pens: [{ id: "a1", name: "cooking" }] }],
  skipListIds: new Set(),
  datasets: {
    "miss-reasons": {
      id: "miss-reasons",
      label: "Why",
      blurb: "",
      rows: [
        { date: "2026-10-01", source: "Push · no-time", text: "Taxes — no time" },
        { date: "2026-10-08", source: "Push · no-time", text: "Taxes — no time again" },
        { date: "2026-10-09", source: "Habit · no-energy", text: "Stretch — tired" },
      ],
    },
  },
}

const msg = (text: string, entry?: string): FlowMessage => ({ id: "m", text, at: "2026-10-30T12:00:00.000Z", prior: [], entry })

describe("routing", () => {
  it("picks a route by code when a pattern matches, without asking the model", async () => {
    let asked = 0
    const call: ModelCall = async () => (asked++, { routes: ["keeping"] })
    const r = await runFlow(routedLogFlow(), [msg("woke from a dream about school", "bim-text")], call, snap, { model: "t" })
    const route = r.messages[0]!.steps.find((s) => s.nodeId === "r-family")!
    expect((route.output as { by: string }).by).toBe("code")
    expect(route.port).toBe("r:self")
  })

  it("follows only the picked route, so unrelated lanes never run", async () => {
    const call: ModelCall = async ({ schema }) => {
      const props = (schema as { properties: Record<string, unknown> }).properties
      if ("routes" in props) return { routes: ["keeping"] }
      if ("picks" in props) return { picks: [] }
      return {}
    }
    const r = await runFlow(routedLogFlow(), [msg("need more macbook bricks", "bim-text")], call, snap, { model: "t" })
    const ran = new Set(r.messages[0]!.steps.map((s) => s.nodeId))
    expect(ran.has("s-items")).toBe(true)
    expect(ran.has("x-intake")).toBe(false)
    expect(ran.has("s-pens")).toBe(false)
  })

  it("keeps one start node per screen and drops lanes that screen never reaches", () => {
    for (const f of [routedLogFlow(), phoneCaptureFlow(), timeGridNoteFlow(), reasonFlow(), nightRitualFlow()]) {
      expect(f.nodes.filter((x) => x.kind === "message")).toHaveLength(1)
    }
    const grid = timeGridNoteFlow().nodes.map((x) => x.id)
    expect(grid).toContain("r-grid")
    expect(grid).not.toContain("r-family")
    expect(grid).not.toContain("s-pens")
  })

  it("hands a phone fragment that is a question to the Ask flow", async () => {
    const flows: Record<string, Flow> = { ask: askFlow() }
    const call: ModelCall = async ({ schema }) => {
      const props = (schema as { properties: Record<string, unknown> }).properties
      if ("answer" in props && "confidence" in props) return { answer: "ok", confidence: "none", used: [] }
      if ("terms" in props) return { terms: [] }
      return { answer: "yes" }
    }
    const r = await runFlow(phoneCaptureFlow(), [msg("when did i last shower", "phone-capture")], call, snap, { model: "t", getFlow: (id) => flows[id] })
    const hand = r.messages[0]!.steps.find((s) => s.nodeId === "h-ask")!
    expect((hand.output as { handedTo: string }).handedTo).toBe("ask")
  })
})

describe("datasets and insights", () => {
  it("counts a dataset in code, with repeated subjects", async () => {
    const ev = await retrieve(snap, { kind: "dataset", datasetId: "miss-reasons" }, { terms: [], now: new Date("2026-10-30") })
    expect(ev.total).toBe(3)
    expect(ev.facts.join(" ")).toContain("Taxes")
  })

  it("keeps only insights that cite real lines, enough of them", async () => {
    const a = BUILTIN_ANALYSES.find((x) => x.id === "why-recurring")!
    const flow = buildAnalysisFlow({ ...a, minRows: 1 })
    const call: ModelCall = async () => ({
      insights: [
        { kind: "pattern", text: "Taxes get no-time twice.", strength: "strong", cites: [1, 2] },
        { kind: "pattern", text: "Invented thing with a bad cite.", strength: "strong", cites: [99, 100] },
        { kind: "pattern", text: "One line is not a pattern.", strength: "likely", cites: [1] },
      ],
    })
    const r = await runFlow(flow, [msg(a.lens)], call, snap, { model: "t" })
    const first = r.messages[0]!.answers[0]!
    expect(first.insights!.map((i) => i.text)).toEqual(["Taxes get no-time twice."])
    expect(first.dropped).toBe(2)
  })

  it("says so when there are too few rows", async () => {
    const a = BUILTIN_ANALYSES.find((x) => x.id === "why-recurring")!
    const call: ModelCall = async () => ({ insights: [] })
    const r = await runFlow(buildAnalysisFlow({ ...a, minRows: 50 }), [msg(a.lens)], call, snap, { model: "t" })
    expect(r.messages[0]!.answers[0]!.text).toMatch(/Too few rows/)
  })
})
