/**
 * lib/agents/adapters/bim-flow.ts — A BIM flow, seen as a Blueprint
 *
 * Reads a `Flow` (the shipped one or a saved copy) and fills the envelope from what its nodes already say:
 * the tools are the kinds of node it uses, the memory it reads follows each search and retrieve node, what
 * it may propose is its `propose` actions, and the models are the ones pinned on nodes. The flow is carried
 * as it is, so `flowOfBlueprint` hands the old runtime exactly what it expects.
 */

import { FLOWS, FLOW_REV, type FlowDef, type InputKind } from "@/lib/bim-flow/flows"
import type { Flow, FlowNode, RetrieveKind } from "@/lib/bim-flow/types"
import type { Blueprint, MemoryKind, SenseKind, ToolUse } from "../blueprint"

export const BIM_SURFACE = "bim-flow"
const DEFAULT_REV = "shipped"

const SENSE_OF_INPUT: Record<InputKind, SenseKind> = { messages: "message", question: "question", day: "day" }

/** The tool each node kind stands for. Kinds that only steer (route, gate, context…) call no tool. */
const TOOL_OF_KIND: Partial<Record<FlowNode["kind"], string>> = {
  search: "vault-search",
  retrieve: "retrieve",
  compute: "compute",
  blocks: "assemble-blocks",
  link: "entity-link",
  related: "related-terms",
  extract: "extract-fields",
  choose: "pick-one",
  answer: "answer-from-evidence",
  question: "ask-person",
  clarify: "ask-person",
}

const MEMORY_OF_RETRIEVE: Record<RetrieveKind, MemoryKind[]> = {
  entries: ["episodic"],
  text: ["episodic"],
  overlap: ["episodic", "semantic"],
  day: ["episodic", "working"],
  dataset: ["episodic"],
  texts: ["episodic"],
}

function memoryReads(flow: Flow): MemoryKind[] {
  const set = new Set<MemoryKind>()
  for (const n of flow.nodes) {
    if (n.kind === "search" || n.kind === "link") set.add("semantic")
    if (n.kind === "retrieve") for (const m of MEMORY_OF_RETRIEVE[n.config.retrieve?.kind ?? "entries"]) set.add(m)
    if (n.kind === "context") set.add("working")
  }
  return [...set]
}

function toolsOf(flow: Flow): ToolUse[] {
  const names = new Set<string>()
  for (const n of flow.nodes) {
    const t = TOOL_OF_KIND[n.kind]
    if (t) names.add(t)
  }
  return [...names].sort().map((name) => ({ name, writes: false }))
}

function proposesOf(flow: Flow): string[] {
  const set = new Set<string>()
  for (const n of flow.nodes) if (n.kind === "propose" && n.config.action) set.add(n.config.action)
  if (flow.nodes.some((n) => n.kind === "blocks")) set.add("time-block")
  return [...set].sort()
}

function pinnedModels(flow: Flow): Record<string, string> {
  const out: Record<string, string> = {}
  for (const n of flow.nodes) if (n.config.model) out[n.id] = n.config.model
  return out
}

/** One BIM flow as a Blueprint. `flow` defaults to the shipped graph; pass a saved copy to see that. */
export function bimBlueprint(def: FlowDef, flow: Flow = def.build(), rev: string = FLOW_REV[def.id] ?? DEFAULT_REV): Blueprint {
  return {
    id: `bim-flow:${def.id}`,
    name: def.name,
    owner: "house",
    rev,
    purpose: def.blurb,
    senses: [SENSE_OF_INPUT[def.input]],
    memory: { reads: memoryReads(flow), writes: [] },
    tools: toolsOf(flow),
    skills: [],
    models: { ladders: {}, pinned: pinnedModels(flow), localOnly: true },
    limits: {},
    door: { proposes: proposesOf(flow), surface: BIM_SURFACE },
    checks: [],
    mind: { kind: "graph", flow },
  }
}

/** Every shipped BIM flow. `saved` swaps in the person's own copy of a graph, by flow id. */
export function bimBlueprints(saved: Partial<Record<string, { flow: Flow; rev?: string }>> = {}): Blueprint[] {
  return FLOWS.map((def) => {
    const s = saved[def.id]
    return bimBlueprint(def, s?.flow, s?.rev)
  })
}

/** The flow inside a graph Blueprint, for the old runtime. Null for any other mind. */
export function flowOfBlueprint(b: Blueprint): Flow | null {
  return b.mind.kind === "graph" ? b.mind.flow : null
}
