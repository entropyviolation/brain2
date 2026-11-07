/**
 * lib/agents/adapters/plan-bimby.ts — The Plan BIMBY, seen as a Blueprint
 *
 * One built pipeline, "Run a plan right now": SEGMENT (model) → LINK (code) → SECOND LOOK (code) → CONFIRM (person) → RUN (code) → EFFECTS (code).
 * Code: `lib/plan-bimby/`. Its lab is `/lab/plan-bimby`. It writes nothing until a row is played or finished.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const PLAN_BIMBY_HREF = "/lab/plan-bimby"
export const PLAN_BIMBY_ID = "plan-bimby"

export const PLAN_BIMBY_STAGES: PipelineStage[] = [
  { id: "segment", label: "Segment", cost: "local-model", does: "One schema-bound call splits what you said into ordered tasks with minutes, pace, subtasks and the asides that are not tasks. Without a model, rules split on commas and \"then\"." },
  { id: "link", label: "Link", cost: "code", does: "Ties a row to an intake, a flight, or the best open task by name. A task match starts unconfirmed." },
  { id: "second-look", label: "Second look", cost: "code", does: "The Critic BIMBY's free checks flag what you never said. Nothing is blocked." },
  { id: "confirm", label: "Confirm", cost: "code", does: "Shows the rows for you to edit. Start plan is the yes." },
  { id: "run", label: "Run", cost: "code", does: "One row plays at a time. Every closed play becomes a span." },
  { id: "effects", label: "Effects", cost: "code", does: "A finished intake row logs once, a confirmed task link gets a time slice, a flight row files a pasted confirmation." },
]

export const PLAN_BIMBY_PIPELINES: NamedPipeline[] = [
  { id: "plan-right-now", name: "Plan for right now", does: "Turns one spoken breath of tasks into a confirmed run list of play, pause and done rows.", status: "built", stages: PLAN_BIMBY_STAGES, asTool: "plan-right-now" },
  { id: "plan-today", name: "Plan for today, this week, the season", does: "The same shape for longer spans.", status: "planned", stages: [], plan: "lib/plan-bimby/README.md (modes.ts lists them disabled)" },
]

export function planBimbyBlueprint(): Blueprint {
  return {
    id: PLAN_BIMBY_ID,
    name: "Plan BIMBY",
    owner: "house",
    rev: "1",
    purpose: "Takes a short-term plan said in one breath, splits it into ordered tasks, asks you to confirm, then runs them as play, pause and done rows.",
    senses: ["text"],
    memory: { reads: ["episodic", "semantic"], writes: [] },
    tools: [{ name: "plan-right-now", writes: false }],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 1 },
    door: { proposes: ["plan-run", "intake-log", "time-slice", "flight-item"], surface: "plan-bimby" },
    checks: [],
    mind: { kind: "pipeline", stages: PLAN_BIMBY_STAGES, pipelines: PLAN_BIMBY_PIPELINES },
  }
}
