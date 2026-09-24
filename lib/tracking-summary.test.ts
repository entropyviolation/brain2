import { describe, expect, it } from "vitest"
import type { TimeEntry } from "./time-entries"
import type { TrackPen, TrackScope, TrackTag } from "./time-tracking-store"
import {
  UNLABELED_VARIANT_NAME,
  childPenTotals,
  combinationTotals,
  entriesInRange,
  longestBlock,
  penTotals,
  penTotalsAtDepth,
  recentDateKeys,
  switchCount,
  tagTotals,
  otherScopeOccupancy,
  totalsFor,
  variantTotals,
  withPrecision,
} from "./tracking-summary"

const social: TrackPen = {
  id: "social",
  name: "Hanging out",
  color: "#ec4899",
  tags: ["tag-social"],
  variantLabel: "Who with?",
  variants: [
    { id: "elijah", name: "Elijah", color: "#2563eb" },
    { id: "rebecca", name: "Rebecca", color: "#10b981" },
  ],
}

const scopes: TrackScope[] = [
  {
    id: "activity",
    name: "Activity",
    pens: [social, { id: "work", name: "Work", color: "#2563eb", tags: ["tag-work"] }],
  },
  {
    id: "location",
    name: "Location",
    pens: [
      { id: "home", name: "Home", color: "#16a34a", tags: ["tag-social"] },
      { id: "zoo", name: "San Diego Zoo", color: "#f59e0b" },
    ],
  },
]

const tags: TrackTag[] = [
  { id: "tag-social", name: "Social", color: "#ec4899" },
  { id: "tag-work", name: "Work", color: "#2563eb" },
  { id: "tag-exercise", name: "Exercise", color: "#f59e0b" },
]

const DAY = "2026-09-17"
let seq = 0
function block(penId: string, startMin: number, endMin: number, variantIds?: string[], scopeId = "activity"): TimeEntry {
  return { id: `e${++seq}`, date: DAY, scopeId, penId, startMin, endMin, variantIds }
}

describe("period totals", () => {
  it("reports tracked, untracked and coverage against the whole period", () => {
    const totals = totalsFor([block("work", 540, 600)], [DAY])
    expect(totals.tracked).toBe(60)
    expect(totals.untracked).toBe(1380)
    expect(totals.coverage).toBeCloseTo((60 / 1440) * 100)
    expect(totals.daysWithData).toBe(1)
  })

  it("averages across the whole range, not only days with data", () => {
    const totals = totalsFor([block("work", 540, 660)], ["2026-09-16", DAY])
    expect(totals.averagePerDay).toBe(60)
    expect(totals.daysWithData).toBe(1)
    expect(totals.days).toBe(2)
  })

  it("is zero-safe on an empty range", () => {
    const totals = totalsFor([], [])
    expect(totals.tracked).toBe(0)
    expect(totals.coverage).toBe(0)
  })

  it("counts overlapping blocks once, so a day cannot exceed 100%", () => {
    // Derived sleep 0–7 sitting on Work the user already painted 0–9 — the
    // grid draws one color per minute, and "% of the day" is that occupancy.
    const totals = totalsFor([block("sleep", 0, 420), block("work", 0, 540)], [DAY])
    expect(totals.tracked).toBe(540)
    expect(totals.untracked).toBe(900)
    expect(totals.coverage).toBeCloseTo((540 / 1440) * 100)
    expect(totals.coverage).toBeLessThanOrEqual(100)
  })

  it("points at other views that have hours when this one is empty", () => {
    const rows = otherScopeOccupancy(
      [block("work", 540, 600), { ...block("home", 540, 600, undefined, "location") }],
      scopes,
      DAY,
      "empty",
    )
    expect(rows.map((r) => r.id)).toEqual(["activity", "location"])
    expect(rows[0].minutes).toBe(60)
  })
})

