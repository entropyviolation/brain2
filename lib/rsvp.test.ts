import { describe, expect, it } from "vitest"
import {
  chunkAt,
  chunkDelayMs,
  joinPdfItems,
  pivotIndex,
  splitPivot,
  tokenizeWords,
  wordWeight,
} from "@/lib/rsvp"

describe("tokenizeWords", () => {
  it("splits on whitespace and drops bare symbols", () => {
    expect(tokenizeWords("One  two\nthree — 4")).toEqual(["One", "two", "three", "4"])
  })
})

describe("pivot", () => {
  it("moves right with word length", () => {
    expect(pivotIndex("a")).toBe(0)
    expect(pivotIndex("read")).toBe(1)
    expect(pivotIndex("reading")).toBe(2)
    expect(pivotIndex("understanding")).toBe(3)
  })

  it("skips leading quotes", () => {
    expect(splitPivot("“hello,”")).toEqual({ before: "“h", pivot: "e", after: "llo,”" })
  })
})

describe("timing", () => {
  it("pauses longer at a full stop than a comma", () => {
    expect(wordWeight("end.")).toBeGreaterThan(wordWeight("pause,"))
    expect(wordWeight("pause,")).toBeGreaterThan(wordWeight("plain"))
  })

  it("is flat when pauses are off", () => {
    expect(wordWeight("end.", false)).toBe(1)
  })

  it("is 60000 / wpm for one plain word", () => {
    const words = ["plain"]
    expect(chunkDelayMs(words, chunkAt(words, 0, 1), 300, false)).toBe(200)
  })
})

describe("chunkAt", () => {
  const words = ["One", "two", "end.", "Next", "one"]

  it("groups up to the size", () => {
    expect(chunkAt(words, 0, 2)).toEqual({ start: 0, count: 2, text: "One two" })
  })

  it("stops at a sentence end", () => {
    expect(chunkAt(words, 1, 3)).toEqual({ start: 1, count: 2, text: "two end." })
  })

  it("stops at the last word", () => {
    expect(chunkAt(words, 4, 3).count).toBe(1)
  })
})

describe("joinPdfItems", () => {
  it("dehyphenates across a line end and joins lines", () => {
    const text = joinPdfItems([
      { str: "A read-", hasEOL: true },
      { str: "ing test", hasEOL: true },
      { str: "again", hasEOL: false },
    ])
    expect(text).toBe("A reading test again")
  })
})
