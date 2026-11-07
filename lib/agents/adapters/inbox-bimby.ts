/**
 * lib/agents/adapters/inbox-bimby.ts — The Inbox BIMBY, seen as a Blueprint
 *
 * One built pipeline, "Where does this idea go": POOL (code) → PICK (model) → CLEAN (code) → USE (code).
 * Code: `lib/inbox-bimby/`. Its lab is `/lab/inbox-bimby`.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const INBOX_BIMBY_HREF = "/lab/inbox-bimby"
export const INBOX_BIMBY_ID = "inbox-bimby"

export const INBOX_BIMBY_STAGES: PipelineStage[] = [
  { id: "pool", label: "Pool", cost: "code", does: "Ranks lists, filed items and the other Inbox ideas by shared words and embeddings, and keeps a shortlist as short refs." },
  { id: "pick", label: "Pick", cost: "local-model", does: "One schema-bound call on the pick ladder returns up to three lists to file under and matches to merge with, each a shortlist ref with why and how sure." },
  { id: "clean", label: "Clean", cost: "code", does: "Drops unknown refs and adds exact title repeats without the model. With no model it offers word matches." },
  { id: "use", label: "Use", cost: "code", does: "File adds the list and takes the idea out of the Inbox; Merge folds it into the matching item with every detail kept. Undo works." },
]

export const INBOX_BIMBY_PIPELINES: NamedPipeline[] = [
  { id: "file-inbox-idea", name: "Where does this idea go", does: "For one Inbox idea, suggests which list to file it in or which existing item to merge it with.", status: "built", stages: INBOX_BIMBY_STAGES, asTool: "file-inbox-idea" },
]

export function inboxBimbyBlueprint(): Blueprint {
  return {
    id: INBOX_BIMBY_ID,
    name: "Inbox BIMBY",
    owner: "house",
    rev: "1",
    purpose: "For one Inbox idea, suggests where it goes: which list to file it under, or which item it duplicates and should merge into.",
    senses: ["item"],
    memory: { reads: ["semantic"], writes: [] },
    tools: [{ name: "file-inbox-idea", writes: false }],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 1 },
    door: { proposes: ["file-to-list", "merge-items"], surface: "inbox-bimby" },
    checks: [],
    mind: { kind: "pipeline", stages: INBOX_BIMBY_STAGES, pipelines: INBOX_BIMBY_PIPELINES },
  }
}
