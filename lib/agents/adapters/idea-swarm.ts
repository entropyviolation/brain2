/**
 * lib/agents/adapters/idea-swarm.ts — The Idea swarm, seen as a Blueprint
 *
 * One built pipeline, "Extract ideas from a passage": KEY PHRASES (code) → READERS (many weak models) → EMBED + CLUSTER (code) → CARDS (strong model) → LONE GEMS (strong model).
 * Code: `lib/idea-swarm/`. Its lab is `/lab/idea-swarm`. It reads a passage and writes nothing.
 */

import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const IDEA_SWARM_HREF = "/lab/idea-swarm"
export const IDEA_SWARM_ID = "idea-swarm"

export const IDEA_SWARM_STAGES: PipelineStage[] = [
  { id: "keyphrases", label: "Key phrases", cost: "code", does: "RAKE, TextRank and YAKE side by side: a free baseline, and the topics for the next step." },
  { id: "readers", label: "Readers", cost: "local-model", does: "One weak model per lens (twelve by default: claims, terms, objections, examples and so on), in parallel, each asked a different question about the same passage." },
  { id: "cluster", label: "Embed and cluster", cost: "code", does: "Embeds every idea and groups them by cosine similarity. Ideas that match nobody are lone." },
  { id: "cards", label: "Cards", cost: "local-model", does: "A strong model reads every member of a cluster and writes one idea card. The lab records how close the card sits to the cluster's centre next to the nearest real answer." },
  { id: "gems", label: "Lone gems", cost: "local-model", does: "Optional. A strong model hunts for hidden gems among the lone ideas whose quote is really in the passage." },
]

export const IDEA_SWARM_PIPELINES: NamedPipeline[] = [
  { id: "extract-ideas", name: "Extract ideas from a passage", does: "Tests whether a swarm of weak readers, clustered and written up by a strong model, finds better ideas than one careful call.", status: "built", stages: IDEA_SWARM_STAGES, asTool: "extract-ideas" },
  { id: "one-careful-call", name: "One careful call (baseline)", does: "The single-call comparison the swarm is judged against.", status: "built", stages: [{ id: "baseline", label: "Baseline", cost: "local-model", does: "One strong model reads the passage and lists its ideas." }] },
]

export function ideaSwarmBlueprint(): Blueprint {
  return {
    id: IDEA_SWARM_ID,
    name: "Idea swarm",
    owner: "house",
    rev: "1",
    purpose: "Reads a passage with many weak models and clusters what they find, to see whether a swarm extracts better ideas than one careful call.",
    senses: ["text"],
    memory: { reads: ["working"], writes: [] },
    tools: [{ name: "extract-ideas", writes: false }],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: {},
    door: { proposes: [], surface: "idea-swarm" },
    checks: [],
    mind: { kind: "pipeline", stages: IDEA_SWARM_STAGES, pipelines: IDEA_SWARM_PIPELINES },
  }
}
