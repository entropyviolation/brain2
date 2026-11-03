# `lib/doc-retrieval/` — Find the right passage in an uploaded document

_Last mapped: 2026-11-02_

A document can be one page or 800. A small local model can only read a few passages, so code picks them. This folder is
the chunker, a Pinecone-shaped vector store, three ways to search the chunks, and a scorer that says how good the search is. It is the first piece of
the document BIMBY: "a PDF attached to an item, answered from by a cheap local model". Nothing here runs a model,
reads a PDF, or writes storage.

## What is built

- **Chunk.** `chunk.ts` `chunkDocument(docId, pages, opts)`. A document at or under `WHOLE_DOC_UNDER` (8000 characters,
  about 2k tokens) comes back as one chunk: retrieval on a short document only loses context. A longer one splits at
  headings first (`isHeading`), then packs paragraphs up to `CHUNK_MAX` (1600 characters, about 400 tokens), then cuts
  an over-long paragraph at sentences. Each chunk repeats the last `CHUNK_OVERLAP` characters of the one before. Every
  chunk keeps its first `page` and nearest `heading`, so an answer can cite a page. A scan with no text gives `[]`.
- **Search.** `retrieve.ts` `retrieveChunks(query, chunks, { mode, k, rank })`. `keyword` is BM25. `vector` calls an
  injected `VectorRanker` (same shape as `Ranker` in `lib/bim-flow/retrieve.ts`; `embedScores` in
  `lib/bim-flow/ollama.ts` fits). `hybrid` merges the two by reciprocal rank fusion. A missing ranker, or one that
  answers `null`, falls back to keyword, so a stopped Ollama never means no results.
- **Score.** `eval.ts` `scoreRetriever(cases, retriever, k)` gives recall@k and MRR. A case is right when a returned
  chunk contains its `answer` phrase.
- **Fixture.** `fixture.ts` is a made-up espresso-machine manual (9 pages) and 12 labelled questions: 6 `exact` (share a
  rare word with the answer) and 6 `paraphrase` (share none).

- **Index.** `vector-store.ts` `VectorStore` emulates a Pinecone index in memory: namespaces, `upsert`, `query`
  (`topK`, metadata `filter` with `$eq $ne $gt $gte $lt $lte $in $nin $exists $and $or`, `includeMetadata`,
  `includeValues`), `fetch`, `update`, `delete` (ids, filter or all), `describeIndexStats`, and `toJSON` / `fromJSON`.
  Vectors are unit-normalised on the way in, search is exact brute force. A hosted index can replace it without
  changing callers.
- **Index a document.** `index-document.ts` `embedTexts` embeds whole chunks with Ollama (`nomic-embed-text` gets its
  `search_document:` / `search_query:` prefixes). `indexDocument(store, chunks, embed, namespace)` upserts them with
  `docId`, `page` and `heading` metadata, one namespace per item. `storeRanker` turns the store back into a
  `VectorRanker` (optionally filtered), so `retrieveChunks` hybrid mode runs on it unchanged. A null embedder is passed
  on, never thrown.

- **Per agent.** `profiles.ts`. How to search depends on what the agent is for. A `RetrievalProfile` holds mode, `k`,
  chunk size and a context budget. Three purposes give starting profiles: `lookup` (one fact: small chunks, k 4, 3200
  characters), `explain` (prose: 1600-character chunks, k 6, 8000) and `extract` (every instance: k 12, 16000).
  `AGENT_PURPOSE` maps a `Blueprint.id` to a purpose and is empty until an agent first reads documents.
  `profileFor(agentId, override)` lets one agent change a field. `indexKey(itemId, profile)` names the store
  namespace per chunk setting, since changed settings mean different chunks. `retrieveForAgent` searches and returns
  text cut to the budget, each chunk headed `[p.N, heading]`. `chooseMode` scores keyword, vector and hybrid on that
  agent's own questions and picks the best by MRR, then recall; with fewer than 20 questions, or no embedder, it
  keeps the profile's mode. The starting values are guesses, not measurements. The Blueprint envelope has fixed keys,
  so a profile is not a Blueprint field yet.

## Measured (fixture manual, `nomic-embed-text`, 2026-11-02)

| Mode | Questions | recall@1 | recall@5 | MRR |
|------|-----------|----------|----------|-----|
| keyword | exact | 1.00 | 1.00 | 1.00 |
| keyword | paraphrase | 0.50 | 1.00 | 0.67 |
| vector | exact | 1.00 | 1.00 | 1.00 |
| vector | paraphrase | 0.50 | 0.67 | 0.53 |
| hybrid | exact | 1.00 | 1.00 | 1.00 |
| hybrid | paraphrase | 0.50 | 1.00 | 0.60 |

**This does not yet show vector or hybrid beating keyword.** Six questions per kind means one question moves a score
by 0.17, and the fixture has about 20 chunks. Task prefixes made no clear difference. Do not tune on these numbers.
Grow the fixture (a long real PDF, 50+ questions, many near-duplicate sections) before choosing a mode.

## Run

```bash
npx vitest run lib/doc-retrieval
```

```bash
DOC_LIVE=1 npx vitest run lib/doc-retrieval/doc-retrieval.live.test.ts
```

The live test prints a table per mode. It warns and prints keyword rows only when no embedding model answers.

## Known limits

- `embedScores` in `lib/bim-flow/ollama.ts` cuts each text to 400 characters, so it is not used for chunks. Use
  `embedTexts`.
- The store lives in memory. Nothing saves it yet; `toJSON` is the seam.
- Sizes are characters, not tokens. No tokenizer.
- The fixture is synthetic and tiny. Add questions from real uploaded documents, including a long one.

## Planned

- Save the `VectorStore` per attachment (IndexedDB), built in the background and resumable, keyed to the
  `idb:<id>` attachment in `lib/attachments.ts`.
- PDF text in (`pdf-parse` is installed), with a flag for pages that came out empty and need OCR.
- A section table of contents with a short summary per section, for documents of hundreds of pages.
- A reranker, and the Blueprint tool that hands the top chunks to a BIMBY with their page numbers.
- If scanned pages or tables matter more than staying in one runtime, a Haystack sidecar behind the same
  `retrieveChunks` interface. Measure with this scorer first.

Files: `types.ts`, `chunk.ts`, `retrieve.ts`, `eval.ts`, `fixture.ts`, `vector-store.ts`, `index-document.ts`,
`profiles.ts`, `doc-retrieval.test.ts`, `vector-store.test.ts`, `profiles.test.ts`, `doc-retrieval.live.test.ts`.
