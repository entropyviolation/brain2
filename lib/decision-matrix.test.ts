import { describe, it, expect } from "vitest"
import {
  scoreDecisionMatrix,
  normalizeWeights,
  type MatrixCriterion,
  type MatrixOption,
} from "@/lib/decision-matrix"

describe("normalizeWeights", () => {
  it("renormalizes positive weights to sum to 1", () => {
    const w = normalizeWeights([
      { id: "a", weight: 1 },
      { id: "b", weight: 3 },
    ])
    expect(w.a).toBeCloseTo(0.25)
    expect(w.b).toBeCloseTo(0.75)
    expect(w.a + w.b).toBeCloseTo(1)
  })

  it("ignores zero and negative weights", () => {
    const w = normalizeWeights([
      { id: "a", weight: 2 },
      { id: "b", weight: 0 },
      { id: "c", weight: -5 },
    ])
    expect(w.a).toBeCloseTo(1)
    expect(w.b).toBe(0)
    expect(w.c).toBe(0)
  })

  it("returns all zeros when no positive weight exists", () => {
    const w = normalizeWeights([
      { id: "a", weight: 0 },
      { id: "b", weight: -1 },
    ])
    expect(w.a).toBe(0)
    expect(w.b).toBe(0)
  })
})

describe("scoreDecisionMatrix", () => {
  const criteria: MatrixCriterion[] = [
    { id: "price", weight: 2, benefit: false }, // lower is better
    { id: "rating", weight: 1, benefit: true }, // higher is better
  ]
  const options: MatrixOption[] = [
    { id: "x", label: "Cheap & ok", values: { price: 10, rating: 3 } },
    { id: "y", label: "Pricey & great", values: { price: 30, rating: 5 } },
    { id: "z", label: "Mid", values: { price: 20, rating: 4 } },
  ]

  it("ranks options highest score first and flags a single winner", () => {
    const res = scoreDecisionMatrix(options, criteria)
    expect(res.map((r) => r.id)).toEqual(["x", "z", "y"])
    expect(res[0].rank).toBe(1)
    expect(res[0].isWinner).toBe(true)
    expect(res.filter((r) => r.isWinner)).toHaveLength(1)
    // ranks strictly increase for distinct scores
    expect(res.map((r) => r.rank)).toEqual([1, 2, 3])
  })

  it("produces scores in [0,1] that equal the sum of contributions", () => {
    const res = scoreDecisionMatrix(options, criteria)
    for (const r of res) {
      expect(r.score).toBeGreaterThanOrEqual(0)
      expect(r.score).toBeLessThanOrEqual(1)
      const sum = Object.values(r.contributions).reduce((a, b) => a + b, 0)
      expect(sum).toBeCloseTo(r.score)
    }
  })

  it("inverts cost criteria (lower price scores higher)", () => {
    const res = scoreDecisionMatrix(options, criteria)
    const byId = Object.fromEntries(res.map((r) => [r.id, r]))
    // cheapest option gets full normalized price score
    expect(byId.x.normalized.price).toBeCloseTo(1)
    // most expensive gets zero
    expect(byId.y.normalized.price).toBeCloseTo(0)
  })

  it("treats missing values as worst-case (0 contribution)", () => {
    const res = scoreDecisionMatrix(
      [
        { id: "a", values: { rating: 5 } },
        { id: "b", values: {} }, // missing rating
      ],
      [{ id: "rating", weight: 1, benefit: true }],
    )
    const byId = Object.fromEntries(res.map((r) => [r.id, r]))
    expect(byId.b.normalized.rating).toBe(0)
    expect(byId.b.score).toBe(0)
    expect(byId.a.isWinner).toBe(true)
  })

  it("ignores non-finite values (NaN/Infinity)", () => {
    const res = scoreDecisionMatrix(
      [
        { id: "a", values: { rating: Number.NaN } },
        { id: "b", values: { rating: 4 } },
      ],
      [{ id: "rating", weight: 1, benefit: true }],
    )
    const byId = Object.fromEntries(res.map((r) => [r.id, r]))
    expect(byId.a.normalized.rating).toBe(0)
    expect(byId.b.isWinner).toBe(true)
  })

  it("normalizes equal present values to 1 (all equally good)", () => {
    const res = scoreDecisionMatrix(
      [
        { id: "a", values: { rating: 4 } },
        { id: "b", values: { rating: 4 } },
      ],
      [{ id: "rating", weight: 1, benefit: true }],
    )
    expect(res.every((r) => r.normalized.rating === 1)).toBe(true)
    expect(res.every((r) => r.score === 1)).toBe(true)
  })

  it("gives all-zero scores when total weight is zero", () => {
    const res = scoreDecisionMatrix(options, [
      { id: "price", weight: 0, benefit: false },
      { id: "rating", weight: 0, benefit: true },
    ])
    expect(res.every((r) => r.score === 0)).toBe(true)
    expect(res.every((r) => !r.isWinner)).toBe(true)
  })

  it("assigns a shared rank to tied options", () => {
    const tied: MatrixOption[] = [
      { id: "a", values: { rating: 5 } },
      { id: "b", values: { rating: 5 } },
      { id: "c", values: { rating: 1 } },
    ]
    const res = scoreDecisionMatrix(tied, [{ id: "rating", weight: 1, benefit: true }])
    const byId = Object.fromEntries(res.map((r) => [r.id, r]))
    expect(byId.a.rank).toBe(1)
    expect(byId.b.rank).toBe(1)
    expect(byId.a.isWinner).toBe(true)
    expect(byId.b.isWinner).toBe(true)
    expect(byId.c.rank).toBe(3) // standard competition ranking (1,1,3)
  })

  it("handles empty options and empty criteria", () => {
    expect(scoreDecisionMatrix([], criteria)).toEqual([])
    const res = scoreDecisionMatrix(options, [])
    expect(res.every((r) => r.score === 0)).toBe(true)
  })

  it("respects relative weights (heavier criterion dominates)", () => {
    const opts: MatrixOption[] = [
      { id: "a", values: { price: 0, rating: 0 } },
      { id: "b", values: { price: 100, rating: 100 } },
    ]
    // price is a cost weighted heavily; a (price 0) should win
    const res = scoreDecisionMatrix(opts, [
      { id: "price", weight: 9, benefit: false },
      { id: "rating", weight: 1, benefit: true },
    ])
    expect(res[0].id).toBe("a")
  })
})
