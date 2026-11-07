/**
 * lib/agents/adapters/swarm-vote.ts — The Swarm vote, seen as a Blueprint
 *
 * A shared shape for any BIMBY with a closed tool list: BALLOTS (many small models) → TALLY (code) → REWORD (one model, only on a split).
 * Code: `lib/swarm-vote/`. Its lab is `/lab/swarm-vote`. It picks what to show and never writes.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const SWARM_VOTE_HREF = "/lab/swarm-vote"
export const SWARM_VOTE_ID = "swarm-vote"

export const SWARM_VOTE_STAGES: PipelineStage[] = [
  { id: "ballots", label: "Ballots", cost: "local-model", does: "Asks every voter the same line in parallel. Each returns a ranked list of tools; anything off the closed list is dropped. A timeout votes with whoever answered." },
  { id: "tally", label: "Tally", cost: "code", does: "Merges the rankings by Borda count and reports agreement and margin. The verdict is clear (go to the plan), split (reword and keys) or empty (ask the person)." },
  { id: "reword", label: "Reword", cost: "local-model", does: "Only on a split. One mid-model call turns each surviving action into one imperative sentence, shown as a key. A click puts it back in the line box." },
]

export const SWARM_VOTE_PIPELINES: NamedPipeline[] = [
  { id: "vote-on-tool", name: "Which tool does this line mean", does: "Votes on a closed list of tools; used by the Lists BIMBY.", status: "built", stages: SWARM_VOTE_STAGES, asTool: "vote-on-tool" },
  { id: "confidence-escalation", name: "Confidence-driven escalation", does: "Climb to a stronger model when the vote is unsure.", status: "planned", stages: [], plan: "docs/BIMBY_IDEAS.md" },
]

export function swarmVoteBlueprint(): Blueprint {
  return {
    id: SWARM_VOTE_ID,
    name: "Swarm vote",
    owner: "house",
    rev: "1",
    purpose: "A reusable vote for any BIMBY with a closed tool list: several small models rank the tools for one line and code merges the rankings. It picks what to show and never writes.",
    senses: ["text"],
    memory: { reads: [], writes: [] },
    tools: [{ name: "vote-on-tool", writes: false }],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: { maxMs: 20000 },
    door: { proposes: [], surface: "swarm-vote" },
    checks: [],
    mind: { kind: "pipeline", stages: SWARM_VOTE_STAGES, pipelines: SWARM_VOTE_PIPELINES },
  }
}
