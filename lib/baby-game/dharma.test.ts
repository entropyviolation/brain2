import { describe, expect, it } from "vitest"
import { RESIDENTS } from "./cast"
import { isTeaching, LESSONS, pathBrief, PATHS, pathTalk } from "./dharma"
import { QUESTS } from "./quests"

describe("the friends' outlooks", () => {
  it("gives every resident one complete path", () => {
    for (const r of RESIDENTS) {
      const p = PATHS[r.id]
      expect(p, r.id).toBeDefined()
      for (const text of [p!.idea, p!.source, p!.belief, p!.koan, p!.counsel, p!.practice, ...p!.sayings]) expect(text.trim().length, r.id).toBeGreaterThan(8)
    }
    expect(Object.keys(PATHS).sort()).toEqual(RESIDENTS.map((r) => r.id).sort())
  })

  it("draws on all three traditions", () => {
    const schools = new Set(Object.values(PATHS).map((p) => p.school))
    expect([...schools].sort()).toEqual(["Buddhism", "Taoism", "Zen"])
  })

  it("gives every quest a lesson, and no lesson without a quest", () => {
    for (const q of QUESTS) expect(LESSONS[q.id], q.id).toBeDefined()
    expect(Object.keys(LESSONS).sort()).toEqual(QUESTS.map((q) => q.id).sort())
  })

  it("cycles sayings into talk and recognises them as teachings", () => {
    const seen = new Set([0, 1, 2].map((i) => pathTalk("wolf", i)))
    expect(seen.size).toBe(3)
    for (const line of seen) expect(isTeaching("wolf", line)).toBe(true)
    expect(isTeaching("wolf", "nice weather")).toBe(false)
    expect(pathTalk("nobody", 0)).toBe("")
  })

  it("tells the model to be light-handed", () => {
    expect(pathBrief("chick")).toMatch(/Never lecture/)
    expect(pathBrief("nobody")).toBe("")
  })
})
