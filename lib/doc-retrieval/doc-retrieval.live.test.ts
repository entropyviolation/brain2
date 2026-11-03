/**
 * Opt-in: the three retrieval modes against the real Ollama embedder, on the fixture manual.
 * `DOC_LIVE=1 npx vitest run lib/doc-retrieval/doc-retrieval.live.test.ts`
 * Needs Ollama with `nomic-embed-text` (`EMBED_MODEL` in `lib/bim-flow/ollama.ts`). Chunks are embedded whole
 * (`embedTexts`) into a `VectorStore`. Prints recall@1, recall@5 and MRR per mode and question kind.
 */
import { describe, expect, it } from "vitest"
import { chunkDocument } from "./chunk"
import { scoreRetriever } from "./eval"
import { FIXTURE_CASES, FIXTURE_PAGES } from "./fixture"
import { embedTexts, indexDocument, storeRanker } from "./index-document"
import { retrieveChunks } from "./retrieve"
import type { RetrieveMode } from "./types"
import { VectorStore } from "./vector-store"

const live = process.env.DOC_LIVE === "1"
const chunks = chunkDocument("manual", FIXTURE_PAGES, { wholeUnder: 0, max: 700, overlap: 80 })

describe.skipIf(!live)("live: retrieval modes on the fixture manual", () => {
  it("scores keyword, vector and hybrid", async () => {
    const store = new VectorStore()
    // retrieveChunks falls back to keyword on a null, so a missing model would score as vector. Index first and check.
    const indexed = await indexDocument(store, chunks, embedTexts, "manual")
    if (indexed === null) console.warn("No embedding model answered (try `ollama pull nomic-embed-text`). Keyword rows only.")
    const rank = storeRanker(store, chunks, embedTexts, { namespace: "manual" })
    const modes: RetrieveMode[] = indexed === null ? ["keyword"] : ["keyword", "vector", "hybrid"]
    const rows: Record<string, unknown>[] = []
    for (const mode of modes) {
      for (const kind of ["exact", "paraphrase"] as const) {
        const cases = FIXTURE_CASES.filter((c) => c.kind === kind)
        const run = (q: string) => retrieveChunks(q, chunks, { mode, rank, k: 5 })
        const top1 = await scoreRetriever(cases, run, 1)
        const top5 = await scoreRetriever(cases, run, 5)
        rows.push({ mode, kind, recall1: +top1.recallAtK.toFixed(2), recall5: +top5.recallAtK.toFixed(2), mrr: +top5.mrr.toFixed(2) })
      }
    }
    console.table(rows)
    expect(rows.length).toBeGreaterThan(0)
  }, 120_000)
})
