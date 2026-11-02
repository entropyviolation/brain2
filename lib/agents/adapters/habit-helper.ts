/**
 * lib/agents/adapters/habit-helper.ts — The Daily Habit Helper, seen as a Blueprint
 *
 * The five stages are the ones in `lib/habit-helper/flow.ts`: ROUTE, TAG, MATCH (the only model call),
 * COMPUTE, PROPOSE. The `HabitHelperFlow` is carried as it is; `habitHelperOfBlueprint` returns it.
 */

import { HABIT_HELPER_SURFACE } from "@/lib/habit-helper/accept"
import { starterFlow, type HabitHelperFlow } from "@/lib/habit-helper/flow"
import type { Blueprint, PipelineStage } from "../blueprint"

export const HABIT_HELPER_STAGES: PipelineStage[] = [
  { id: "route", label: "Route", cost: "code", does: "Decides whether a message logs habits, answers a why-question, asks for shorthand names, reasons or nudges, or is a question." },
  { id: "tag", label: "Tag", cost: "code", does: "Cuts the message into clauses and tags amounts, days, negations and “because” reasons." },
  { id: "match", label: "Match", cost: "local-model", does: "One model call points each clause at a habit id and its tags. It cannot name a habit or a number that is not there." },
  { id: "compute", label: "Compute", cost: "code", does: "Converts units to the habit's own, resolves the day, keeps a reason word for word, and asks when two habits fit." },
  { id: "propose", label: "Propose", cost: "code", does: "Shows old → new per cell. Nothing is written until the person accepts it." },
]

export function habitHelperBlueprint(flow: HabitHelperFlow = starterFlow()): Blueprint {
  return {
    id: "habit-helper",
    name: "Habit helper",
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
    models: { ladders: flow.match.ladder.length ? { extract: flow.match.ladder } : {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 1, maxTokens: flow.match.maxTokens },
    door: { proposes: ["habit-cell", "miss-reason", "shorthand-name"], surface: HABIT_HELPER_SURFACE },
    checks: [],
    mind: { kind: "pipeline", stages: HABIT_HELPER_STAGES, flow },
  }
}

/** The flow inside the Habit Helper's Blueprint. Null for any other agent. */
export function habitHelperOfBlueprint(b: Blueprint): HabitHelperFlow | null {
  return b.mind.kind === "pipeline" && "match" in b.mind.flow ? b.mind.flow : null
}
