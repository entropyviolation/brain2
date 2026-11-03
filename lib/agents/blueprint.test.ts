import { describe, expect, it } from "vitest"
import { FLOWS } from "@/lib/bim-flow/flows"
import type { FlowNodeKind } from "@/lib/bim-flow/types"
import { starterFlow } from "@/lib/tracking-helper/flow"
import { bimBlueprint, bimBlueprints, flowOfBlueprint } from "./adapters/bim-flow"
import { HELPER_STAGES, helperBlueprint, helperOfBlueprint } from "./adapters/tracking-helper"
import { ENVELOPE_KEYS, NODE_TAG, validateBlueprint, type Blueprint } from "./blueprint"
import { builtinBlueprints, getBlueprint, listBlueprints, registerBlueprint, unregisterBlueprint } from "./registry"
import { agentLabHref } from "@/components/Lab/Agents/agent-href"
import { starterFlow as habitStarter } from "@/lib/habit-helper/flow"
import { HABITS_BIMBY_STAGES, habitsBimbyBlueprint, habitsBimbyOfBlueprint } from "./adapters/habit-helper"

const roundTrip = <T,>(x: T): T => JSON.parse(JSON.stringify(x)) as T

describe("BIM flows as Blueprints", () => {
  it("makes one sound Blueprint per shipped flow", () => {
    const all = bimBlueprints()
    expect(all.map((b) => b.id)).toEqual(FLOWS.map((f) => `bim-flow:${f.id}`))
    for (const b of all) expect(validateBlueprint(b), b.id).toEqual([])
  })

  it("carries the flow as it is, and survives a JSON round trip", () => {
    for (const def of FLOWS) {
      const flow = def.build()
      const b = bimBlueprint(def, flow)
      expect(flowOfBlueprint(b)).toBe(flow)
      expect(flowOfBlueprint(roundTrip(b))).toEqual(flow)
    }
  })

  it("reads tools, memory, and proposals from the nodes", () => {
    const log = bimBlueprints().find((b) => b.id === "bim-flow:log")!
    expect(log.tools.map((t) => t.name)).toContain("vault-search")
    expect(log.memory.reads).toContain("semantic")
    expect(log.door.proposes.length).toBeGreaterThan(0)
    expect(log.memory.writes).toEqual([])
    const day = bimBlueprints().find((b) => b.id === "bim-flow:day")!
    expect(day.senses).toEqual(["day"])
    expect(day.memory.reads).toContain("episodic")
  })

  it("shows a saved copy instead of the shipped graph", () => {
    const def = FLOWS[0]!
    const saved = def.build()
    saved.nodes = saved.nodes.slice(0, 2)
    const b = bimBlueprints({ [def.id]: { flow: saved, rev: "mine" } })[0]!
    expect(b.rev).toBe("mine")
    expect(flowOfBlueprint(b)?.nodes).toHaveLength(2)
  })

  it("tags every node kind a shipped flow uses with a role", () => {
    const used = new Set<FlowNodeKind>()
    for (const def of FLOWS) for (const n of def.build().nodes) used.add(n.kind)
    for (const k of used) expect(NODE_TAG[k], k).toBeDefined()
  })
})

describe("Tracking helper as a Blueprint", () => {
  it("is sound, a pipeline of five stages with one model call", () => {
    const b = helperBlueprint()
    expect(validateBlueprint(b)).toEqual([])
    expect(b.mind.kind).toBe("pipeline")
    expect(HELPER_STAGES.map((s) => s.id)).toEqual(["route", "tokenize", "wire", "place", "where"])
    expect(HELPER_STAGES.filter((s) => s.cost !== "code").map((s) => s.id)).toEqual(["wire"])
    expect(b.limits.maxCalls).toBe(1)
  })

  it("is the Tracking BIMBY: the timeblock pipeline and the gap questions pipeline are its tools, two more are planned", () => {
    const b = helperBlueprint()
    expect(b.name).toBe("Tracking BIMBY")
    const ps = b.mind.kind === "pipeline" ? b.mind.pipelines ?? [] : []
    expect(ps.filter((p) => p.status === "built").map((p) => p.id)).toEqual(["description-to-timeblock", "generate-gap-questions"])
    expect(ps.filter((p) => p.status === "planned")).toHaveLength(2)
    expect(ps.flatMap((p) => (p.asTool ? [p.asTool] : [])).sort()).toEqual(b.tools.map((t) => t.name).sort())
    expect(ps[1]!.stages.every((s) => s.cost === "code")).toBe(true)
  })

  it("carries the flow as it is, and survives a JSON round trip", () => {
    const flow = starterFlow()
    flow.wire.extra = "one more fix"
    const b = helperBlueprint(flow)
    expect(helperOfBlueprint(b)).toBe(flow)
    expect(helperOfBlueprint(roundTrip(b))).toEqual(flow)
    expect(b.rev).toBe(flow.rev)
  })

  it("reports a pinned ladder", () => {
    const flow = starterFlow()
    flow.wire.ladder = ["qwen2.5:14b-instruct"]
    expect(helperBlueprint(flow).models.ladders).toEqual({ extract: ["qwen2.5:14b-instruct"] })
  })
})

