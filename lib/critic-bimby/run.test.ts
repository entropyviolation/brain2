import { describe, expect, it } from "vitest"
import type { ModelCall } from "@/lib/bim-flow/ollama"
import type { PlanDraft, PlanItem } from "@/lib/plan-bimby/types"
import { runBench, runBenchAsync, GOLD } from "./bench"
import { DIALS, gateOf, isReady, modelLayerOn, recordGate, setModelLayer } from "./gate"
import { criticUser, findingsOf, renderPlan } from "./prompt"
import { critiqueWithModel, modelReason, traceLines } from "./run"
import { faultsFor } from "./inject"

const row = (title: string, extra: Partial<PlanItem> = {}): PlanItem => ({ id: title, title, subtasks: [], pace: "steady", ...extra })
const LINE = "make tea, sort mail, wash the car, call mom, then fix the bicycle"
const big = (extra: Partial<PlanDraft> = {}): PlanDraft => ({
  source: LINE,
  remarks: [],
  by: "model",
  model: "planner",
  items: [row("make tea"), row("sort mail"), row("wash car"), row("call mom"), row("fix bicycle")],
  ...extra,
})
const ready = () => true

/** A model that answers from a queue, and remembers what it was asked. */
function scripted(...answers: unknown[]): ModelCall & { calls: { model?: string; user: string }[] } {
  const calls: { model?: string; user: string }[] = []
  const fn = (async (req: { model?: string; user: string }) => {
    calls.push({ model: req.model, user: req.user })
    const a = answers.length > 1 ? answers.shift() : answers[0]
    if (a instanceof Error) throw a
    return a
  }) as unknown as ModelCall & { calls: typeof calls }
  fn.calls = calls
  return fn
}
const none = { rows: [], missing: [], unsure: false }

describe("when the model layer runs", () => {
  it("not on a small clean plan from a model", () => {
    expect(modelReason({ ...big(), items: [row("make tea")] }, [])).toBeNull()
  })
  it("on a big plan, a rules read, or an unconfirmed task link", () => {
    expect(modelReason(big(), [])).toMatch(/big/)
    expect(modelReason({ ...big(), items: [row("a")], by: "rules" }, [])).toMatch(/rules/)
    expect(modelReason({ ...big(), items: [row("a", { link: { kind: "task", taskId: "t", title: "A", confirmed: false } })] }, [])).toMatch(/link/)
  })
  it("never when the free checks already failed it", () => {
    expect(modelReason(big(), [{ kind: "invented", where: "x", reason: "", by: "code", strength: "certain" }])).toBeNull()
  })
})

describe("critiqueWithModel", () => {
  it("skips the call when the free checks already fail the plan", async () => {
    const call = scripted(none)
    const c = await critiqueWithModel({ draft: big({ items: [row("make tea", { minutes: 12 })] }), call, ladder: ["critic"], ready })
    expect(c.verdict).toBe("fail")
    expect(call.calls).toHaveLength(0)
    expect(c.skipped).toMatch(/already failed/)
  })
  it("skips when no model has passed the bench", async () => {
    const call = scripted(none)
    const c = await critiqueWithModel({ draft: big(), call, ladder: ["critic"], ready: () => false })
    expect(call.calls).toHaveLength(0)
    expect(c.skipped).toMatch(/bench/)
    expect(c.trust).toBe("code-only")
  })
  it("passes when the model finds nothing", async () => {
    const call = scripted(none)
    const c = await critiqueWithModel({ draft: big(), call, ladder: ["critic"], ready })
    expect(c).toMatchObject({ verdict: "pass", trust: "full", model: "critic" })
    expect(call.calls[0]!.user.startsWith("LINE: ")).toBe(true)
  })
  it("warns on one quoted finding and fails on two", async () => {
    const one = { ...none, rows: [{ n: 2, kind: "invented", quote: "sort mail", reason: "not asked" }] }
    expect((await critiqueWithModel({ draft: big(), call: scripted(one), ladder: ["critic"], ready })).verdict).toBe("warn")
    const two = { ...one, missing: [{ quote: "fix the bicycle", reason: "no row" }] }
    const c = await critiqueWithModel({ draft: big(), call: scripted(two), ladder: ["critic"], ready })
    expect(c.verdict).toBe("fail")
    expect(c.findings.every((x) => x.by === "model" && x.strength === "hint")).toBe(true)
  })
  it("drops a finding whose quote is not in the line", async () => {
    const lie = { ...none, rows: [{ n: 1, kind: "invented", quote: "buy a yacht", reason: "x" }, { n: 2, kind: "invented", quote: "", reason: "x" }] }
    const c = await critiqueWithModel({ draft: big(), call: scripted(lie), ladder: ["critic"], ready })
    expect(c.findings).toEqual([])
    expect(c.verdict).toBe("pass")
  })
  it("uses a model other than the planner's, and says so", async () => {
    const call = scripted(none)
    const c = await critiqueWithModel({ draft: big({ model: "critic" }), call, ladder: ["critic", "other"], ready })
    expect(call.calls[0]!.model).toBe("other")
    expect(c.trust).toBe("full")
  })
  it("marks a critic that shares the planner's model, and it can only warn", async () => {
    const two = { rows: [{ n: 1, kind: "invented", quote: "make tea", reason: "x" }, { n: 2, kind: "invented", quote: "sort mail", reason: "x" }], missing: [], unsure: false }
    const c = await critiqueWithModel({ draft: big({ model: "critic" }), call: scripted(two), ladder: ["critic"], ready })
    expect(c.trust).toBe("same-model")
    expect(c.verdict).toBe("warn")
  })
  it("climbs one rung when unsure, and stops there", async () => {
    const call = scripted({ ...none, unsure: true }, none)
    const c = await critiqueWithModel({ draft: big(), call, ladder: ["a", "b", "c"], ready })
    expect(call.calls.map((x) => x.model)).toEqual(["a", "b"])
    expect(c.hops).toHaveLength(2)
    expect(c.hops[0]!.why).toMatch(/unsure/)
  })
  it("falls back to the free checks on an error or a timeout", async () => {
    const err = await critiqueWithModel({ draft: big(), call: scripted(new Error("down")), ladder: ["critic"], ready })
    expect(err.skipped).toMatch(/no usable answer/)
    const slow = (() => new Promise(() => {})) as unknown as ModelCall
    const late = await critiqueWithModel({ draft: big(), call: slow, ladder: ["critic"], ready, maxMs: 20 })
    expect(late.skipped).toMatch(/too long/)
    expect(late.verdict).toBe("pass")
  })
  it("does not repeat a doubt the free checks already raised", async () => {
    const d = big({ items: [row("make tea"), row("sort mail"), row("wash car"), row("call mom")] })
    const say = { ...none, missing: [{ quote: "fix the bicycle", reason: "no row" }] }
    const c = await critiqueWithModel({ draft: d, call: scripted(say), ladder: ["critic"], ready })
    expect(c.findings.filter((x) => x.kind === "dropped")).toHaveLength(1)
  })
})

