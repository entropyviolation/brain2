/**
 * lib/agents/adapters/critic-bimby.ts — The Critic BIMBY, seen as a Blueprint
 *
 * One built pipeline, "Second look at a plan": CHECK (code) → MODEL (model, only when it can help) → KEYS (code) → LEDGER (code).
 * Code: `lib/critic-bimby/`. It never edits and never writes a plan. Its lab is `/lab/critic-bimby`.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const CRITIC_BIMBY_HREF = "/lab/critic-bimby"
export const CRITIC_BIMBY_ID = "critic-bimby"

export const CRITIC_BIMBY_STAGES: PipelineStage[] = [
  { id: "check", label: "Check", cost: "code", does: "Free checks on the draft and the sentence: a length, deadline or pace you never said, a link to a thing never named, a dropped clause. A certain finding fails the plan and no model runs." },
  { id: "model", label: "Model", cost: "local-model", does: "Off by default. One call on a rung that passed the bench, preferring a model other than the planner's. Each finding must quote your line; code drops any that does not." },
  { id: "keys", label: "Keys", cost: "code", does: "A key per fixable finding (add the dropped task, remove the made-up row, clear the link), run by code only when you choose it." },
  { id: "ledger", label: "Ledger", cost: "code", does: "Keeps the line, the critique and what you did, and reads each as a catch, a miss, a false alarm or unchanged." },
]

export const CRITIC_BIMBY_PIPELINES: NamedPipeline[] = [
  { id: "critique-plan", name: "Second look at a plan", does: "Says what in a finished plan does not match the person's own words, without editing it.", status: "built", stages: CRITIC_BIMBY_STAGES, asTool: "critique-plan" },
  { id: "critique-other-hosts", name: "Second host and lessons", does: "Critique something other than a plan, and learn from the ledger.", status: "planned", stages: [], plan: "docs/CRITIC_BIMBY_PLAN.md (C4, C5)" },
]

export function criticBimbyBlueprint(): Blueprint {
  return {
    id: CRITIC_BIMBY_ID,
    name: "Critic BIMBY",
    owner: "house",
    rev: "1",
    purpose: "Reads your own words and a finished plan and says what does not match. It never edits and never writes.",
    senses: ["text"],
    memory: { reads: ["episodic"], writes: [] },
    tools: [{ name: "critique-plan", writes: false }],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 1, maxMs: 20000 },
    door: { proposes: [], surface: "critic-bimby" },
    checks: [],
    mind: { kind: "pipeline", stages: CRITIC_BIMBY_STAGES, pipelines: CRITIC_BIMBY_PIPELINES },
  }
}
