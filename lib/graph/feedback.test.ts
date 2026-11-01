import { describe, expect, it } from "vitest"
import { feedbackSentences, reweightSuggestions, shrunkFactor, sourceAcceptance, sourceOfOrigin, usageWeight, type FeedbackDecision } from "@/lib/graph/feedback"
import { useGraphUsageStore } from "@/lib/graph/graph-usage-store"

const d = (source: string, relation: string, outcome: FeedbackDecision["outcome"], at?: string): FeedbackDecision => ({ source, relation, outcome, at })

describe("sourceAcceptance", () => {
  it("reads proposals and decisions, skips open rows, and smooths with Beta(1,1)", () => {
    const stats = sourceAcceptance([
      { origin: "densify:identity", relation: "same-as", status: "accepted", createdAt: "2026-10-02T10:00:00Z" },
      { origin: "densify:identity", relation: "same-as", status: "dismissed", createdAt: "2026-10-05T10:00:00Z" },
      { origin: "model:claude", relation: "supports", status: "open" },
      d("triad", "related", "dismissed"),
    ])
    expect(stats.sources.map((r) => r.key)).toEqual(["identity", "triad"])
    expect(stats.sources[0]).toMatchObject({ accepted: 1, dismissed: 1, n: 2, rate: 0.5, range: { from: "2026-10-02", to: "2026-10-05" } })
    expect(stats.sources[1].rate).toBeCloseTo(1 / 3)
    expect(stats.relations.map((r) => r.key)).toEqual(["related", "same-as"])
  })

  it("maps origins to sources", () => {
    expect(sourceOfOrigin("densify:triad")).toBe("triad")
    expect(sourceOfOrigin("model:x")).toBe("model")
    expect(sourceOfOrigin("import:file")).toBe("import")
  })
})

describe("reweightSuggestions", () => {
  const many = (source: string, acc: number, dis: number) => [
    ...Array.from({ length: acc }, () => d(source, "rel", "accepted")),
    ...Array.from({ length: dis }, () => d(source, "rel", "dismissed")),
  ]

  it("shrinks toward 1 under the floor and applies the rate above it", () => {
    const stats = sourceAcceptance([...many("triad", 0, 12), ...many("mention", 0, 1)])
    const tri = stats.sources.find((r) => r.key === "triad")!
    const men = stats.sources.find((r) => r.key === "mention")!
    expect(shrunkFactor(tri)).toBeCloseTo(1 / 14)
    expect(shrunkFactor(men)).toBeCloseTo(1 + (1 / 7) * (1 / 3 - 1))
    expect(shrunkFactor(undefined)).toBe(1)
  })

  it("keeps order, adds why and baseScore, and is deterministic", () => {
    const stats = sourceAcceptance(many("triad", 2, 10))
    const rows = [
      { key: "a", source: "triad", relation: "other", score: 0.8 },
      { key: "b", source: "reciprocal", relation: "other", score: 0.5 },
    ]
    const out = reweightSuggestions(rows, stats, { byRelation: false })
    expect(out.map((r) => r.key)).toEqual(["a", "b"])
    expect(out[0].baseScore).toBe(0.8)
    expect(out[0].score).toBeCloseTo(0.8 * (3 / 14))
    expect(out[0].why).toBe("triad: 2 accepted, 10 dismissed (n=12) · ×0.21")
    expect(out[1].score).toBe(0.5)
    expect(out[1].why).toBe("reciprocal: no decisions yet · ×1.00")
    expect(reweightSuggestions(rows, stats, { byRelation: false })).toEqual(out)
    expect(rows[0].score).toBe(0.8)
  })
})

describe("feedbackSentences", () => {
  it("states counts, n, range, and the floor", () => {
    const stats = sourceAcceptance([d("relation-word", "part-of", "accepted", "2026-10-01"), d("relation-word", "part-of", "dismissed", "2026-10-03")])
    expect(feedbackSentences(stats)).toEqual([
      "relation-word: 1 accepted, 1 dismissed (n=2, 2026-10-01 – 2026-10-03, under the floor of 7).",
      "relation part-of: 1 accepted, 1 dismissed (n=2, 2026-10-01 – 2026-10-03, under the floor of 7).",
    ])
  })
})

describe("usageWeight and the usage store", () => {
  it("halves a visit every half-life", () => {
    const now = Date.UTC(2026, 10, 1)
    const day = 86_400_000
    expect(usageWeight([now], now)).toBe(1)
    expect(usageWeight([now - 14 * day], now)).toBeCloseTo(0.5)
    expect(usageWeight([now - 7 * day, now - 7 * day], now, 7)).toBeCloseTo(1)
    expect(usageWeight([], now)).toBe(0)
  })

  it("records visits and actions that feed sourceAcceptance", () => {
    const store = useGraphUsageStore.getState()
    store.recordVisit("item:a", 1)
    store.recordVisit("item:a", 2)
    store.recordAction("accepted", "triad", "related", new Date("2026-10-01T00:00:00Z"))
    const state = useGraphUsageStore.getState()
    expect(state.visits["item:a"]).toEqual([1, 2])
    expect(sourceAcceptance(state.actions).sources[0]).toMatchObject({ key: "triad", accepted: 1, n: 1 })
  })
})
