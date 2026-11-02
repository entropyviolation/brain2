/**
 * lib/agents/blueprint.ts — One description of an agent, whatever its mind is made of
 *
 * Every agent has the same envelope: who it is, what it senses, what memory it reads and writes, which
 * tools it uses, which models, its limits, and what it may propose. Only `mind` differs: a graph (the BIM
 * flow), a pipeline (the Tracking and Habits BIMBYs), or a policy of rules (planned). The Agent Lab edits Blueprints;
 * a runtime executes them. Plan: `docs/AGENT_LAB_PLAN.md` §2.
 *
 * Slice 1 is read-only. A Blueprint is built from a saved flow by an adapter (`adapters/`), and the flow
 * inside is the same object the old runtime reads, so nothing is rewritten and nothing is written back.
 */

import type { Flow, FlowNodeKind } from "@/lib/bim-flow/types"
import type { HabitsBimbyFlow } from "@/lib/habit-helper/flow"
import type { HelperFlow } from "@/lib/tracking-helper/flow"

/** The four kinds of memory a cognitive architecture names. */
export type MemoryKind = "semantic" | "episodic" | "procedural" | "working"

export type MindKind = "graph" | "pipeline" | "policy"

/** What a step does in the loop: perceive, attend, remember, reason, act, check, halt. */
export type StepRole = "sense" | "attend" | "remember" | "reason" | "act" | "check" | "halt"

/** The paper's four modules (`docs/REASONING_TOPOLOGIES_AND_AGENTS.md` §1). Not every step has one. */
export type ModuleRole = "generator" | "evaluator" | "halter" | "controller"

export interface StepTag {
  role: StepRole
  module?: ModuleRole
}

/** Where a step runs: plain code, a local model, or (never by default) something hosted. */
export type StepCost = "code" | "local-model" | "hosted"

export type AgentOwner = "house" | `module:${string}`

export type SenseKind = "message" | "question" | "day" | "item" | "clock" | "event" | "text"

export interface PipelineStage {
  id: string
  label: string
  cost: StepCost
  /** What the stage does, in one sentence. */
  does: string
}

export interface PolicyRule {
  id: string
  label: string
  /** Higher wins. Planned: no adapter builds this yet. */
  weight: number
}

export type Mind =
  | { kind: "graph"; flow: Flow }
  | { kind: "pipeline"; stages: PipelineStage[]; flow: HelperFlow | HabitsBimbyFlow }
  | { kind: "policy"; rules: PolicyRule[] }

export interface ToolUse {
  /** Stable tool name. Slice 4 gives each a contract; until then this is a label for what the agent reaches for. */
  name: string
  /** True when the tool can write. Only a proposal reaches the accept door, so this stays false for now. */
  writes: boolean
}

export interface ModelPlanSpec {
  /** Role → models, smallest first. Empty means the crew's own ladder for that role. */
  ladders: Record<string, string[]>
  /** Models pinned on single steps, `stepId → model`. */
  pinned: Record<string, string>
  /** No tool or model that leaves this machine. */
  localOnly: boolean
}

/** Every field is optional because an agent that never declared a limit has none. The lab shows "not set". */
export interface Limits {
  maxCalls?: number
  maxMs?: number
  maxTokens?: number
  maxWrites?: number
}

export interface Door {
  /** What it may propose, by name (for BIM: the `propose` actions). */
  proposes: string[]
  /** The module that writes an accepted proposal (`generatedBy.id` prefix, `createdBy.surface`). */
  surface: string
}

export interface Blueprint {
  id: string
  name: string
  owner: AgentOwner
  /** The shipped or saved revision of the mind. */
  rev: string
  purpose: string
  senses: SenseKind[]
  memory: { reads: MemoryKind[]; writes: MemoryKind[] }
  tools: ToolUse[]
  models: ModelPlanSpec
  limits: Limits
  door: Door
  /** Ids of eval suites bound to this agent. Empty until slice 5. */
  checks: string[]
  mind: Mind
}

/** The envelope's keys, in order. Every Blueprint has exactly these. */
export const ENVELOPE_KEYS = ["id", "name", "owner", "rev", "purpose", "senses", "memory", "tools", "models", "limits", "door", "checks", "mind"] as const

/**
 * What each BIM node kind is in the loop. A new node kind must be added here; the table is exhaustive on
 * purpose, so a new kind cannot ship without saying which role it plays (`RT-1`).
 */
export const NODE_TAG: Record<FlowNodeKind, StepTag> = {
  message: { role: "sense" },
  context: { role: "attend", module: "controller" },
  route: { role: "attend", module: "controller" },
  gate: { role: "check", module: "evaluator" },
  search: { role: "remember" },
  retrieve: { role: "remember" },
  link: { role: "remember" },
  choose: { role: "reason", module: "generator" },
  extract: { role: "reason", module: "generator" },
  related: { role: "reason", module: "generator" },
  answer: { role: "reason", module: "generator" },
  compute: { role: "reason" },
  propose: { role: "act" },
  blocks: { role: "act" },
  question: { role: "act" },
  handoff: { role: "act", module: "controller" },
  fallback: { role: "act", module: "controller" },
  guard: { role: "halt", module: "halter" },
  clarify: { role: "halt", module: "halter" },
}

export const tagOfNode = (kind: FlowNodeKind): StepTag => NODE_TAG[kind]

/** Plain problems with a Blueprint, empty when sound. Used by tests now and the lab's form later. */
export function validateBlueprint(b: Blueprint): string[] {
  const out: string[] = []
  if (!b.id.trim()) out.push("id is empty")
  if (!b.name.trim()) out.push("name is empty")
  if (!b.rev.trim()) out.push("rev is empty")
  if (!b.purpose.trim()) out.push("purpose is empty")
  if (b.owner !== "house" && !/^module:.+/.test(b.owner)) out.push(`owner "${b.owner}" is neither house nor module:<id>`)
  if (!b.senses.length) out.push("senses is empty")
  const seenTools = new Set<string>()
  for (const t of b.tools) {
    if (seenTools.has(t.name)) out.push(`tool "${t.name}" is listed twice`)
    seenTools.add(t.name)
  }
  for (const [k, v] of Object.entries(b.limits)) if (v !== undefined && !(v > 0)) out.push(`limit ${k} must be above zero`)
  const m = b.mind
  if (m.kind === "graph") {
    const ids = new Set<string>()
    for (const n of m.flow.nodes) {
      if (ids.has(n.id)) out.push(`node id "${n.id}" is used twice`)
      ids.add(n.id)
      if (!(n.kind in NODE_TAG)) out.push(`node "${n.id}" has unknown kind "${n.kind}"`)
    }
    for (const e of m.flow.edges) if (!ids.has(e.from) || !ids.has(e.to)) out.push(`edge "${e.id}" points at a missing node`)
    if (!m.flow.nodes.some((n) => n.kind === "message")) out.push("graph has no message node")
  } else if (m.kind === "pipeline") {
    if (!m.stages.length) out.push("pipeline has no stages")
    const ids = new Set<string>()
    for (const s of m.stages) {
      if (ids.has(s.id)) out.push(`stage id "${s.id}" is used twice`)
      ids.add(s.id)
    }
  } else if (!m.rules.length) out.push("policy has no rules")
  return out
}
