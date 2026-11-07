/**
 * lib/agents/adapters/link-bimby.ts — The Link BIMBY, seen as a Blueprint
 *
 * One built pipeline, "Guess what a link is for": PEEK (code) → POOL (code + embeddings) → PICK (model) → CLEAN (code) → REVIEW (person) → USE (code).
 * Code: `lib/link-bimby/`. Its lab is `/lab/link-bimby`.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const LINK_BIMBY_HREF = "/lab/link-bimby"
export const LINK_BIMBY_ID = "link-bimby"

export const LINK_BIMBY_STAGES: PipelineStage[] = [
  { id: "peek", label: "Peek", cost: "code", does: "Reads the page's title, caption and author, and on this Mac watches a reel (audio to text, frames to on-screen text). Cached once per link." },
  { id: "pool", label: "Pool", cost: "code", does: "Ranks every list and open item by shared words (plus an embedding score when installed) and keeps the best 14 lists and 22 items as short refs." },
  { id: "pick", label: "Pick", cost: "local-model", does: "One schema-bound call returns what the link is and up to three guesses, each a shortlist ref with why, how to use it, and how sure." },
  { id: "clean", label: "Clean", cost: "code", does: "Keeps only refs on the shortlist, once each, by sureness. With no model it offers the best word matches." },
  { id: "review", label: "Review", cost: "code", does: "You approve or reject each guess or comment; every verdict becomes a lesson sent with the next prompt." },
  { id: "use", label: "Use", cost: "code", does: "Adds the list, or a resource-for link to the item, and files the link out of the Inbox. Undo works." },
]

export const LINK_BIMBY_PIPELINES: NamedPipeline[] = [
  { id: "guess-link", name: "Guess what a link is for", does: "For one saved link, guesses what in Brain2 it is most likely a resource for, and how it would be used there.", status: "built", stages: LINK_BIMBY_STAGES, asTool: "guess-link" },
]

export function linkBimbyBlueprint(): Blueprint {
  return {
    id: LINK_BIMBY_ID,
    name: "Link BIMBY",
    owner: "house",
    rev: "1",
    purpose: "For a saved link, guesses which list or item in Brain2 it is a resource for and how you would use it, then learns from your approvals and rejections.",
    senses: ["item"],
    memory: { reads: ["semantic", "episodic"], writes: [] },
    tools: [{ name: "guess-link", writes: false }],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: { maxCalls: 1 },
    door: { proposes: ["link-to-list", "link-to-item"], surface: "link-bimby" },
    checks: [],
    mind: { kind: "pipeline", stages: LINK_BIMBY_STAGES, pipelines: LINK_BIMBY_PIPELINES },
  }
}
