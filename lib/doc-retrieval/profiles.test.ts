import { describe, expect, it } from "vitest"
import { chunkDocument } from "./chunk"
import { FIXTURE_CASES, FIXTURE_PAGES } from "./fixture"
import { chooseMode, indexKey, packContext, profileFor, PURPOSE_PROFILES, retrieveForAgent } from "./profiles"
import type { DocChunk, Hit } from "./types"

const chunks = chunkDocument("manual", FIXTURE_PAGES, { wholeUnder: 0, max: 700, overlap: 80 })
const hit = (text: string, page = 1, heading = ""): Hit => ({ chunk: { id: text, docId: "d", text, page, heading } as DocChunk, score: 1 })

describe("profileFor", () => {
  it("defaults to lookup for an agent with no purpose", () => {
    expect(profileFor("unknown").purpose).toBe("lookup")
  })

  it("takes the purpose from the map, and lets an agent override one field", () => {
    const p = profileFor("notes", { k: 9, chunk: { max: 500 } }, { notes: "explain" })
    expect(p.purpose).toBe("explain")
    expect(p.k).toBe(9)
    expect(p.chunk).toEqual({ ...PURPOSE_PROFILES.explain.chunk, max: 500 })
    expect(PURPOSE_PROFILES.explain.k).toBe(6)
  })

  it("an explicit purpose beats the map", () => {
    expect(profileFor("notes", { purpose: "extract" }, { notes: "explain" }).purpose).toBe("extract")
  })

  it("purposes differ in the ways they should", () => {
    const { lookup, explain, extract } = PURPOSE_PROFILES
    expect(lookup.chunk.max).toBeLessThan(explain.chunk.max)
    expect(lookup.budgetChars).toBeLessThan(extract.budgetChars)
    expect(lookup.k).toBeLessThan(extract.k)
  })

  it("keys an index by chunk settings so a changed profile never reads stale chunks", () => {
    expect(indexKey("item-1", PURPOSE_PROFILES.lookup)).not.toBe(indexKey("item-1", PURPOSE_PROFILES.explain))
  })
})

describe("packContext", () => {
  it("stops at the budget but always keeps the first hit", () => {
    const hits = [hit("a".repeat(100), 3, "WARRANTY"), hit("b".repeat(100), 4), hit("c".repeat(100), 5)]
    expect(packContext(hits, 250).used).toHaveLength(2)
    expect(packContext(hits, 10).used).toHaveLength(1)
    expect(packContext(hits, 250).text.startsWith("[p.3, WARRANTY]\n")).toBe(true)
  })

  it("is empty for no hits", () => {
    expect(packContext([], 100)).toEqual({ text: "", used: [] })
  })
})

describe("retrieveForAgent", () => {
  it("returns cited text within the agent's budget", async () => {
    const out = await retrieveForAgent("any", "KX-GSK-58 gasket part number", chunks, undefined, { budgetChars: 900 })
    expect(out.text).toContain("KX-GSK-58")
    expect(out.text).toMatch(/\[p\.6/)
    expect(out.used.reduce((n, h) => n + h.chunk.text.length, 0)).toBeLessThanOrEqual(900 + (out.used[0]?.chunk.text.length ?? 0))
  })
})

describe("chooseMode", () => {
  const oracle = async (q: string, texts: string[]) => {
    const c = FIXTURE_CASES.find((x) => x.question === q)!
    return texts.map((t) => (t.toLowerCase().includes(c.answer.toLowerCase()) ? 1 : 0))
  }

  it("keeps the profile's mode when there are too few questions to trust", async () => {
    const choice = await chooseMode(PURPOSE_PROFILES.lookup, FIXTURE_CASES, chunks, oracle)
    expect(choice.mode).toBe("hybrid")
  })

  it("picks the mode that measures best once there are enough questions", async () => {
    const choice = await chooseMode({ ...PURPOSE_PROFILES.lookup, mode: "keyword" }, FIXTURE_CASES, chunks, oracle, 5)
    expect(choice.mode).not.toBe("keyword")
    expect(choice.scores.vector.recall1).toBe(1)
  })

  it("does not guess without an embedder", async () => {
    const choice = await chooseMode({ ...PURPOSE_PROFILES.lookup, mode: "keyword" }, FIXTURE_CASES, chunks, undefined, 1)
    expect(choice.mode).toBe("keyword")
  })
})
