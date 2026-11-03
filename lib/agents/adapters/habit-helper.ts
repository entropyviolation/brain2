/**
 * lib/agents/adapters/habit-helper.ts — The Habits BIMBY, seen as a Blueprint
 *
 * The five stages are the ones in `lib/habit-helper/flow.ts`: ROUTE, TAG, MATCH (the only model call),
 * COMPUTE, PROPOSE. The `HabitsBimbyFlow` is carried as it is; `habitsBimbyOfBlueprint` returns it.
 */

import { HABITS_BIMBY_SURFACE } from "@/lib/habit-helper/accept"
import { starterFlow, type HabitsBimbyFlow } from "@/lib/habit-helper/flow"
import type { Blueprint, PipelineStage } from "../blueprint"

export const HABITS_BIMBY_STAGES: PipelineStage[] = [
  { id: "route", label: "Route", cost: "code", does: "Decides whether a message logs habits, answers a why-question, asks for shorthand names, reasons or nudges, or is a question." },
  { id: "tag", label: "Tag", cost: "code", does: "Cuts the message into clauses and tags amounts, days, negations and “because” reasons." },
  { id: "match", label: "Match", cost: "local-model", does: "One model call points each clause at a habit id and its tags. It cannot name a habit or a number that is not there." },
  { id: "compute", label: "Compute", cost: "code", does: "Converts units to the habit's own, resolves the day, keeps a reason word for word, and asks when two habits fit." },
  { id: "propose", label: "Propose", cost: "code", does: "Shows old → new per cell. Nothing is written until the person accepts it." },
]

export function habitsBimbyBlueprint(flow: HabitsBimbyFlow = starterFlow()): Blueprint {
  return {
    id: "habit-helper",
    name: "Habits BIMBY",
    owner: "house",
    rev: flow.rev,
    purpose: "Reads what was done or missed today from plain words, asks why habits get missed, nudges about open ones, and suggests shorthand names. Every change is a proposal.",
    senses: ["text"],
    memory: { reads: ["episodic", "semantic"], writes: [] },
    tools: [
      { name: "tag-clauses", writes: false },
      { name: "match-habits", writes: false },
      { name: "compute-cells", writes: false },
      { name: "read-habit-history", writes: false },
    ],
    skills: [],
    models: { ladders: flow.match.ladder.length ? { extract: flow.match.ladder } : {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 1, maxTokens: flow.match.maxTokens },
    door: { proposes: ["habit-cell", "miss-reason", "shorthand-name"], surface: HABITS_BIMBY_SURFACE },
    checks: [],
    mind: { kind: "pipeline", stages: HABITS_BIMBY_STAGES, flow },
  }
}

/** The flow inside the Habits BIMBY's Blueprint. Null for any other agent. */
export function habitsBimbyOfBlueprint(b: Blueprint): HabitsBimbyFlow | null {
  return b.mind.kind === "pipeline" && b.mind.flow && "match" in b.mind.flow ? b.mind.flow : null
}
