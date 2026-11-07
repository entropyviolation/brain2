import { describe, expect, it } from "vitest"
import { extractKeyphrases, KEYPHRASE_METHODS } from "./index"

const TEXT = `A rhizome has no beginning or end; it is always in the middle, between things. The rhizome is not a tree. A tree has roots and a centre, but the rhizome connects any point to any other point. Becoming-animal is not imitation. A plateau is a continuous region of intensity, vibrating on itself. The rhizome makes plateaus, and plateaus make a rhizome.`

describe("keyphrases", () => {
  for (const m of KEYPHRASE_METHODS) {
    it(`${m.id} finds the topic, scores high to low, with no repeats`, () => {
      const out = extractKeyphrases(m.id, TEXT, { top: 8 })
      expect(out.length).toBeGreaterThan(2)
      expect(out.length).toBeLessThanOrEqual(8)
      expect(out.map((p) => p.phrase.toLowerCase()).join(" ")).toMatch(/rhizome/)
      for (let i = 1; i < out.length; i++) expect(out[i - 1]!.score).toBeGreaterThanOrEqual(out[i]!.score)
      expect(new Set(out.map((p) => p.phrase.toLowerCase())).size).toBe(out.length)
    })
  }
  it("is deterministic and survives empty input", () => {
    expect(extractKeyphrases("yake", TEXT)).toEqual(extractKeyphrases("yake", TEXT))
    for (const m of KEYPHRASE_METHODS) expect(extractKeyphrases(m.id, "")).toEqual([])
  })
})
