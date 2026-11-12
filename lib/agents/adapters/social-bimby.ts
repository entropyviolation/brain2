/**
 * lib/agents/adapters/social-bimby.ts — The Social BIMBY, seen as a Blueprint
 *
 * One built pipeline, "File a social message": READ (code) → LOOK UP (code) → PLAN (code) → ACCEPT (code).
 * Code: `lib/social-bimby/`. It runs in BIM chat (the `social` lane, or "send this to social bimby: …").
 * No lab page yet.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const SOCIAL_BIMBY_ID = "social-bimby"

export const SOCIAL_BIMBY_STAGES: PipelineStage[] = [
  { id: "read", label: "Read", cost: "code", does: "Finds the person (one in People I Know, or a new name after “friend”, “met”, “dmd”), their Instagram handle, the relation, a hang-out wanted, a trip, invites and a birthday." },
  { id: "look-up", label: "Look up", cost: "code", does: "Matches People I Know by name, nickname or handle, and reads your Flight items to place “as soon as I get back”." },
  { id: "plan", label: "Plan", cost: "code", does: "One proposed change each: the person, a dated note with your words, a birthday, a reminder, and an entry in that week's Plan log." },
  { id: "accept", label: "Accept", cost: "code", does: "Each Accept writes one change as one undo step. A known person keeps every field; only blanks are filled." },
]

export const SOCIAL_BIMBY_PIPELINES: NamedPipeline[] = [
  { id: "file-social-message", name: "File a social message", does: "Turns a line about a friend into a person, their Instagram, a note, a reminder to see them and a plan-log entry, each waiting for Accept.", status: "built", stages: SOCIAL_BIMBY_STAGES, asTool: "file-social-message" },
  { id: "birthday-nudges", name: "Birthday nudges", does: "A reminder a few days before each friend's birthday.", status: "planned", stages: [] },
  { id: "drifting-friends", name: "Friends you haven't seen", does: "Names close friends with no hang-out, text or call in a while.", status: "planned", stages: [] },
]

export function socialBimbyBlueprint(): Blueprint {
  return {
    id: SOCIAL_BIMBY_ID,
    name: "Social BIMBY",
    owner: "house",
    rev: "1",
    purpose: "Keeps track of your friendships: who people are, their Instagram, how things felt, birthdays, invites, and who to see next.",
    senses: ["message"],
    memory: { reads: ["semantic"], writes: [] },
    tools: [{ name: "file-social-message", writes: false }],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: {},
    door: { proposes: ["person", "person-note", "birthday", "reminder", "plan-entry"], surface: "bim-chat" },
    checks: [],
    mind: { kind: "pipeline", stages: SOCIAL_BIMBY_STAGES, pipelines: SOCIAL_BIMBY_PIPELINES },
  }
}
