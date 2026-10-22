import { describe, expect, it } from "vitest"
import { bgeScore, type BgeEntry } from "@/lib/bge-score"

const rows = (tier: BgeEntry["tier"], done: number, total: number): BgeEntry[] =>
  Array.from({ length: total }, (_, i) => ({ tier, done: i < done }))

describe("bgeScore", () => {
  it("pays Exceptional at the Goal rate, on top (5 goals, 2 done, 2 exceptional done = 24)", () => {
    const s = bgeScore([...rows("goal", 2, 5), ...rows("exceptional", 2, 3)])
    expect(s.points - 70).toBeCloseTo(24)
    expect(s.bonus).toBeCloseTo(12)
  })
  it("weighs Bare minimum 70 and Goal 30", () => {
    const s = bgeScore([...rows("min", 1, 2), ...rows("goal", 1, 2)])
    expect(s.points).toBeCloseTo(35 + 15)
  })
  it("can pass 100 through bonus", () => {
    expect(bgeScore([...rows("min", 1, 1), ...rows("goal", 1, 1), ...rows("exceptional", 1, 1)]).points).toBeCloseTo(130)
  })
  it("treats an empty tier as met and pays no bonus without Goal tasks", () => {
    expect(bgeScore([...rows("min", 0, 1)]).points).toBeCloseTo(30)
    expect(bgeScore([...rows("exceptional", 2, 2)]).bonus).toBe(0)
  })
})
