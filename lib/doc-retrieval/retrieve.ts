/**
 * lib/doc-retrieval/retrieve.ts — Keyword, vector and hybrid search over chunks
 *
 * Keyword is BM25 (k1 1.5, b 0.75) with a plain tokenizer, so exact terms like
 * a part number or a surname score high. Vector asks an injected `VectorRanker`
 * (the Ollama embedder in the app, a fake in tests). Hybrid merges the two
 * rankings by reciprocal rank fusion, which needs no score scaling. Every mode
 * is a pure function over the chunks it is given. Nothing here writes storage.
 */
import type { DocChunk, Hit, RetrieveMode, VectorRanker } from "./types"

const STOP = new Set("a an and are as at be by for from has have in is it its of on or that the this to was were will with".split(" "))

export function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? []).filter((w) => w.length > 1 && !STOP.has(w))
}

export function keywordScores(query: string, chunks: readonly DocChunk[]): number[] {
  const docs = chunks.map((c) => tokens(`${c.heading} ${c.text}`))
  const n = docs.length
  const avg = docs.reduce((s, d) => s + d.length, 0) / (n || 1) || 1
  const df = new Map<string, number>()
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) ?? 0) + 1)
  const q = [...new Set(tokens(query))]
  return docs.map((d) => {
    const tf = new Map<string, number>()
    for (const t of d) tf.set(t, (tf.get(t) ?? 0) + 1)
    let score = 0
    for (const t of q) {
      const f = tf.get(t)
      if (!f) continue
      const idf = Math.log(1 + (n - (df.get(t) ?? 0) + 0.5) / ((df.get(t) ?? 0) + 0.5))
      score += (idf * f * 2.5) / (f + 1.5 * (0.25 + (0.75 * d.length) / avg))
    }
    return score
  })
}

/** Reciprocal rank fusion of several score lists over the same items. Zero scores do not vote. */
export function fuse(lists: readonly number[][], k = 60): number[] {
  const out = new Array<number>(lists[0]?.length ?? 0).fill(0)
  for (const scores of lists) {
    scores
      .map((s, i) => ({ s, i }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s)
      .forEach((x, rank) => {
        out[x.i]! += 1 / (k + rank + 1)
      })
  }
  return out
}

export interface RetrieveOptions {
  mode?: RetrieveMode
  k?: number
  rank?: VectorRanker
}

/**
 * Top `k` chunks for `query`. `vector` and `hybrid` fall back to keyword when
 * `rank` is missing or answers null, so a stopped Ollama never means no results.
 */
export async function retrieveChunks(query: string, chunks: readonly DocChunk[], opts: RetrieveOptions = {}): Promise<Hit[]> {
  const k = opts.k ?? 6
  const mode = opts.mode ?? "hybrid"
  if (!chunks.length || !query.trim()) return []
  const keyword = mode === "vector" ? null : keywordScores(query, chunks)
  const vector = mode === "keyword" || !opts.rank ? null : await opts.rank(query, chunks.map((c) => c.text))
  const scores = keyword && vector ? fuse([keyword, vector]) : (vector ?? keyword ?? keywordScores(query, chunks))
  return scores
    .map((score, i) => ({ chunk: chunks[i]!, score }))
    .filter((h) => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}
