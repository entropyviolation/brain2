/**
 * lib/agents/adapters/bim-chat.ts — BIM chat's switchboard, seen as a Blueprint
 *
 * One pipeline whose stages are the chat lanes (`lib/ingest/bim-lanes.ts`), in the order a line meets them.
 * The lane table is the only source: a lane added there shows here, on the Agents desk, and in a chat turn's
 * Trace. A chat turn's Trace names this id and rev.
 */

import { CHAT_LANES, type LaneDef } from "@/lib/ingest/bim-lanes"
import type { Blueprint, NamedPipeline, PipelineStage } from "../blueprint"

export const BIM_CHAT_AGENT_ID = "bim-chat"
/** Bump when the lane order or a guard changes, so kept Traces say which table they ran under. */
export const BIM_CHAT_REV = "1"

const label = (id: string) => id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase())

export const BIM_CHAT_STAGES: PipelineStage[] = (CHAT_LANES as readonly LaneDef[]).map((l) => ({
  id: l.id,
  label: label(l.id),
  cost: l.cost,
  does: `${l.does}${l.agent ? ` Agent: ${l.agent}.` : ""}${l.skipWhen?.length ? ` Skipped when: ${l.skipWhen.join(", ")}.` : ""}`,
}))

export const BIM_CHAT_PIPELINES: NamedPipeline[] = [
  { id: "route-chat-line", name: "Which lane takes this line", does: "Offers one typed line to each lane in order; the first that answers takes it, and the ladder always does.", status: "built", stages: BIM_CHAT_STAGES, asTool: "route-chat-line" },
]

export function bimChatBlueprint(): Blueprint {
  return {
    id: BIM_CHAT_AGENT_ID,
    name: "BIM chat",
    owner: "house",
    rev: BIM_CHAT_REV,
    purpose: "Takes one line typed in BIM chat and hands it to the lane that should have it: a BIMBY, a code shape, the router, or the executor's ladder.",
    senses: ["message", "question"],
    memory: { reads: ["working", "semantic", "episodic"], writes: [] },
    tools: [{ name: "route-chat-line", writes: false }],
    skills: [],
    models: { ladders: {}, pinned: {}, localOnly: true },
    limits: {},
    door: { proposes: [], surface: "bim" },
    checks: [],
    mind: { kind: "pipeline", stages: BIM_CHAT_STAGES, pipelines: BIM_CHAT_PIPELINES },
  }
}
