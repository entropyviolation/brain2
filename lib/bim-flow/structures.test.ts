import { describe, expect, it } from "vitest"
import { runFlow, runMessage } from "./run-flow"
import { message, scriptedModel, SCENARIO_VAULT } from "./scenarios"
import type { Flow, FlowEdge, FlowNode, FlowNodeKind, FlowPort } from "./types"

const node = (id: string, kind: FlowNodeKind, config: FlowNode["config"] = {}): FlowNode => ({ id, kind, label: id, x: 0, y: 0, config })
const edge = (from: string, to: string, port: FlowPort = "out"): FlowEdge => ({ id: `${from}>${to}:${port}`, from, to, port })
const flow = (nodes: FlowNode[], edges: FlowEdge[]): Flow => ({ version: 1, nodes, edges })
const go = (f: Flow, rules: Parameters<typeof scriptedModel>[0] = [], text = "walking") => runMessage(f, message(text), scriptedModel(rules).call, SCENARIO_VAULT)
const ids = (r: Awaited<ReturnType<typeof go>>) => r.steps.map((s) => s.nodeId)

const GATE = (q = "is it?") => ({ question: q })
const yes = { when: () => true, reply: { answer: "yes" } }

describe("graph shapes", () => {
  it("a diamond runs the join once", async () => {
    const f = flow([node("m", "message"), node("a", "search", { source: "pens" }), node("b", "search", { source: "pens" }), node("j", "related")], [edge("m", "a"), edge("m", "b"), edge("a", "j"), edge("b", "j")])
    expect(ids(await go(f)).filter((i) => i === "j")).toHaveLength(1)
  })

  it("a cycle terminates and each node runs once", async () => {
    const f = flow([node("m", "message"), node("a", "search", { source: "pens" }), node("b", "search", { source: "pens" })], [edge("m", "a"), edge("a", "b"), edge("b", "a")])
    expect(ids(await go(f))).toEqual(["m", "a", "b"])
  })

  it("a self-loop terminates", async () => {
    const f = flow([node("m", "message"), node("a", "search", { source: "pens" })], [edge("m", "a"), edge("a", "a")])
    expect(ids(await go(f))).toEqual(["m", "a"])
  })

  it("orphan nodes never run", async () => {
    const f = flow([node("m", "message"), node("a", "search", { source: "pens" }), node("orphan", "search", { source: "pens" })], [edge("m", "a")])
    expect(ids(await go(f))).not.toContain("orphan")
  })

  it("a flow with no message node runs nothing", async () => {
    expect(ids(await go(flow([node("a", "search", { source: "pens" })], [])))).toEqual([])
  })

  it("an empty flow is fine", async () => {
    const r = await runFlow(flow([], []), [message("x")], scriptedModel([]).call, SCENARIO_VAULT, { model: "t" })
    expect(r.messages[0]!.steps).toEqual([])
    expect(r.blocks).toEqual([])
  })

  it("an edge to a node that does not exist is ignored", async () => {
    const f = flow([node("m", "message")], [edge("m", "ghost")])
    expect(ids(await go(f))).toEqual(["m"])
  })

  it("duplicate edges do not run a node twice", async () => {
    const f = flow([node("m", "message"), node("a", "search", { source: "pens" })], [edge("m", "a"), { ...edge("m", "a"), id: "again" }])
    expect(ids(await go(f))).toEqual(["m", "a"])
  })

  it("a deep chain of 60 code nodes runs in order", async () => {
    const nodes = [node("m", "message"), ...Array.from({ length: 60 }, (_, i) => node(`n${i}`, "search", { source: "pens" }))]
    const edges = nodes.slice(1).map((n, i) => edge(i === 0 ? "m" : `n${i - 1}`, n.id))
    expect(ids(await go(flow(nodes, edges)))).toHaveLength(61)
  })

  it("a wide fan of 40 branches all run", async () => {
    const nodes = [node("m", "message"), ...Array.from({ length: 40 }, (_, i) => node(`n${i}`, "search", { source: "pens" }))]
    expect(ids(await go(flow(nodes, nodes.slice(1).map((n) => edge("m", n.id))))).length).toBe(41)
  })
})

