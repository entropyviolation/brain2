import { describe, expect, it } from "vitest"
import { chunkDocument } from "./chunk"
import { indexDocument, storeRanker, type Embedder } from "./index-document"
import { retrieveChunks } from "./retrieve"
import { matchesFilter, VectorStore, type Filter } from "./vector-store"

const seed = () => {
  const s = new VectorStore()
  s.upsert(
    [
      { id: "a", values: [1, 0, 0], metadata: { docId: "d1", page: 1, tags: ["x", "y"] } },
      { id: "b", values: [0.9, 0.1, 0], metadata: { docId: "d1", page: 5 } },
      { id: "c", values: [0, 1, 0], metadata: { docId: "d2", page: 2 } },
    ],
    "item-1",
  )
  return s
}

describe("VectorStore", () => {
  it("ranks by cosine and respects topK", () => {
    const { matches } = seed().query({ vector: [1, 0, 0], topK: 2, namespace: "item-1" })
    expect(matches.map((m) => m.id)).toEqual(["a", "b"])
    expect(matches[0]!.score).toBeCloseTo(1)
  })

  it("is scale-free: a long vector scores the same as a short one", () => {
    const s = new VectorStore()
    s.upsert([{ id: "a", values: [10, 0] }])
    expect(s.query({ vector: [0.001, 0], topK: 1 }).matches[0]!.score).toBeCloseTo(1)
  })

  it("keeps namespaces apart", () => {
    const s = seed()
    expect(s.query({ vector: [1, 0, 0], topK: 5 }).matches).toEqual([])
    expect(s.query({ vector: [1, 0, 0], topK: 5, namespace: "item-1" }).matches).toHaveLength(3)
  })

  it("filters on metadata like Pinecone", () => {
    const s = seed()
    const ids = (filter: Filter) => s.query({ vector: [1, 0, 0], topK: 9, namespace: "item-1", filter }).matches.map((m) => m.id)
    expect(ids({ docId: "d2" })).toEqual(["c"])
    expect(ids({ page: { $gte: 2, $lt: 6 } }).sort()).toEqual(["b", "c"])
    expect(ids({ docId: { $in: ["d1"] }, page: { $gt: 1 } })).toEqual(["b"])
    expect(ids({ $or: [{ docId: "d2" }, { page: 1 }] }).sort()).toEqual(["a", "c"])
    expect(ids({ tags: "y" })).toEqual(["a"])
    expect(ids({ tags: { $exists: false } }).sort()).toEqual(["b", "c"])
    expect(ids({ docId: { $nin: ["d1"] } })).toEqual(["c"])
  })

  it("rejects unknown operators and wrong dimensions", () => {
    expect(() => matchesFilter({ a: 1 }, { a: { $regex: "x" } })).toThrow(/Unsupported/)
    const s = seed()
    expect(() => s.upsert([{ id: "z", values: [1, 2] }])).toThrow(/index is 3/)
    expect(() => s.query({ vector: [1, 2], topK: 1 })).toThrow(/index is 3/)
  })

  it("returns metadata and values only when asked", () => {
    const s = seed()
    const bare = s.query({ vector: [1, 0, 0], topK: 1, namespace: "item-1" }).matches[0]!
    expect(bare.metadata).toBeUndefined()
    const full = s.query({ vector: [1, 0, 0], topK: 1, namespace: "item-1", includeMetadata: true, includeValues: true }).matches[0]!
    expect(full.metadata?.docId).toBe("d1")
    expect(full.values).toHaveLength(3)
  })

  it("fetches, updates, and deletes by id, filter and all", () => {
    const s = seed()
    expect(Object.keys(s.fetch(["a", "nope"], "item-1"))).toEqual(["a"])
    s.update({ id: "a", setMetadata: { page: 9 }, namespace: "item-1" })
    expect(s.fetch(["a"], "item-1").a!.metadata).toMatchObject({ page: 9, docId: "d1" })
    s.update({ id: "missing", setMetadata: { page: 1 }, namespace: "item-1" })
    s.delete({ ids: ["b"], namespace: "item-1" })
    s.delete({ filter: { docId: "d2" }, namespace: "item-1" })
    expect(s.describeIndexStats()).toEqual({ dimension: 3, totalRecordCount: 1, namespaces: { "item-1": { recordCount: 1 } } })
    s.delete({ deleteAll: true, namespace: "item-1" })
    expect(s.describeIndexStats().totalRecordCount).toBe(0)
  })

  it("upsert replaces a record with the same id", () => {
    const s = seed()
    s.upsert([{ id: "a", values: [0, 0, 1] }], "item-1")
    expect(s.query({ vector: [0, 0, 1], topK: 1, namespace: "item-1" }).matches[0]!.id).toBe("a")
    expect(s.describeIndexStats().totalRecordCount).toBe(3)
  })

  it("survives a JSON round trip", () => {
    const copy = VectorStore.fromJSON(JSON.parse(JSON.stringify(seed())))
    expect(copy.describeIndexStats()).toEqual(seed().describeIndexStats())
    expect(copy.query({ vector: [1, 0, 0], topK: 1, namespace: "item-1", includeMetadata: true }).matches[0]!.metadata?.page).toBe(1)
  })
})

describe("indexDocument + storeRanker", () => {
  // A toy embedder: counts of three themes, so no model is needed.
  const embed: Embedder = async (texts) =>
    texts.map((t) => {
      const l = t.toLowerCase()
      return [/warranty|receipt|claim/.test(l) ? 1 : 0, /grind|setting|shot/.test(l) ? 1 : 0, /descal|clean/.test(l) ? 1 : 0.01]
    })
  const pages = [
    { page: 1, text: "WARRANTY\n\nKeep your receipt. To make a claim contact support." },
    { page: 2, text: "GRINDER\n\nSet the grind to setting 5 for a double shot." },
  ]
  const chunks = chunkDocument("m", pages, { wholeUnder: 0, max: 200, overlap: 0 })

  it("indexes chunks with page metadata and ranks through hybrid retrieval", async () => {
    const store = new VectorStore()
    expect(await indexDocument(store, chunks, embed, "item-7")).toBe(chunks.length)
    const rank = storeRanker(store, chunks, embed, { namespace: "item-7" })
    const hits = await retrieveChunks("how do I file a claim", chunks, { mode: "vector", rank, k: 1 })
    expect(hits[0]!.chunk.page).toBe(1)
    const scoped = storeRanker(store, chunks, embed, { namespace: "item-7", filter: { page: 2 } })
    const only2 = await retrieveChunks("how do I file a claim", chunks, { mode: "vector", rank: scoped, k: 5 })
    expect(only2.every((h) => h.chunk.page === 2)).toBe(true)
  })

  it("passes a null embedder through without throwing", async () => {
    const store = new VectorStore()
    expect(await indexDocument(store, chunks, async () => null)).toBeNull()
    expect(await storeRanker(store, chunks, async () => null)("q", ["t"])).toBeNull()
  })
})
