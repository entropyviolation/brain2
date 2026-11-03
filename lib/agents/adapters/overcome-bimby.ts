/**
 * lib/agents/adapters/overcome-bimby.ts — The Overcome BIMBY, seen as a Blueprint
 *
 * One named pipeline, "Overcome executive dysfunction": READ (model) → LOG (code) → GATHER (code) → PICK (code) → PUSH (model).
 * Code: `lib/overcome-bimby/`. Its lab is `/lab/overcome`. The only thing it writes is its own resistance log.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const OVERCOME_HREF = "/lab/overcome"
export const OVERCOME_ID = "overcome-bimby"

export const OVERCOME_STAGES: PipelineStage[] = [
  { id: "read", label: "Read", cost: "local-model", does: "One model call finds the task, how the resistance feels, the kind of barrier, days overdue, and the reasons and costs in your own words." },
  { id: "log", label: "Log", cost: "code", does: "Appends the resistance to its own log, with the exact message. Nothing else is written." },
  { id: "gather", label: "Gather", cost: "code", does: "Pulls your earlier reasons and costs for the same task from the log, so you hear your own words back." },
  { id: "pick", label: "Pick", cost: "code", does: "Ranks known tactics for the barrier, favouring what worked for you and dropping what already failed on this task. Three, never two of a kind." },
  { id: "push", label: "Push", cost: "local-model", does: "Phrases one short nudge from the picked tactics, your quotes and the cost. It may not add a reason you did not say." },
]

export const OVERCOME_PIPELINES: NamedPipeline[] = [
  { id: "overcome-executive-dysfunction", name: "Overcome executive dysfunction pipeline", does: "Logs your resistance to a task, then pushes you to start it with tactics that fit the barrier, the cost of waiting, and your own reasons.", status: "built", stages: OVERCOME_STAGES, asTool: "overcome-executive-dysfunction" },
  { id: "overcome-follow-up", name: "Follow-up pipeline", does: "Checks back after a set time and asks if you started; a plain yes or no feeds the picker.", status: "planned", stages: [], plan: "lib/overcome-bimby/README.md Planned" },
]

export function overcomeBlueprint(): Blueprint {
  return {
    id: OVERCOME_ID,
    name: "Overcome BIMBY",
    owner: "house",
    rev: "1",
    purpose: "When you say you cannot make yourself start something, it logs the resistance and pushes you to begin, using known tactics, the cost of waiting, and your own reasons for wanting it done.",
    senses: ["message"],
    memory: { reads: ["episodic"], writes: [] },
    tools: [{ name: "overcome-executive-dysfunction", writes: false }],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 2 },
    door: { proposes: [], surface: "agent" },
    checks: [],
    mind: { kind: "pipeline", stages: OVERCOME_STAGES, pipelines: OVERCOME_PIPELINES },
  }
}