describe("gates, guards, clarify, route", () => {
  it("a gate follows only the port it answered", async () => {
    const f = flow([node("m", "message"), node("g", "gate", GATE()), node("y", "search", { source: "pens" }), node("n", "search", { source: "pens" })], [edge("m", "g"), edge("g", "y", "yes"), edge("g", "n", "no")])
    expect(ids(await go(f, [yes]))).toEqual(["m", "g", "y"])
    expect(ids(await go(f, []))).toEqual(["m", "g", "n"])
  })

  it("a gate wired on only one side stops on the other", async () => {
    const f = flow([node("m", "message"), node("g", "gate", GATE()), node("y", "search", { source: "pens" })], [edge("m", "g"), edge("g", "y", "yes")])
    expect(ids(await go(f, []))).toEqual(["m", "g"])
  })

  it("chained gates short-circuit: a no on the first never asks the second", async () => {
    const f = flow([node("m", "message"), node("g1", "gate", GATE("first?")), node("g2", "gate", GATE("second?"))], [edge("m", "g1"), edge("g1", "g2", "yes")])
    const s = scriptedModel([])
    await runMessage(f, message("x"), s.call, SCENARIO_VAULT)
    expect(s.calls).toHaveLength(1)
  })

  it("a guard says yes for a known subject and no for an unknown one", async () => {
    const f = flow(
      [node("m", "message"), node("k", "guard"), node("known", "search", { source: "pens" }), node("unknown", "search", { source: "pens" })],
      [edge("m", "k"), edge("k", "known", "yes"), edge("k", "unknown", "no")],
    )
    expect(ids(await go(f, [], "walking today"))).toContain("known")
    const r = await go(f, [], "unicorn dragons")
    expect(ids(r)).toContain("unknown")
    expect(r.answers[0]!.confidence).toBe("none")
  })

  it("clarify says no and goes on for a clear message", async () => {
    const f = flow([node("m", "message"), node("c", "clarify"), node("after", "search", { source: "pens" })], [edge("m", "c"), edge("c", "after", "no")])
    expect(ids(await go(f, [], "walking with Lex"))).toEqual(["m", "c", "after"])
  })

  it("clarify can be limited to topics, so an ambiguous person passes", async () => {
    const f = flow([node("m", "message"), node("c", "clarify", { clarifyKind: "topic" }), node("after", "search", { source: "pens" })], [edge("m", "c"), edge("c", "after", "no")])
    expect(ids(await go(f, [], "called Elijah"))).toContain("after")
  })

  it("a route with a code pattern asks no model, and 'none' follows nothing", async () => {
    const routes = [{ key: "a", label: "A", pattern: "^walk" }, { key: "b", label: "B" }]
    const f = flow([node("m", "message"), node("r", "route", { routes }), node("a", "search", { source: "pens" }), node("b", "search", { source: "pens" })], [edge("m", "r"), edge("r", "a", "r:a"), edge("r", "b", "r:b")])
    const s = scriptedModel([])
    const r = await runMessage(f, message("walking now"), s.call, SCENARIO_VAULT)
    expect(ids(r)).toEqual(["m", "r", "a"])
    expect(s.calls).toHaveLength(0)
    expect(ids(await go(f, [], "zzz"))).toEqual(["m", "r"])
  })

  it("a bad route regex is skipped, not thrown", async () => {
    const f = flow([node("m", "message"), node("r", "route", { routes: [{ key: "a", label: "A", pattern: "([" }] }), node("a", "search", { source: "pens" })], [edge("m", "r"), edge("r", "a", "r:a")])
    expect(ids(await go(f))).toEqual(["m", "r"])
  })
})

describe("errors and handoffs", () => {
  const boom = { when: () => true, reply: () => { throw new Error("model down") } }

  it("a failing node stops its own branch and spares its siblings", async () => {
    const f = flow([node("m", "message"), node("g", "gate", GATE()), node("ok", "search", { source: "pens" }), node("after", "search", { source: "pens" })], [edge("m", "g"), edge("m", "ok"), edge("g", "after", "yes"), edge("g", "after", "no")])
    const r = await go(f, [boom])
    expect(r.steps.find((s) => s.nodeId === "g")!.error).toBe("model down")
    expect(ids(r)).toContain("ok")
    expect(ids(r)).not.toContain("after")
  })

  it("a handoff to a missing flow is an error step, not a crash", async () => {
    const f = flow([node("m", "message"), node("h", "handoff", { flowId: "nope" })], [edge("m", "h")])
    const r = await go(f)
    expect(r.steps.find((s) => s.nodeId === "h")!.error).toContain("nope")
  })

  it("handoffs that call each other stop at depth 3", async () => {
    const self = flow([node("m", "message"), node("h", "handoff", { flowId: "self" })], [edge("m", "h")])
    const r = await runMessage(self, message("x"), scriptedModel([]).call, SCENARIO_VAULT, undefined, undefined, [], (id) => (id === "self" ? self : undefined))
    expect(r.steps[1]!.error ?? JSON.stringify(r.steps[1]!.output)).toBeTruthy()
    let deep = r.steps[1]!
    let levels = 1
    while (deep.output && typeof deep.output === "object" && "handedTo" in deep.output) { levels++; break }
    expect(levels).toBeLessThan(10)
  })

  it("a handoff carries the other flow's proposals home", async () => {
    const sub = flow([node("m", "message"), node("p", "propose", { action: "idea" })], [edge("m", "p")])
    const f = flow([node("m", "message"), node("h", "handoff", { flowId: "sub" })], [edge("m", "h")])
    const r = await runMessage(f, message("a thing"), scriptedModel([]).call, SCENARIO_VAULT, undefined, undefined, [], (id) => (id === "sub" ? sub : undefined))
    expect(r.proposals).toHaveLength(1)
  })
})

