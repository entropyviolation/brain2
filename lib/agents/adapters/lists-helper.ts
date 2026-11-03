/**
 * lib/agents/adapters/lists-helper.ts — The Lists helper, seen as a Blueprint
 *
 * A pipeline with no model: READ (code grammar picks a tool and resolves names), PLAN (the tool computes every
 * edit and counts), APPROVE (the person says yes, or types the count), APPLY (re-plan, compare, write), UNDO.
 * The tools are `lib/lists-helper/tools.ts`. Planned: a local model that picks the tool for free-form lines.
 */

import { TOOLS } from "@/lib/lists-helper/tools"
import { LISTS_HELPER_SKILLS } from "@/lib/skills/seeds"
import type { Blueprint, PipelineStage } from "../blueprint"

export const LISTS_HELPER_HREF = "/lab/lists-helper"
export const LISTS_HELPER_ID = "lists-helper"

export const LISTS_HELPER_STAGES: PipelineStage[] = [
  { id: "read", label: "Read", cost: "code", does: "Matches the line to one tool and turns every name into an id. A name that fits two things is asked about, never guessed." },
  { id: "plan", label: "Plan", cost: "code", does: "The tool reads a snapshot and works out every edit. It counts what it touches and writes nothing." },
  { id: "approve", label: "Approve", cost: "code", does: "You see the counts, real rows, and what is left alone. Yes, or the count typed back for a big change." },
  { id: "apply", label: "Apply", cost: "code", does: "Plans again on today's data and writes only if the effect is identical. History names the Lists helper." },
  { id: "undo", label: "Undo", cost: "code", does: "Puts back old values, merged rows, and removes what was added. The last five are kept." },
]

export function listsHelperBlueprint(): Blueprint {
  return {
    id: LISTS_HELPER_ID,
    name: "Lists helper",
    owner: "house",
    rev: "1",
    purpose: "Finds duplicates, merges them, and makes one-time bulk changes to lists and items. Every change is planned, counted, and approved first.",
    senses: ["message"],
    memory: { reads: ["semantic", "working"], writes: [] },
    tools: TOOLS.map((t) => ({ name: t.name, writes: t.writes })),
    skills: LISTS_HELPER_SKILLS,
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 1, maxWrites: 500 },
    door: { proposes: TOOLS.filter((t) => t.writes).map((t) => t.name), surface: "agent" },
    checks: [],
    mind: { kind: "pipeline", stages: LISTS_HELPER_STAGES },
  }
}
