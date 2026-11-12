import { describe, expect, it } from "vitest"
import { flowDef } from "@/lib/bim-flow/flows"
import type { FlowRun } from "@/lib/bim-flow/types"
import type { HelperRun } from "@/lib/tracking-helper/run"
import { clip, recorder, takenBy, validateTrace } from "./trace"
import { traceOfFlowRun, traceOfHelperRun } from "./trace-adapters"

function clockOf(times: number[]) {
  let i = 0
  return () => times[Math.min(i++, times.length - 1)]!
}

describe("recorder", () => {
  it("builds a Trace with times from the run's start, a cost and a stop reason", () => {
    // began, then one clock read per add (the second add gives its own t0), then finish (clock, end).
    const rec = recorder({ blueprint: { id: "bim-chat", rev: "1" }, input: "how many hours?", origin: "app" }, clockOf([1000, 1010, 1500, 1600, 1600]))
    const first = rec.add({ kind: "decision", actor: "tell", status: "pass" })
    rec.add({ kind: "model-reply", actor: "answer", status: "ok", model: "qwen2.5:14b", parent: first, t0: 20 })
    const trace = rec.finish("done", { text: "10h 30m" })
    expect(trace.run).toMatchObject({ blueprint: { id: "bim-chat", rev: "1" }, origin: "app", input: "how many hours?" })
    expect(trace.events.map((e) => [e.t0, e.t1])).toEqual([
      [10, 10],
      [20, 500],
    ])
    expect(trace.cost).toEqual({ calls: 1, ms: 600, models: { "qwen2.5:14b": { calls: 1, ms: 480 } } })
    expect(trace.stop).toBe("done")
    expect(trace.result).toEqual({ text: "10h 30m", proposals: 0, wrote: [] })
    expect(validateTrace(trace)).toEqual([])
  })

  it("finishes once and takes no events after", () => {
    const rec = recorder({ blueprint: { id: "x", rev: "1" }, input: "", origin: "test" })
    const a = rec.finish("done")
    rec.add({ kind: "decision", actor: "late", status: "ok" })
    expect(rec.finish("error")).toBe(a)
    expect(a.events).toEqual([])
    expect(takenBy(a)).toBeNull()
  })

  it("cuts long data so a Trace fits in storage", () => {
    expect(String(clip("x".repeat(5000))).length).toBeLessThan(2100)
    expect(typeof clip({ rows: "y".repeat(5000) })).toBe("string")
    expect(clip({ small: true })).toEqual({ small: true })
  })

  it("names a parent that comes later, and a doubled id", () => {
    const rec = recorder({ blueprint: { id: "x", rev: "1" }, input: "", origin: "test" })
    rec.add({ kind: "decision", actor: "a", status: "ok", parent: "nope" })
    const trace = rec.finish("done")
    expect(validateTrace(trace).join(" ")).toMatch(/parent/)
    expect(validateTrace({ ...trace, events: [...trace.events, trace.events[0]!] }).join(" ")).toMatch(/twice/)
  })
})

describe("traceOfFlowRun", () => {
  const flow = flowDef("ask").build()
  const message = flow.nodes.find((n) => n.kind === "message")!
  const answer = flow.nodes.find((n) => n.kind === "answer")!
  const retrieve = flow.nodes.find((n) => n.kind === "retrieve")!
  const run: FlowRun = {
    model: "qwen2.5:14b",
    startedAt: "2026-11-11T10:00:00.000Z",
    ms: 4200,
    blocks: [],
    messages: [
      {
        message: { id: "m1", text: "when did I last see Shelby?", at: "2026-11-11T10:00:00.000Z", prior: [] },
        steps: [
          { nodeId: message.id, ms: 0, port: "out", output: null },
          { nodeId: retrieve.id, ms: 200, port: "out", output: { rows: 3 } },
          { nodeId: answer.id, ms: 4000, port: "out", output: { text: "July 5th" }, prompt: "QUESTION …" },
        ],
        proposals: [],
        signals: [],
        answers: [{ nodeId: answer.id, mode: "answer", text: "July 5th", confidence: "high", evidence: [], used: [], facts: [] }],
      },
    ],
  }

  it("nests each step under its message and counts the model calls", () => {
    const trace = traceOfFlowRun(flow, run, { flowId: "ask", origin: "app" })
    expect(trace.run.blueprint.id).toBe("bim-flow:ask")
    expect(trace.events.map((e) => e.kind)).toEqual(["sense", "sense", "memory-read", "model-reply"])
    expect(trace.events.slice(1).every((e) => e.parent === trace.events[0]!.id)).toBe(true)
    expect(trace.events[3]).toMatchObject({ actor: answer.id, model: "qwen2.5:14b", t0: 200, t1: 4200 })
    expect(trace.cost).toMatchObject({ calls: 1, ms: 4200 })
    expect(trace.stop).toBe("done")
    expect(trace.result.text).toBe("July 5th")
    expect(validateTrace(trace)).toEqual([])
  })

  it("stops as an error when a step failed", () => {
    const broken: FlowRun = { ...run, messages: [{ ...run.messages[0]!, steps: [{ nodeId: answer.id, ms: 5, port: "out", output: null, error: "timeout" }], answers: [] }] }
    const trace = traceOfFlowRun(flow, broken, { flowId: "ask", origin: "test" })
    expect(trace.stop).toBe("error")
    expect(trace.events[1]).toMatchObject({ kind: "error", status: "error", note: "timeout" })
  })
})

describe("traceOfHelperRun", () => {
  const base: HelperRun = {
    route: "log",
    text: "walked 4:30 to 5",
    marked: "walked [t1] to [t2]",
    trace: [
      { stage: "route", ms: 1, note: "log" },
      { stage: "tokenize", ms: 2, note: "2 times" },
      { stage: "wire", ms: 900, note: "1 segment", model: "qwen2.5:14b", prompt: "…", output: {} },
      { stage: "place", ms: 3, note: "1 block" },
    ],
    model: "qwen2.5:14b",
    skillsUsed: [],
    blocks: [{} as HelperRun["blocks"][number]],
    unplaced: [],
  }
  const opts = { origin: "app" as const, input: "walked 4:30 to 5", startedAt: "2026-11-11T10:00:00.000Z" }

  it("reads the stages in order and the blocks as a proposal", () => {
    const trace = traceOfHelperRun(base, opts)
    expect(trace.run.blueprint.id).toBe("tracking-helper")
    expect(trace.events.map((e) => `${e.actor}:${e.kind}`)).toEqual(["route:decision", "tokenize:sense", "wire:model-reply", "place:tool-result", "blocks:propose"])
    expect(trace.cost).toEqual({ calls: 1, ms: 906, models: { "qwen2.5:14b": { calls: 1, ms: 900 } } })
    expect(trace.result.proposals).toBe(1)
    expect(trace.stop).toBe("done")
    expect(validateTrace(trace)).toEqual([])
  })

  it("counts no model call when rules answered, and names the two early stops", () => {
    const rules = traceOfHelperRun({ ...base, trace: [{ stage: "wire", ms: 4, note: "rules" }], model: undefined, fallback: "no model" }, opts)
    expect(rules.cost.calls).toBe(0)
    expect(traceOfHelperRun({ ...base, route: "question", trace: [base.trace[0]!], blocks: [] }, opts).stop).toBe("gate-no")
    expect(traceOfHelperRun({ ...base, blocks: [], unplaced: ["did dishes"] }, opts).stop).toBe("needs-person")
  })
})