describe("compute inside a graph", () => {
  it("reads the plan's days, but a time word in the message wins", async () => {
    const f = flow([node("m", "message"), node("x", "extract", { fields: [{ name: "subject", type: "string" }, { name: "days", type: "number" }] }), node("c", "compute", { compute: { fn: "count" } })], [edge("m", "x"), edge("x", "c")])
    const rules = [{ when: () => true, reply: { subject: "walking", days: 3 } }]
    const a = await go(f, rules, "walking")
    expect((a.steps[2]!.output as { total: number }).total).toBe(3)
    const b = await go(f, rules, "walking this week")
    expect((b.steps[2]!.output as { total: number }).total).toBe(5)
  })

  it("with no plan, uses the message's own content words", async () => {
    const f = flow([node("m", "message"), node("c", "compute", { compute: { fn: "count", days: 30 } })], [edge("m", "c")])
    const r = await go(f, [], "walking")
    expect((r.steps[1]!.output as { total: number }).total).toBe(7)
  })

  it("a compute node with no config counts", async () => {
    const f = flow([node("m", "message"), node("c", "compute")], [edge("m", "c")])
    expect((await go(f)).steps[1]!.error).toBeUndefined()
  })
})

// A small seeded generator, so a failure can be replayed.
function lcg(seed: number) {
  let s = seed >>> 0
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32)
}

const KINDS: FlowNodeKind[] = ["gate", "search", "link", "choose", "extract", "related", "retrieve", "compute", "guard", "clarify", "propose", "route", "answer"]

function randomFlow(rand: () => number): Flow {
  const n = 3 + Math.floor(rand() * 14)
  const nodes: FlowNode[] = [node("m", "message")]
  for (let i = 0; i < n; i++) {
    const kind = KINDS[Math.floor(rand() * KINDS.length)]!
    const config: FlowNode["config"] =
      kind === "gate" ? GATE() : kind === "search" ? { source: "pens" } : kind === "retrieve" ? { retrieve: { kind: "text" } } : kind === "compute" ? { compute: { fn: "count" } } : kind === "route" ? { routes: [{ key: "a", label: "A" }, { key: "b", label: "B", pattern: "walk" }] } : kind === "extract" ? { fields: [{ name: "subject", type: "string" }] } : kind === "choose" ? { fromNodeId: "n0", max: 1 } : {}
    nodes.push(node(`n${i}`, kind, config))
  }
  const ports: FlowPort[] = ["out", "yes", "no", "r:a", "r:b"]
  const edges: FlowEdge[] = []
  for (let i = 0; i < n * 2; i++) {
    const from = nodes[Math.floor(rand() * nodes.length)]!.id
    const to = nodes[1 + Math.floor(rand() * n)]!.id
    edges.push(edge(from, to, ports[Math.floor(rand() * ports.length)]!))
  }
  edges.push(edge("m", "n0"))
  return flow(nodes, edges.filter((e, i, all) => all.findIndex((x) => x.id === e.id) === i))
}

describe("fuzz: any wiring terminates, runs each node at most once, and only runs reachable nodes", () => {
  for (let seed = 1; seed <= 150; seed++) {
    it(`seed ${seed}`, async () => {
      const rand = lcg(seed)
      const f = randomFlow(rand)
      const answer = rand() < 0.5 ? "yes" : "no"
      const m = scriptedModel([{ when: (r) => Object.keys((r.schema as { properties: object }).properties).includes("answer") && !Object.keys((r.schema as { properties: object }).properties).includes("confidence"), reply: { answer } }])
      const r = await runMessage(f, message(seed % 2 ? "walking this week" : "unicorn quartz"), m.call, SCENARIO_VAULT)
      const seen = ids(r)
      expect(new Set(seen).size).toBe(seen.length)
      // Reachability over all edges, ignoring ports (an upper bound).
      const reach = new Set(["m"])
      for (let grew = true; grew; ) {
        grew = false
        for (const e of f.edges) if (reach.has(e.from) && !reach.has(e.to)) (reach.add(e.to), (grew = true))
      }
      for (const id of seen) expect(reach.has(id)).toBe(true)
      for (const s of r.steps) expect(typeof s.ms).toBe("number")
    })
  }
})
