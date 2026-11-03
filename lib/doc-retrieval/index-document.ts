/**
 * lib/doc-retrieval/index-document.ts — Put a document's chunks in the vector store, and search them
 *
 * `embedTexts` calls Ollama's embedder on whole chunks (no 400-character cut,
 * unlike `embedScores`). `indexDocument` embeds each chunk and upserts it to a
 * namespace named for the item, with page and heading as metadata, so a search
 * can be scoped to one document or one item and cite a page. `storeRanker` turns
 * the store back into a `VectorRanker`, so `retrieveChunks` hybrid mode works
 * unchanged. A null from the embedder is passed on, never thrown.
 */
import { EMBED_MODEL, OLLAMA_URL } from "@/lib/bim-flow/ollama"
import type { DocChunk, VectorRanker } from "./types"
import type { Filter, VectorStore } from "./vector-store"

/** `role` says whether the texts are passages being stored or a question being asked. Some models want to be told. */
export type Embedder = (texts: string[], role?: "document" | "query") => Promise<number[][] | null>

const BATCH = 16
/** nomic-embed-text reads 2048 tokens; this keeps a chunk well inside it. */
const MAX_CHARS = 6000

export const embedTexts: Embedder = async (texts, role = "document") => {
  // nomic-embed-text is trained with these task prefixes and ranks worse without them.
  const prefix = EMBED_MODEL.startsWith("nomic-embed") ? (role === "query" ? "search_query: " : "search_document: ") : ""
  try {
    const out: number[][] = []
    for (let i = 0; i < texts.length; i += BATCH) {
      const res = await fetch(`${OLLAMA_URL}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, input: texts.slice(i, i + BATCH).map((t) => prefix + t.slice(0, MAX_CHARS)) }),
      })
      if (!res.ok) return null
      const body = (await res.json()) as { embeddings?: number[][] }
      if (!body.embeddings || body.embeddings.length !== Math.min(BATCH, texts.length - i)) return null
      out.push(...body.embeddings)
    }
    return out
  } catch {
    return null
  }
}

/** Embeds `chunks` and upserts them. Returns how many went in, or null when no embedding model answered. */
export async function indexDocument(
  store: VectorStore,
  chunks: readonly DocChunk[],
  embed: Embedder,
  namespace = "",
): Promise<number | null> {
  if (!chunks.length) return 0
  const vectors = await embed(chunks.map((c) => c.text))
  if (!vectors) return null
  store.upsert(
    chunks.map((c, i) => ({
      id: c.id,
      values: vectors[i]!,
      metadata: { docId: c.docId, page: c.page, heading: c.heading },
    })),
    namespace,
  )
  return chunks.length
}

/** A `VectorRanker` backed by the store. Scores come back in the order of `texts`; chunks not in the store score 0. */
export function storeRanker(
  store: VectorStore,
  chunks: readonly DocChunk[],
  embed: Embedder,
  opts: { namespace?: string; filter?: Filter } = {},
): VectorRanker {
  const idByText = new Map(chunks.map((c) => [c.text, c.id]))
  return async (query, texts) => {
    const q = await embed([query], "query")
    if (!q?.[0]) return null
    const { matches } = store.query({ vector: q[0], topK: texts.length, namespace: opts.namespace, filter: opts.filter })
    const byId = new Map(matches.map((m) => [m.id, m.score]))
    return texts.map((t) => Math.max(0, byId.get(idByText.get(t) ?? "") ?? 0))
  }
}
