import { describe, expect, it } from "vitest"
import { RESIDENTS } from "./cast"
import { ITEMS } from "./items"
import { isTheoryLine, offeringOf, THEORY, theoryBrief, theoryTalk } from "./theory"

describe("the friends' politics", () => {
  it("gives every resident one complete idea, and no stranger one", () => {
    for (const r of RESIDENTS) {
      const t = THEORY[r.id]
      expect(t, r.id).toBeDefined()
      for (const text of [t!.idea, t!.source, t!.belief, t!.question, t!.counsel, t!.practice, ...t!.sayings]) expect(text.trim().length, r.id).toBeGreaterThan(8)
    }
    expect(Object.keys(THEORY).sort()).toEqual(RESIDENTS.map((r) => r.id).sort())
  })

  it("draws on several traditions, not one", () => {
    expect(new Set(Object.values(THEORY).map((t) => t.school)).size).toBeGreaterThanOrEqual(6)
  })

  it("has every friend bring something real and shareable to the shelf", () => {
    for (const r of RESIDENTS) {
      const id = offeringOf(r.id)!
      expect(ITEMS[id], r.id).toBeDefined()
      expect(ITEMS[id]!.kind, r.id).toBe("material")
    }
  })

  it("cycles remarks and recognises them as the friend's own", () => {
    const seen = new Set([0, 1, 2].map((i) => theoryTalk("cub", i)))
    expect(seen.size).toBe(3)
    for (const line of seen) expect(isTheoryLine("cub", line)).toBe(true)
    expect(isTheoryLine("cub", "nice weather")).toBe(false)
    expect(theoryTalk("nobody", 0)).toBe("")
  })

  it("tells the model to be light-handed and to mention the commons", () => {
    expect(theoryBrief("chick")).toMatch(/Never lecture/)
    expect(theoryBrief("chick")).toMatch(/Commons/)
    expect(theoryBrief("nobody")).toBe("")
  })
})