describe("pen totals", () => {
  const entries = [block("work", 540, 660), block("social", 660, 720)]

  it("gives both percentage bases, largest first", () => {
    const rows = penTotals(entries, scopes[0], [DAY])
    expect(rows.map((r) => r.name)).toEqual(["Work", "Hanging out"])
    expect(rows[0].minutes).toBe(120)
    expect(rows[0].percentOfTracked).toBeCloseTo((120 / 180) * 100)
    expect(rows[0].percentOfPeriod).toBeCloseTo((120 / 1440) * 100)
  })

  it("omits pens with no time and survives a missing scope", () => {
    expect(penTotals(entries, scopes[0], [DAY]).some((r) => r.minutes === 0)).toBe(false)
    expect(penTotals(entries, undefined, [DAY])).toEqual([])
  })

  it("does not double-count a pen that covers the same minute twice", () => {
    const rows = penTotals(
      [block("work", 0, 420), { ...block("work", 0, 420), id: "dup" }],
      scopes[0],
      [DAY],
    )
    expect(rows.find((r) => r.id === "work")?.minutes).toBe(420)
  })

  it("counts a secondary pen's minutes toward that pen's total without doubling occupancy", () => {
    const dual = { ...block("work", 540, 600), secondaryPenIds: ["social"] }
    const rows = penTotals([dual], scopes[0], [DAY])
    expect(rows.find((r) => r.id === "work")?.minutes).toBe(60)
    expect(rows.find((r) => r.id === "social")?.minutes).toBe(60)
    expect(totalsFor([dual], [DAY]).tracked).toBe(60)
  })
})

describe("variant breakdowns", () => {
  // An hour with Elijah, an hour with both, half an hour unlabeled.
  const entries = [
    block("social", 540, 600, ["elijah"]),
    block("social", 600, 660, ["elijah", "rebecca"]),
    block("social", 660, 690),
  ]

  it("reach counts overlapping blocks under every variant they carry", () => {
    const rows = variantTotals(entries, social)
    expect(rows.find((r) => r.name === "Elijah")?.minutes).toBe(120)
    expect(rows.find((r) => r.name === "Rebecca")?.minutes).toBe(60)
    expect(rows.find((r) => r.name === UNLABELED_VARIANT_NAME)?.minutes).toBe(30)
    // 120 + 60 + 30 = 210 against 150 tracked: overlap, by design.
    const total = rows.reduce((sum, r) => sum + r.percentOfTracked, 0)
    expect(total).toBeGreaterThan(100)
  })

  it("split partitions the pen exactly, so it can be drawn as a pie", () => {
    const rows = combinationTotals(entries, social)
    expect(rows.map((r) => [r.name, r.minutes]).sort()).toEqual(
      [
        ["Elijah", 60],
        ["Elijah + Rebecca", 60],
        [UNLABELED_VARIANT_NAME, 30],
      ].sort(),
    )
    expect(rows.reduce((sum, r) => sum + r.minutes, 0)).toBe(150)
    expect(rows.reduce((sum, r) => sum + r.percentOfTracked, 0)).toBeCloseTo(100)
  })

  it("puts everything under Unlabeled when no variant was picked", () => {
    const rows = combinationTotals([block("social", 540, 600)], social)
    expect(rows).toHaveLength(1)
    expect(rows[0].name).toBe(UNLABELED_VARIANT_NAME)
    expect(rows[0].percentOfTracked).toBe(100)
  })

  it("returns nothing for a missing pen", () => {
    expect(variantTotals(entries, undefined)).toEqual([])
    expect(combinationTotals(entries, undefined)).toEqual([])
  })
})

