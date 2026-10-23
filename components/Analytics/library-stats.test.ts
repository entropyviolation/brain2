import { describe, expect, it } from "vitest"
import { areaRollup, bins, crossTab, shannon, spearman, stageSteps, summarize, tagPairs } from "./library-stats"

describe("library-stats", () => {
  it("summarizes values", () => {
    const s = summarize([1, 2, 3, 4, 5])
    expect(s).toMatchObject({ n: 5, mean: 3, median: 3, min: 1, max: 5, q1: 2, q3: 4 })
    expect(s.sd).toBeCloseTo(1.5811, 3)
    expect(summarize([]).n).toBe(0)
  })

  it("measures Shannon evenness", () => {
    expect(shannon([5, 5]).evenness).toBeCloseTo(1)
    expect(shannon([5, 5]).bits).toBeCloseTo(1)
    expect(shannon([10, 0]).evenness).toBe(1)
    expect(shannon([]).k).toBe(0)
  })

  it("ranks Spearman with ties", () => {
    expect(spearman([1, 2, 3, 4], [10, 20, 30, 40])).toBeCloseTo(1)
    expect(spearman([1, 2, 3, 4], [4, 3, 2, 1])).toBeCloseTo(-1)
    expect(spearman([1, 1, 1], [1, 2, 3])).toBeNull()
    expect(spearman([1, 2], [1, 2])).toBeNull()
  })

  it("scores tag pairs with Jaccard and lift", () => {
    const pairs = tagPairs([
      { id: "a", tags: ["x", "y"] },
      { id: "b", tags: ["x", "y"] },
      { id: "c", tags: ["x"] },
      { id: "d", tags: ["z"] },
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]).toMatchObject({ a: "x", b: "y", count: 2, ids: ["a", "b"] })
    expect(pairs[0].jaccard).toBeCloseTo(2 / 3)
    expect(pairs[0].lift).toBeCloseTo((2 * 4) / (3 * 2))
  })

  it("cross-tabs integer pairs and skips nulls", () => {
    const cells = crossTab(
      [
        { id: "a", x: 1, y: 2 },
        { id: "b", x: 1, y: 2 },
        { id: "c", x: null, y: 1 },
      ],
      (t) => t.x,
      (t) => t.y,
    )
    expect(cells).toEqual([{ x: 1, y: 2, count: 2, ids: ["a", "b"] }])
  })

  it("orders stage steps and ages them", () => {
    const now = new Date("2026-01-11").getTime()
    const steps = stageSteps(
      [
        { id: "a", stage: "inbox", createdAt: new Date("2026-01-01") },
        { id: "b", stage: "completed", createdAt: new Date("2026-01-01"), completedDate: new Date("2026-01-03") },
        { id: "c" },
      ],
      now,
    )
    expect(steps.map((s) => s.id)).toEqual(["inbox", "clarified", "scheduled", "completed", "list"])
    expect(steps[0].medianDays).toBeCloseTo(10)
    expect(steps[3].medianDays).toBeCloseTo(2)
    expect(steps[4].count).toBe(1)
    expect(steps[1].medianDays).toBeNull()
  })

  it("rolls lists up to areas without double counting", () => {
    const areas = areaRollup(
      [
        { id: "home", name: "Home", color: "#111" },
        { id: "kitchen", name: "Kitchen", color: "#222", parentListId: "home" },
        { id: "work", name: "Work", color: "#333" },
      ],
      [
        { id: "1", lists: ["home", "kitchen"] },
        { id: "2", lists: ["kitchen"] },
        { id: "3", lists: ["work"] },
      ],
    )
    expect(areas[0]).toMatchObject({ id: "home", count: 2 })
    expect(areas[0].lists.map((l) => l.id)).toEqual(["kitchen", "home"])
    expect(areas[1]).toMatchObject({ id: "work", count: 1 })
  })

  it("bins values evenly", () => {
    expect(bins([1, 1, 1])).toEqual([{ lo: 1, hi: 1, n: 3 }])
    const b = bins([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)
    expect(b).toHaveLength(5)
    expect(b.reduce((s, x) => s + x.n, 0)).toBe(11)
  })
})
