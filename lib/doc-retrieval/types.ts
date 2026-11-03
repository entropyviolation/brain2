/**
 * lib/doc-retrieval/types.ts — Shapes for finding the right passage in an uploaded document
 */

/** One page of extracted text, 1-based. A scanned page has empty text. */
export interface DocPage {
  page: number
  text: string
}

export interface DocChunk {
  /** `<docId>#<n>`, stable for a given document and chunker setting. */
  id: string
  docId: string
  text: string
  /** First page the chunk touches. */
  page: number
  /** Nearest heading above the chunk, empty when the page has none. */
  heading: string
}

export type RetrieveMode = "keyword" | "vector" | "hybrid"

export interface Hit {
  chunk: DocChunk
  score: number
}

/** Same shape as `Ranker` in `lib/bim-flow/retrieve.ts`: cosine-like scores, or null when no embedding model answered. */
export type VectorRanker = (query: string, texts: string[]) => Promise<number[] | null>

/** A labelled question: the chunk(s) that answer it are the ones whose text contains `answer`. */
export interface EvalCase {
  question: string
  /** A phrase that appears in the chunk that answers the question. */
  answer: string
  /** `exact` leans on a rare term, `paraphrase` shares no key words with the answer. */
  kind: "exact" | "paraphrase"
}

export interface EvalScore {
  cases: number
  /** Share of questions whose answer chunk is in the top k. */
  recallAtK: number
  /** Mean of 1 / rank of the answer chunk, 0 when missing. */
  mrr: number
  k: number
}