describe("tag totals", () => {
  it("counts a minute once even when two scopes tag it", () => {
    const entries = [block("social", 540, 600), block("home", 540, 660, undefined, "location")]
    const rows = tagTotals(entries, scopes, tags, [DAY])
    // Social 9–10 and Home 9–11 both carry tag-social: the union is two hours.
    expect(rows.find((r) => r.name === "Social")?.minutes).toBe(120)
  })

  it("skips pens with no tags", () => {
    const untagged: TrackScope[] = [{ id: "activity", name: "Activity", pens: [{ id: "x", name: "X", color: "#000" }] }]
    expect(tagTotals([block("x", 0, 60)], untagged, tags, [DAY])).toEqual([])
  })

  // Elijah's zoo pass: four hours logged as a *location*, which also happened to
  // be four hours of walking. The block carries Exercise on its own.
  it("counts a tag pinned to a single block, in a scope whose pen has no tags", () => {
    const zoo = { ...block("zoo", 600, 840, undefined, "location"), tagIds: ["tag-exercise"] }
    const rows = tagTotals([zoo], scopes, tags, [DAY])
    expect(rows.find((r) => r.name === "Exercise")?.minutes).toBe(240)
  })

  it("does not spill a block tag onto the rest of that pen's time", () => {
    const zooTrip = { ...block("zoo", 600, 840, undefined, "location"), tagIds: ["tag-exercise"] }
    const zooLater = block("zoo", 900, 960, undefined, "location")
    const rows = tagTotals([zooTrip, zooLater], scopes, tags, [DAY])
    expect(rows.find((r) => r.name === "Exercise")?.minutes).toBe(240)
  })

  it("still counts a minute once when the pen tag and a block tag agree", () => {
    const social9to10 = { ...block("social", 540, 600), tagIds: ["tag-social"] }
    const homeAllMorning = block("home", 540, 660, undefined, "location")
    const rows = tagTotals([social9to10, homeAllMorning], scopes, tags, [DAY])
    expect(rows.find((r) => r.name === "Social")?.minutes).toBe(120)
  })
})

describe("shape of a day", () => {
  it("finds the longest block", () => {
    const entries = [block("work", 540, 600), block("social", 600, 720)]
    expect(longestBlock(entries)?.penId).toBe("social")
    expect(longestBlock([])).toBeUndefined()
  })

  it("counts pen changes, not block boundaries", () => {
    const entries = [block("work", 0, 60), block("social", 60, 120), block("work", 120, 180)]
    expect(switchCount(entries, DAY, "activity")).toBe(2)
    expect(switchCount([block("work", 0, 60)], DAY, "activity")).toBe(0)
  })

  it("filters to a scope and a set of dates", () => {
    const entries = [
      block("work", 0, 60),
      { ...block("work", 0, 60), date: "2026-09-10" },
      block("home", 0, 60, undefined, "location"),
    ]
    expect(entriesInRange(entries, [DAY], "activity")).toHaveLength(1)
  })
})

describe("pen tree rollup", () => {
  it("rolls children into a parent at depth 0 and lists them when drilled", () => {
    const chores: TrackPen = { id: "chores", name: "Chores", color: "#8b5cf6" }
    const trash: TrackPen = { id: "trash", name: "Trash", color: "#64748b", parentId: "chores" }
    const dishes: TrackPen = { id: "dishes", name: "Dishes", color: "#0ea5e9", parentId: "chores" }
    const activity: TrackScope = { id: "activity", name: "Activity", pens: [chores, trash, dishes] }
    const entries = [block("trash", 540, 600), block("dishes", 600, 720)]
    const rolled = penTotalsAtDepth(entries, activity, [DAY], 0)
    expect(rolled).toHaveLength(1)
    expect(rolled[0]).toMatchObject({ id: "chores", minutes: 180 })
    const kids = childPenTotals(entries, activity, [DAY], "chores")
    expect(kids.map((r) => [r.id, r.minutes]).sort()).toEqual(
      [
        ["dishes", 120],
        ["trash", 60],
      ].sort(),
    )
  })

  it("drops estimated blocks when asked", () => {
    const entries = [block("work", 540, 600), { ...block("work", 600, 720), precision: "estimated" as const }]
    expect(withPrecision(entries, true)).toHaveLength(2)
    expect(withPrecision(entries, false)).toHaveLength(1)
    expect(withPrecision(entries, false)[0].startMin).toBe(540)
  })
})

describe("recentDateKeys", () => {
  it("returns local keys oldest first, ending today", () => {
    const keys = recentDateKeys(3, new Date(2026, 8, 17))
    expect(keys).toEqual(["2026-09-15", "2026-09-16", "2026-09-17"])
  })

  it("does not drift to UTC late in the day", () => {
    // 11 PM local would be tomorrow in UTC west of Greenwich.
    expect(recentDateKeys(1, new Date(2026, 8, 17, 23, 30))).toEqual(["2026-09-17"])
  })
})
