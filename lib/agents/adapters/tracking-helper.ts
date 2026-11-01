/**
 * lib/agents/adapters/tracking-helper.ts — The Tracking Helper, seen as a Blueprint
 *
 * The five stages are the ones in `lib/tracking-helper/flow.ts`: ROUTE, TOKENIZE, WIRE (the only model
 * call), PLACE, WHERE. The `HelperFlow` is carried as it is; `helperOfBlueprint` returns it for the old runtime.
 */

import { starterFlow, type HelperFlow } from "@/lib/tracking-helper/flow"
import { HELPER_SURFACE } from "@/lib/tracking-helper/accept"
import type { Blueprint, PipelineStage } from "../blueprint"

export const HELPER_STAGES: PipelineStage[] = [
  { id: "route", label: "Route", cost: "code", does: "Decides whether a message adds blocks, revises the ones on screen, or is a question." },
  { id: "tokenize", label: "Tokenize", cost: "code", does: "Tags every time, day, and length in the text so the model points at tags instead of writing times." },
  { id: "wire", label: "Wire", cost: "local-model", does: "One model call lists each thing done, in order, pointing at tags." },
  { id: "place", label: "Place", cost: "code", does: "Turns tags into minutes and fills missing edges from the neighbours." },
  { id: "where", label: "Where", cost: "code", does: "Fills a missing place from the person's own history." },
]

export function helperBlueprint(flow: HelperFlow = starterFlow()): Blueprint {
  return {
    id: "tracking-helper",
    name: "Tracking helper",
    owner: "house",
    rev: flow.rev,
    purpose: "Turns a plain account of a day into proposed Activity and Location blocks. It files what happened and answers no questions.",
    senses: ["text"],
    memory: { reads: ["episodic", "semantic"], writes: [] },
    tools: [
      { name: "tokenize-time", writes: false },
      { name: "extract-fields", writes: false },
      { name: "place-from-history", writes: false },
      { name: "assemble-blocks", writes: false },
    ],
    models: { ladders: flow.wire.ladder.length ? { extract: flow.wire.ladder } : {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 1, maxTokens: flow.wire.maxTokens },
    door: { proposes: ["time-block"], surface: HELPER_SURFACE },
    checks: [],
    mind: { kind: "pipeline", stages: HELPER_STAGES, flow },
  }
}

/** The flow inside a pipeline Blueprint, for the old runtime. Null for any other mind. */
export function helperOfBlueprint(b: Blueprint): HelperFlow | null {
  return b.mind.kind === "pipeline" ? b.mind.flow : null
}