describe("one envelope for every agent", () => {
  it("gives the BIM flows and the Helper the same keys in the same order", () => {
    for (const b of builtinBlueprints()) expect(Object.keys(b), b.id).toEqual([...ENVELOPE_KEYS])
  })

  it("keeps ids unique", () => {
    const ids = builtinBlueprints().map((b) => b.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe("validateBlueprint", () => {
  const base = (): Blueprint => helperBlueprint()

  it("names what is wrong", () => {
    const b = base()
    b.owner = "somebody" as Blueprint["owner"]
    b.limits = { maxCalls: 0 }
    b.tools = [{ name: "x", writes: false }, { name: "x", writes: false }]
    const problems = validateBlueprint(b)
    expect(problems.some((p) => p.includes("owner"))).toBe(true)
    expect(problems.some((p) => p.includes("maxCalls"))).toBe(true)
    expect(problems.some((p) => p.includes("listed twice"))).toBe(true)
  })

  it("catches a graph with a dangling edge and no message node", () => {
    const b = bimBlueprint(FLOWS[0]!, { version: 1, nodes: [{ id: "a", kind: "gate", label: "g", x: 0, y: 0, config: {} }], edges: [{ id: "e", from: "a", to: "zz", port: "yes" }] })
    const problems = validateBlueprint(b)
    expect(problems.some((p) => p.includes("missing node"))).toBe(true)
    expect(problems.some((p) => p.includes("no message node"))).toBe(true)
  })
})

describe("registry", () => {
  it("adds a module agent, lists it after the shipped ones, and refuses a reused id", () => {
    const mine: Blueprint = { ...helperBlueprint(), id: "module:budget:helper", name: "Budget helper", owner: "module:budget" }
    registerBlueprint(mine)
    try {
      const ids = listBlueprints().map((b) => b.id)
      expect(ids[ids.length - 1]).toBe("module:budget:helper")
      expect(getBlueprint("module:budget:helper")?.owner).toBe("module:budget")
      expect(() => registerBlueprint(mine)).toThrow(/already taken/)
      expect(() => registerBlueprint({ ...mine, id: "tracking-helper" })).toThrow(/already taken/)
    } finally {
      unregisterBlueprint("module:budget:helper")
    }
    expect(getBlueprint("module:budget:helper")).toBeUndefined()
  })

  it("refuses an unsound Blueprint", () => {
    expect(() => registerBlueprint({ ...helperBlueprint(), id: "bad", name: "" })).toThrow(/not sound/)
  })
})

describe("Habits BIMBY as a Blueprint", () => {
  it("is sound, a pipeline of five stages with one model call, and its flow round-trips", () => {
    const flow = habitStarter()
    flow.match.extra = "one more fix"
    const b = habitsBimbyBlueprint(flow)
    expect(validateBlueprint(b)).toEqual([])
    expect(HABITS_BIMBY_STAGES.filter((s) => s.cost !== "code").map((s) => s.id)).toEqual(["match"])
    expect(habitsBimbyOfBlueprint(roundTrip(b))).toEqual(flow)
    expect(helperOfBlueprint(b)).toBeNull()
    expect(habitsBimbyOfBlueprint(helperBlueprint())).toBeNull()
    expect(agentLabHref(b)).toBe("/lab/habit-helper")
  })
})
