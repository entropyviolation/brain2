import { describe, it, expect } from "vitest"
import {
  TIER_ATTR_IDS,
  TIER_POINTS,
  DEFAULT_TIER_THRESHOLDS,
  buildCompletionTierAttributes,
  defaultCompletionTierValues,
  hasCompletionTiers,
  withCompletionTiers,
  computeTierPoints,
  resolveTierSnapshot,
  tierLevel,
  describeCompletionRules,
} from "./completion-tiers"
import type { AttributeDefinition, AttributeValue } from "@/lib/types"

const defs = buildCompletionTierAttributes("pages")

/** Stored values for a tier set at a given `current` page count. */
function valuesAt(current: number, overrides: Record<string, AttributeValue> = {}) {
  return { ...defaultCompletionTierValues("pages"), [TIER_ATTR_IDS.current]: current, ...overrides }
}

describe("buildCompletionTierAttributes", () => {
  it("produces the six-attribute tier set with a formula points field", () => {
    expect(defs.map((d) => d.id)).toEqual([
      TIER_ATTR_IDS.bareMin,
      TIER_ATTR_IDS.goal,
      TIER_ATTR_IDS.exceptional,
      TIER_ATTR_IDS.units,
      TIER_ATTR_IDS.current,
      TIER_ATTR_IDS.points,
    ])
    const points = defs.find((d) => d.id === TIER_ATTR_IDS.points)!
    expect(points.type).toBe("formula")
    expect(points.formula).toContain("IF")
  })
})

describe("computeTierPoints — the read example", () => {
  const cases: Array<[number, number]> = [
    [0, 0], // nothing → no credit
    [1, TIER_POINTS.bareMin], // bare minimum (1 page) → 1
    [4, TIER_POINTS.bareMin], // still only bare minimum below the goal → 1
    [5, TIER_POINTS.goal], // hit the goal (5 pages) → 10
    [19, TIER_POINTS.goal], // below exceptional → still 10
    [20, TIER_POINTS.exceptional], // exceptional threshold (20 pages) → 50
    [25, TIER_POINTS.exceptional + 5], // 50 + 1/extra page → 55
  ]
  it.each(cases)("current=%i pages → %i points", (current, expected) => {
    expect(computeTierPoints(valuesAt(current), defs)).toBe(expected)
  })

  it("works without an explicit schema (uses the default formula)", () => {
    expect(computeTierPoints(valuesAt(22))).toBe(TIER_POINTS.exceptional + 2)
  })

  it("stays self-consistent when thresholds are retuned", () => {
    // Move the exceptional bar to 30 pages: 25 no longer exceptional → goal pts.
    const tuned = valuesAt(25, { [TIER_ATTR_IDS.exceptional]: 30 })
    expect(computeTierPoints(tuned, defs)).toBe(TIER_POINTS.goal)
    // 31 pages clears the new bar → 50 + 1 extra.
    expect(computeTierPoints(valuesAt(31, { [TIER_ATTR_IDS.exceptional]: 30 }), defs)).toBe(
      TIER_POINTS.exceptional + 1,
    )
  })
})

describe("tierLevel", () => {
  const t = DEFAULT_TIER_THRESHOLDS
  it("classifies the reached level", () => {
    expect(tierLevel(0, t)).toBe("none")
    expect(tierLevel(1, t)).toBe("bare-minimum")
    expect(tierLevel(5, t)).toBe("goal")
    expect(tierLevel(20, t)).toBe("exceptional")
  })
})

describe("resolveTierSnapshot", () => {
  it("summarizes thresholds, current, points and level", () => {
    const snap = resolveTierSnapshot(valuesAt(20), defs)
    expect(snap).toMatchObject({
      bareMin: 1,
      goal: 5,
      exceptional: 20,
      current: 20,
      unit: "pages",
      points: TIER_POINTS.exceptional,
      level: "exceptional",
    })
  })
})

describe("hasCompletionTiers / withCompletionTiers", () => {
  it("detects a present tier set", () => {
    expect(hasCompletionTiers([])).toBe(false)
    expect(hasCompletionTiers(defs)).toBe(true)
  })

  it("appends the tier set without duplicating existing ids", () => {
    const base: AttributeDefinition[] = [{ id: "title", name: "Title", type: "string" }]
    const merged = withCompletionTiers(base, "pages")
    expect(merged).toHaveLength(base.length + defs.length)
    // Idempotent: a second pass adds nothing.
    expect(withCompletionTiers(merged, "pages")).toHaveLength(merged.length)
  })
})

describe("describeCompletionRules", () => {
  it("renders a highest-first rule ladder mirroring the formula", () => {
    const lines = describeCompletionRules(DEFAULT_TIER_THRESHOLDS, "pages")
    expect(lines.map((l) => l.level)).toEqual(["exceptional", "goal", "bare-minimum", "none"])
    expect(lines[0].condition).toBe("≥ 20 pages")
    expect(lines[0].reward).toContain("50 pts")
    expect(lines[0].reward).toContain("per extra")
    expect(lines[3].reward).toBe("0 pts")
  })
})
