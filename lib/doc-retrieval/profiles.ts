/**
 * lib/doc-retrieval/profiles.ts — How an agent searches a document depends on what the agent is for
 *
 * A Lists BIMBY looking up a part number and a Notes BIMBY explaining a chapter should not share one setting.
 * A `RetrievalProfile` holds the knobs: search mode, how many chunks, chunk size, and how much text may reach the
 * model. Three purposes give starting profiles. `AGENT_PURPOSE` maps an agent id (`Blueprint.id`) to a purpose, and
 * an agent can override any field. The starting values are guesses; `chooseMode` replaces the guess about mode with a
 * measurement on that agent's own labelled questions. Nothing here runs a model or writes storage.
 */
import type { ChunkOptions } from "./chunk"
import { scoreRetriever } from "./eval"
import { retrieveChunks } from "./retrieve"
import type { EvalCase, DocChunk, Hit, RetrieveMode, VectorRanker } from "./types"

/**
 * - `lookup`: one fact (a part number, a date, a limit). Small chunks, few of them, tight budget for a small model.
 * - `explain`: understand a topic written in prose. Bigger chunks and more of them, so context is not cut.
 * - `extract`: gather every instance (all requirements, all steps). Many chunks, large budget, for a stronger model.
 */
export type RetrievalPurpose = "lookup" | "explain" | "extract"

export interface RetrievalProfile {
  purpose: RetrievalPurpose
  mode: RetrieveMode
  k: number
  chunk: Required<Pick<ChunkOptions, "max" | "overlap" | "wholeUnder">>
  /** Most characters of chunk text handed to the model. About 4 per token. */
  budgetChars: number
}

export const PURPOSE_PROFILES: Record<RetrievalPurpose, RetrievalProfile> = {
  lookup: { purpose: "lookup", mode: "hybrid", k: 4, chunk: { max: 800, overlap: 80, wholeUnder: 4000 }, budgetChars: 3200 },
  explain: { purpose: "explain", mode: "hybrid", k: 6, chunk: { max: 1600, overlap: 160, wholeUnder: 8000 }, budgetChars: 8000 },
  extract: { purpose: "extract", mode: "hybrid", k: 12, chunk: { max: 1200, overlap: 120, wholeUnder: 8000 }, budgetChars: 16000 },
}

/** Agent id to purpose. Empty on purpose: an agent is added when it first reads documents. */
export const AGENT_PURPOSE: Readonly<Record<string, RetrievalPurpose>> = {}

export function profileFor(
  agentId: string,
  override: Partial<Omit<RetrievalProfile, "chunk">> & { chunk?: Partial<RetrievalProfile["chunk"]> } = {},
  purposes: Readonly<Record<string, RetrievalPurpose>> = AGENT_PURPOSE,
): RetrievalProfile {
  const base = PURPOSE_PROFILES[override.purpose ?? purposes[agentId] ?? "lookup"]
  return { ...base, ...override, chunk: { ...base.chunk, ...override.chunk } }
}

/** Chunks depend on the chunk settings, so an index is per document and per setting. Use this as the store namespace. */
export function indexKey(itemId: string, profile: RetrievalProfile): string {
  const { max, overlap, wholeUnder } = profile.chunk
  return `${itemId}|${max}-${overlap}-${wholeUnder}`
}

/** Hits in rank order, cut at the profile's budget. The first hit always goes in, even if it alone is over. */
export function packContext(hits: readonly Hit[], budgetChars: number): { text: string; used: Hit[] } {
  const used: Hit[] = []
  let size = 0
  for (const h of hits) {
    if (used.length && size + h.chunk.text.length > budgetChars) break
    used.push(h)
    size += h.chunk.text.length
  }
  const text = used.map((h) => `[p.${h.chunk.page}${h.chunk.heading ? `, ${h.chunk.heading}` : ""}]\n${h.chunk.text}`).join("\n\n")
  return { text, used }
}

export async function retrieveForAgent(
  agentId: string,
  query: string,
  chunks: readonly DocChunk[],
  rank?: VectorRanker,
  override?: Parameters<typeof profileFor>[1],
): Promise<{ profile: RetrievalProfile; text: string; used: Hit[] }> {
  const profile = profileFor(agentId, override)
  const hits = await retrieveChunks(query, chunks, { mode: profile.mode, k: profile.k, rank })
  return { profile, ...packContext(hits, profile.budgetChars) }
}

export interface ModeChoice {
  mode: RetrieveMode
  scores: Record<RetrieveMode, { recall1: number; recallK: number; mrr: number }>
}

/**
 * Score each mode on this agent's questions and pick one: highest MRR, then recall@k, and a tie goes to `hybrid`,
 * which is the safest. Needs enough questions to mean anything (the README says about 50); with fewer than
 * `minCases`, or no `rank`, it keeps the profile's own mode rather than guess from noise.
 */
export async function chooseMode(
  profile: RetrievalProfile,
  cases: readonly EvalCase[],
  chunks: readonly DocChunk[],
  rank?: VectorRanker,
  minCases = 20,
): Promise<ModeChoice> {
  const modes: RetrieveMode[] = ["keyword", "vector", "hybrid"]
  const scores = {} as ModeChoice["scores"]
  for (const mode of modes) {
    const run = (q: string) => retrieveChunks(q, chunks, { mode, k: profile.k, rank })
    const one = await scoreRetriever(cases, run, 1)
    const many = await scoreRetriever(cases, run, profile.k)
    scores[mode] = { recall1: one.recallAtK, recallK: many.recallAtK, mrr: many.mrr }
  }
  if (!rank || cases.length < minCases) return { mode: profile.mode, scores }
  const rank3 = (m: RetrieveMode) => scores[m].mrr * 1000 + scores[m].recallK * 10 + (m === "hybrid" ? 0.001 : 0)
  const best = [...modes].sort((a, b) => rank3(b) - rank3(a))[0]!
  return { mode: best, scores }
}
