/**
 * lib/doc-retrieval/eval.ts — Score a retriever against labelled questions
 *
 * A case is right when a returned chunk contains its `answer` phrase. The same
 * cases run against keyword, vector and hybrid, so a change to the chunker or
 * the embedding model shows up as a number. Pure: the retriever is passed in.
 */
import type { DocChunk, EvalCase, EvalScore, Hit } from "./types"

export type Retriever = (question: string) => Promise<Hit[]>

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ")

export function answers(chunk: DocChunk, c: EvalCase): boolean {
  return norm(chunk.text).includes(norm(c.answer))
}

export async function scoreRetriever(cases: readonly EvalCase[], retrieve: Retriever, k = 5): Promise<EvalScore> {
  let found = 0
  let rr = 0
  for (const c of cases) {
    const hits = (await retrieve(c.question)).slice(0, k)
    const rank = hits.findIndex((h) => answers(h.chunk, c))
    if (rank >= 0) {
      found += 1
      rr += 1 / (rank + 1)
    }
  }
  const n = cases.length || 1
  return { cases: cases.length, recallAtK: found / n, mrr: rr / n, k }
}
