/**
 * lib/agents/adapters/tracking-helper.ts — The Tracking BIMBY, seen as a Blueprint
 *
 * The Tracking BIMBY has pipelines. The first, description to timeblock, is the old Tracking Helper: its five stages are the ones in `lib/tracking-helper/flow.ts`: ROUTE, TOKENIZE, WIRE (the only model
 * call), PLACE, WHERE. The `HelperFlow` is carried as it is; `helperOfBlueprint` returns it for the old runtime.
 */

import { TRACKING_HELPER_SKILLS } from "@/lib/skills/seeds"
import { starterFlow, type HelperFlow } from "@/lib/tracking-helper/flow"
import { HELPER_SURFACE } from "@/lib/tracking-helper/accept"
import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const HELPER_STAGES: PipelineStage[] = [
  { id: "route", label: "Route", cost: "code", does: "Decides whether a message adds blocks, revises the ones on screen, or is a question." },
  { id: "tokenize", label: "Tokenize", cost: "code", does: "Tags every time, day, and length in the text so the model points at tags instead of writing times." },
  { id: "wire", label: "Wire", cost: "local-model", does: "One model call lists each thing done, in order, pointing at tags." },
  { id: "place", label: "Place", cost: "code", does: "Turns tags into minutes and fills missing edges from the neighbours." },
  { id: "where", label: "Where", cost: "code", does: "Fills a missing place from the person's own history." },
]

export const GAP_STAGES: PipelineStage[] = [
  { id: "window", label: "Window", cost: "code", does: "Finds each day's awake time: the day minus its Sleep blocks, else 07:00–23:00, never past now." },
  { id: "measure", label: "Measure", cost: "code", does: "Counts how much awake time Activity, Location and Company cover, and how many food entries each day has." },
  { id: "find", label: "Find", cost: "code", does: "Keeps the big holes: untracked Activity, a lane blank where Activity is tracked, a long stretch with no food." },
  { id: "ask", label: "Ask", cost: "code", does: "Turns each hole into one question, largest first, with the opening words of an account to finish and file." },
]

/** The two pipelines that run, and the ones the plans name. */
export const TRACKING_PIPELINES: NamedPipeline[] = [
  { id: "description-to-timeblock", name: "Description to timeblock pipeline", does: "Turns a plain account of a day into proposed Activity and Location blocks.", status: "built", stages: HELPER_STAGES, asTool: "description-to-timeblock" },
  { id: "generate-gap-questions", name: "Generate gap questions pipeline", does: "Measures how much of the past 7 days is tracked, finds the big holes, and asks about them. No model.", status: "built", stages: GAP_STAGES, asTool: "generate-gap-questions" },
  { id: "gap-readings", name: "Gap readings pipeline", does: "For a gap, proposes readings from evidence (files, location, calendar, chat) and keeps only the supported ones, so a question can come with a guess to confirm.", status: "planned", stages: [], plan: "docs/BIMBY_IDEAS.md §10.4" },
  { id: "account-to-other-kinds", name: "Account to other kinds pipeline", does: "Files intake, mood, company and people from the same account, not only Activity and Location.", status: "planned", stages: [], plan: "docs/TRACKING_HELPER.md Planned" },
]

export function helperBlueprint(flow: HelperFlow = starterFlow()): Blueprint {
  return {
    id: "tracking-helper",
    name: "Tracking BIMBY",
    owner: "house",
    rev: flow.rev,
    purpose: "Keeps the Tracking record whole. It files a plain account of a day as proposed Activity and Location blocks, and it measures how much of the week is tracked and asks about the big holes. It files what happened and answers no questions.",
    senses: ["text", "day"],
    memory: { reads: ["episodic", "semantic"], writes: [] },
    tools: [
      { name: "description-to-timeblock", writes: false },
      { name: "generate-gap-questions", writes: false },
    ],
    skills: TRACKING_HELPER_SKILLS,
    models: { ladders: flow.wire.ladder.length ? { extract: flow.wire.ladder } : {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 1, maxTokens: flow.wire.maxTokens },
    door: { proposes: ["time-block"], surface: HELPER_SURFACE },
    checks: [],
    mind: { kind: "pipeline", stages: HELPER_STAGES, flow, pipelines: TRACKING_PIPELINES },
  }
}

/** The flow inside a pipeline Blueprint, for the old runtime. Null for any other mind. */
export function helperOfBlueprint(b: Blueprint): HelperFlow | null {
  return b.mind.kind === "pipeline" && b.mind.flow && "wire" in b.mind.flow ? b.mind.flow : null
}
