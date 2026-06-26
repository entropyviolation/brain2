import { describe, it, expect } from "vitest"
import {
  tokenize,
  normalizeText,
  scoreBookMatch,
  rankBookMatches,
  bestBookMatch,
  findBookMatch,
  DEFAULT_MATCH_THRESHOLD,
  type BookMatchCandidate,
} from "./book-match"

const BOOKS: BookMatchCandidate[] = [
  { id: "b1", title: "The Left Hand of Darkness", author: "Ursula K. Le Guin" },
  { id: "b2", title: "Dune", author: "Frank Herbert" },
  { id: "b3", title: "The Three-Body Problem", author: "Liu Cixin" },
  { id: "b4", title: "Project Hail Mary", author: "Andy Weir" },
]

describe("tokenize", () => {
  it("drops punctuation, stopwords, and short tokens", () => {
    expect(tokenize("The Left-Hand of Darkness.pdf")).toEqual(["left", "hand", "darkness"])
  })

  it("returns an empty list for empty / noise-only input", () => {
    expect(tokenize("   the a of  ")).toEqual([])
    expect(tokenize("")).toEqual([])
  })
})

describe("normalizeText", () => {
  it("lowercases and collapses non-alphanumerics", () => {
    expect(normalizeText("The Three-Body Problem!")).toBe("the three body problem")
  })
})

describe("scoreBookMatch", () => {
  it("scores an exact title near the top of the range", () => {
    const s = scoreBookMatch("Dune", BOOKS[1])
    expect(s).toBeGreaterThan(0.8)
  })

  it("rewards a verbatim title embedded in extracted body text", () => {
    const body = "excerpt ... the left hand of darkness ... chapter one ..."
    expect(scoreBookMatch(body, BOOKS[0])).toBeGreaterThan(scoreBookMatch(body, BOOKS[1]))
  })

  it("gives a low score to unrelated text", () => {
    expect(scoreBookMatch("quarterly tax spreadsheet", BOOKS[2])).toBeLessThan(DEFAULT_MATCH_THRESHOLD)
  })

  it("stays within [0, 1]", () => {
    for (const b of BOOKS) {
      const s = scoreBookMatch(b.title + " " + (b.author ?? ""), b)
      expect(s).toBeGreaterThanOrEqual(0)
      expect(s).toBeLessThanOrEqual(1)
    }
  })
})

describe("rankBookMatches / bestBookMatch", () => {
  it("ranks the correct book first for a fuzzy title", () => {
    const ranked = rankBookMatches("three body problem (liu)", BOOKS)
    expect(ranked[0].candidateId).toBe("b3")
  })

  it("returns null for an empty candidate set", () => {
    expect(bestBookMatch("anything", [])).toBeNull()
  })
})

describe("findBookMatch", () => {
  it("returns the best match when it clears the threshold", () => {
    const m = findBookMatch("Project Hail Mary by Andy Weir", BOOKS)
    expect(m?.candidateId).toBe("b4")
  })

  it("returns null (no match → workflow should throw) below threshold", () => {
    expect(findBookMatch("invoice 2026 acme corp", BOOKS)).toBeNull()
  })

  it("respects a custom threshold", () => {
    // A weak partial overlap passes a very low bar but fails a strict one.
    const weak = "hand"
    expect(findBookMatch(weak, BOOKS, 0.05)).not.toBeNull()
    expect(findBookMatch(weak, BOOKS, 0.9)).toBeNull()
  })
})