describe("prompt", () => {
  it("shows the line first and numbers the rows", () => {
    expect(criticUser(big()).split("\n")[0]).toBe(`LINE: ${LINE}`)
    expect(renderPlan({ items: [row("a", { minutes: 5, link: { kind: "intake", label: "tea", intakeClass: "drink" }, subtasks: [{ id: "s", title: "x", due: "by 8" }] })], remarks: ["happy"] })).toBe(
      '1. a | 5 min | parts: x (by 8) | also: logs tea\nNOT TASKS (asides): happy',
    )
  })
  it("turns an answer into model hints and ignores ok rows and strays", () => {
    const f = findingsOf({ rows: [{ n: 1, kind: "ok", quote: "", reason: "" }, { n: 9, kind: "invented", quote: "x", reason: "x" }, { n: 2, kind: "bogus", quote: "x", reason: "" }, { n: 2, kind: "invented", quote: "sort mail", reason: "" }], missing: [{ quote: "" }, { quote: "fix it" }] }, big().items)
    expect(f.map((x) => `${x.kind}:${x.where}`)).toEqual(["invented:sort mail", "dropped:plan"])
    expect(f[0]!.reason).toMatch(/may not match/)
  })
  it("traces what happened", () => {
    expect(traceLines({ verdict: "pass", findings: [], trust: "code-only", hops: [], ms: 1, skipped: "no model reachable" })[0]).toMatch(/free checks only \(no model reachable\)/)
  })
})

describe("gate", () => {
  const mem = () => {
    const m = new Map<string, string>()
    return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) }
  }
  const code = runBench()
  it("the free checks cannot see a wrong object, so a model has room to add", () => {
    const o = code.byFault["wrong-object"]!
    expect(o.of).toBeGreaterThan(2)
    expect(o.caught).toBe(0)
  })
  it("a critic that catches everything and cries wolf never passes", async () => {
    const wolf = await runBenchAsync(async (d) => ({ verdict: "warn", trust: "full", hops: [], ms: 0, findings: [{ kind: "invented", where: d.items[0]!.id, reason: "x", by: "model", strength: "hint" }] }))
    const g = gateOf(code, wolf)
    expect(g.ready).toBe(false)
    expect(g.why.join(" ")).toMatch(/clean plans/)
  })
  it("a critic that sees the faults the free checks miss, and nothing else, passes", async () => {
    const smart = await runBenchAsync(async (d) => {
      const base = (await import("./verdict")).critiquePlan(d)
      const bad = d.items.find((i) => i.title.endsWith(" garage"))
      const extra = bad && !base.findings.length ? [{ kind: "invented" as const, where: bad.id, reason: "x", by: "model" as const, strength: "hint" as const }] : []
      return { ...base, findings: [...base.findings, ...extra] }
    })
    const g = gateOf(code, smart)
    expect(g.ready, g.why.join("; ")).toBe(true)
    expect(g.margin).toBeGreaterThanOrEqual(DIALS.marginAtLeast)
  })
  it("remembers passes per model and host, and forgets them when the dials change", () => {
    const s = mem()
    expect(isReady("plan", "m", s)).toBe(false)
    recordGate("plan", "m", { ready: true, catchRate: 1, falseAlarmRate: 0, margin: 1, why: [] }, s)
    expect(isReady("plan", "m", s)).toBe(true)
    expect(isReady("plan", "other", s)).toBe(false)
    expect(isReady("tracking", "m", s)).toBe(false)
    s.setItem("critic-ready-v1", JSON.stringify({ rev: 0, models: { "plan:m": { ready: true } } }))
    expect(isReady("plan", "m", s)).toBe(false)
  })
  it("keeps the model layer off until the person turns it on", () => {
    const s = mem()
    expect(modelLayerOn(s)).toBe(false)
    setModelLayer(true, s)
    expect(modelLayerOn(s)).toBe(true)
    setModelLayer(false, s)
    expect(modelLayerOn(s)).toBe(false)
  })
})

describe("wrong-object fault", () => {
  it("is made on gold plans and keeps a word the person said", () => {
    const f = GOLD.flatMap((g) => faultsFor(g).filter((x) => x.fault === "wrong-object"))
    expect(f.length).toBeGreaterThan(2)
    for (const x of f) expect(x.draft.items.some((i) => i.title.endsWith(" garage"))).toBe(true)
  })
})
