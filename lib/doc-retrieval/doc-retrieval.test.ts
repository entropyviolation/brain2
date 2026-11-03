import { describe, expect, it } from "vitest"
import { chunkDocument, isHeading } from "./chunk"
import { scoreRetriever } from "./eval"
import { FIXTURE_CASES, FIXTURE_PAGES } from "./fixture"
import { fuse, keywordScores, retrieveChunks, tokens } from "./retrieve"
import type { DocPage, EvalCase } from "./types"

const chunks = chunkDocument("manual", FIXTURE_PAGES, { wholeUnder: 0, max: 700, overlap: 80 })

describe("chunkDocument", () => {
  it("returns one chunk for a document short enough to read whole", () => {
    const out = chunkDocument("one", [{ page: 1, text: "Just one short page." }])
    expect(out).toHaveLength(1)
    expect(out[0]!.text).toBe("Just one short page.")
  })

  it("returns nothing for a scan with no text", () => {
    expect(chunkDocument("scan", [{ page: 1, text: "  " }, { page: 2, text: "" }])).toEqual([])
  })

  it("starts a new chunk at a heading and remembers the heading and page", () => {
    const warranty = chunks.find((c) => c.heading === "8. WARRANTY")
    expect(warranty?.page).toBe(8)
    expect(chunks.every((c) => c.text.length <= 700 + 80 + 2)).toBe(true)
  })

  it("cuts a very long paragraph at sentences, not mid-word", () => {
    const sentence = "The quick brown fox jumps over the lazy dog. "
    const page: DocPage = { page: 1, text: sentence.repeat(60) }
    const out = chunkDocument("long", [page], { wholeUnder: 0, max: 400, overlap: 0 })
    expect(out.length).toBeGreaterThan(5)
    expect(out.every((c) => c.text.endsWith("dog."))).toBe(true)
  })

  it("repeats the tail of the previous chunk", () => {
    const text = Array.from({ length: 12 }, (_, i) => `Paragraph ${i} ${"word ".repeat(40)}`).join("\n\n")
    const out = chunkDocument("o", [{ page: 1, text }], { wholeUnder: 0, max: 500, overlap: 60 })
    expect(out.length).toBeGreaterThan(2)
    const prevTail = out[0]!.text.slice(-30)
    expect(out[1]!.text.includes(prevTail.trim().split(" ").slice(-2).join(" "))).toBe(true)
  })

  it("spots headings but not sentences", () => {
    expect(isHeading("3. GRINDER SETTINGS")).toBe(true)
    expect(isHeading("## Cleaning")).toBe(true)
    expect(isHeading("WARRANTY")).toBe(true)
    expect(isHeading("Rinse the tank and fill it to the line.")).toBe(false)
  })
})

describe("keyword search", () => {
  it("drops stop words and lowercases", () => {
    expect(tokens("The Gasket is in the Box")).toEqual(["gasket", "box"])
  })

  it("scores a rare exact term above a common one", () => {
    const s = keywordScores("KX-GSK-58", chunks)
    const best = s.indexOf(Math.max(...s))
    expect(chunks[best]!.text).toContain("KX-GSK-58")
  })

  it("returns nothing for an empty query or empty document", async () => {
    expect(await retrieveChunks("", chunks)).toEqual([])
    expect(await retrieveChunks("gasket", [])).toEqual([])
  })
})

describe("fuse", () => {
  it("lifts an item both lists like over one only a single list likes", () => {
    const merged = fuse([[0, 5, 4], [0, 4, 5]])
    expect(merged[0]).toBe(0)
    expect(merged[1]).toBeGreaterThan(0)
    expect(merged[2]).toBeGreaterThan(0)
  })
})

describe("fallback", () => {
  it("falls back to keyword when the embedder answers null", async () => {
    const hits = await retrieveChunks("KX-GSK-58", chunks, { mode: "vector", rank: async () => null, k: 1 })
    expect(hits[0]?.chunk.text).toContain("KX-GSK-58")
  })
})

describe("eval on the fixture manual", () => {
  const by = (kind: EvalCase["kind"]) => FIXTURE_CASES.filter((c) => c.kind === kind)
  const keyword = (q: string) => retrieveChunks(q, chunks, { mode: "keyword", k: 5 })

  it("keyword search finds nearly every exact-term question", async () => {
    const s = await scoreRetriever(by("exact"), keyword, 5)
    expect(s.recallAtK).toBeGreaterThanOrEqual(5 / 6)
  })

  it("records the keyword baseline on all questions (floor, not target)", async () => {
    const s = await scoreRetriever(FIXTURE_CASES, keyword, 5)
    expect(s.cases).toBe(FIXTURE_CASES.length)
    expect(s.recallAtK).toBeGreaterThanOrEqual(0.5)
  })

  it("a perfect embedder finds every question, and hybrid keeps keyword's exact hits", async () => {
    // Oracle ranker: scores a chunk 1 when it contains the case's answer phrase.
    const oracle = async (q: string, texts: string[]) => {
      const c = FIXTURE_CASES.find((x) => x.question === q)!
      return texts.map((t) => (t.toLowerCase().includes(c.answer.toLowerCase()) ? 1 : 0))
    }
    const hybrid = (q: string) => retrieveChunks(q, chunks, { mode: "hybrid", rank: oracle, k: 5 })
    const s = await scoreRetriever(FIXTURE_CASES, hybrid, 5)
    expect(s.recallAtK).toBe(1)
  })
})
