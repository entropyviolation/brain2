import { describe, it, expect, beforeEach } from "vitest"
import {
  applyPenLinks,
  attachCompanion,
  companionsFor,
  openRangesIn,
  suggestedCompanions,
} from "@/lib/entry-links"
import { entriesForDay, type TimeEntry } from "@/lib/time-entries"
import { useTimeTrackingStore, type TrackScope } from "@/lib/time-tracking-store"

const DATE = "2026-09-17"

let seq = 0
const makeId = () => `id-${++seq}`

const scopes: TrackScope[] = [
  {
    id: "activity",
    name: "Activity",
    pens: [
      { id: "act-work", name: "Work", color: "#00f" },
      {
        id: "act-social",
        name: "Social",
        color: "#f0f",
        variants: [
          { id: "v-elijah", name: "Elijah" },
          { id: "v-rebecca", name: "Rebecca" },
        ],
      },
    ],
  },
  {
    id: "location",
    name: "Location",
    pens: [
      { id: "loc-ian", name: "Ian's House", color: "#0f0" },
      { id: "loc-home", name: "Home", color: "#333" },
    ],
  },
]

const block = (over: Partial<TimeEntry> & Pick<TimeEntry, "scopeId" | "penId" | "startMin" | "endMin">): TimeEntry => ({
  id: makeId(),
  date: DATE,
  ...over,
})

describe("openRangesIn", () => {
  it("is the whole window when the other scope is blank", () => {
    expect(openRangesIn([], DATE, "activity", 780, 1020)).toEqual([{ startMin: 780, endMin: 1020 }])
  })

  it("returns the gaps around what is already painted", () => {
    const entries = [block({ scopeId: "activity", penId: "act-work", startMin: 840, endMin: 900 })]
    expect(openRangesIn(entries, DATE, "activity", 780, 1020)).toEqual([
      { startMin: 780, endMin: 840 },
      { startMin: 900, endMin: 1020 },
    ])
  })

  it("is empty when the window is fully covered", () => {
    const entries = [block({ scopeId: "activity", penId: "act-work", startMin: 700, endMin: 1100 })]
    expect(openRangesIn(entries, DATE, "activity", 780, 1020)).toEqual([])
  })
})

describe("companionsFor", () => {
  it("lists other scopes with what covers the window", () => {
    const ian = block({ scopeId: "location", penId: "loc-ian", startMin: 780, endMin: 1020 })
    const entries = [ian, block({ scopeId: "activity", penId: "act-work", startMin: 700, endMin: 840 })]

    const [activity] = companionsFor(entries, ian, scopes)
    expect(activity.scope.id).toBe("activity")
    expect(activity.windowMinutes).toBe(240)
    // Only the overlap counts, not the whole of the Work block.
    expect(activity.covering[0].minutes).toBe(60)
    expect(activity.covering[0].pen?.name).toBe("Work")
    expect(activity.freeMinutes).toBe(180)
  })

  it("never lists the block's own scope", () => {
    const ian = block({ scopeId: "location", penId: "loc-ian", startMin: 780, endMin: 1020 })
    expect(companionsFor([ian], ian, scopes).map((c) => c.scope.id)).toEqual(["activity"])
  })
})

describe("attachCompanion", () => {
  it("paints the same window in the other scope", () => {
    const ian = block({ scopeId: "location", penId: "loc-ian", startMin: 780, endMin: 1020 })
    const next = attachCompanion([ian], ian, { scopeId: "activity", penId: "act-social", variantIds: ["v-elijah"] }, {}, makeId)

    const painted = entriesForDay(next, DATE, "activity")
    expect(painted).toHaveLength(1)
    expect(painted[0]).toMatchObject({ penId: "act-social", startMin: 780, endMin: 1020, variantIds: ["v-elijah"] })
    // The source block is untouched.
    expect(next.find((e) => e.id === ian.id)).toEqual(ian)
  })

  it("fills around existing time rather than overwriting it", () => {
    const ian = block({ scopeId: "location", penId: "loc-ian", startMin: 780, endMin: 1020 })
    const work = block({ scopeId: "activity", penId: "act-work", startMin: 780, endMin: 840 })
    const next = attachCompanion([ian, work], ian, { scopeId: "activity", penId: "act-social" }, {}, makeId)

    const painted = entriesForDay(next, DATE, "activity")
    expect(painted.map((e) => [e.penId, e.startMin, e.endMin])).toEqual([
      ["act-work", 780, 840],
      ["act-social", 840, 1020],
    ])
  })

  it("overwrites only when explicitly asked", () => {
    const ian = block({ scopeId: "location", penId: "loc-ian", startMin: 780, endMin: 1020 })
    const work = block({ scopeId: "activity", penId: "act-work", startMin: 780, endMin: 840 })
    const next = attachCompanion([ian, work], ian, { scopeId: "activity", penId: "act-social" }, { overwrite: true }, makeId)

    const painted = entriesForDay(next, DATE, "activity")
    expect(painted).toHaveLength(1)
    expect(painted[0]).toMatchObject({ penId: "act-social", startMin: 780, endMin: 1020 })
  })

  it("refuses to attach a scope to itself", () => {
    const ian = block({ scopeId: "location", penId: "loc-ian", startMin: 780, endMin: 1020 })
    expect(attachCompanion([ian], ian, { scopeId: "location", penId: "loc-home" }, {}, makeId)).toHaveLength(1)
  })
})

describe("applyPenLinks", () => {
  const linked: TrackScope[] = [
    scopes[0],
    {
      ...scopes[1],
      pens: [
        { ...scopes[1].pens[0], links: [{ scopeId: "activity", penId: "act-social", variantIds: ["v-elijah"] }] },
        scopes[1].pens[1],
      ],
    },
  ]

  it("paints the linked pen with its pre-ticked variants", () => {
    const ian = block({ scopeId: "location", penId: "loc-ian", startMin: 780, endMin: 1020 })
    const next = applyPenLinks([ian], linked, ian, makeId)
    expect(entriesForDay(next, DATE, "activity")[0]).toMatchObject({
      penId: "act-social",
      startMin: 780,
      endMin: 1020,
      variantIds: ["v-elijah"],
    })
  })

  it("is idempotent — a second run has nothing blank left to fill", () => {
    const ian = block({ scopeId: "location", penId: "loc-ian", startMin: 780, endMin: 1020 })
    const once = applyPenLinks([ian], linked, ian, makeId)
    const twice = applyPenLinks(once, linked, ian, makeId)
    expect(entriesForDay(twice, DATE, "activity")).toHaveLength(1)
    expect(twice).toHaveLength(once.length)
  })

  it("ignores links pointing at a deleted pen", () => {
    const dangling: TrackScope[] = [
      scopes[0],
      { ...scopes[1], pens: [{ ...scopes[1].pens[0], links: [{ scopeId: "activity", penId: "gone" }] }] },
    ]
    const ian = block({ scopeId: "location", penId: "loc-ian", startMin: 780, endMin: 1020 })
    expect(applyPenLinks([ian], dangling, ian, makeId)).toHaveLength(1)
  })
})

describe("suggestedCompanions", () => {
  it("ranks by how much time the pens have actually shared", () => {
    const entries = [
      block({ date: "2026-09-10", scopeId: "location", penId: "loc-ian", startMin: 780, endMin: 1020 }),
      block({ date: "2026-09-10", scopeId: "activity", penId: "act-social", startMin: 780, endMin: 1020 }),
      block({ date: "2026-09-11", scopeId: "location", penId: "loc-ian", startMin: 600, endMin: 720 }),
      block({ date: "2026-09-11", scopeId: "activity", penId: "act-social", startMin: 600, endMin: 660 }),
      block({ date: "2026-09-11", scopeId: "activity", penId: "act-work", startMin: 660, endMin: 720 }),
    ]

    const suggestions = suggestedCompanions(entries, scopes, { scopeId: "location", penId: "loc-ian" })
    expect(suggestions.map((s) => [s.penName, s.minutes])).toEqual([
      ["Social", 300],
      ["Work", 60],
    ])
  })

  it("has nothing to say about a pen with no history", () => {
    expect(suggestedCompanions([], scopes, { scopeId: "location", penId: "loc-ian" })).toEqual([])
  })

  it("excludes the block being edited, so it cannot suggest itself", () => {
    const ian = block({ scopeId: "location", penId: "loc-ian", startMin: 780, endMin: 1020 })
    const social = block({ scopeId: "activity", penId: "act-social", startMin: 780, endMin: 1020 })
    expect(suggestedCompanions([ian, social], scopes, { scopeId: "location", penId: "loc-ian", id: ian.id })).toEqual([])
  })
})

describe("store integration", () => {
  beforeEach(() => {
    useTimeTrackingStore.setState({ scopes, entries: [] })
  })

  it("fires a pen's links as part of the paint stroke", () => {
    const store = useTimeTrackingStore.getState()
    store.setPenLinks("location", "loc-ian", [{ scopeId: "activity", penId: "act-social" }])
    useTimeTrackingStore.getState().paintMinutes(DATE, "location", 780, 1020, "loc-ian")

    const activity = entriesForDay(useTimeTrackingStore.getState().entries, DATE, "activity")
    expect(activity).toHaveLength(1)
    expect(activity[0]).toMatchObject({ penId: "act-social", startMin: 780, endMin: 1020 })
  })

  it("leaves other scopes alone for an unlinked pen", () => {
    useTimeTrackingStore.getState().paintMinutes(DATE, "location", 780, 1020, "loc-home")
    expect(entriesForDay(useTimeTrackingStore.getState().entries, DATE, "activity")).toEqual([])
  })

  it("does not reach back to earlier blocks when a later stroke fires links", () => {
    const store = useTimeTrackingStore.getState()
    // An earlier Ian block painted before the rule existed.
    store.paintMinutes(DATE, "location", 600, 660, "loc-ian")
    store.setPenLinks("location", "loc-ian", [{ scopeId: "activity", penId: "act-social" }])
    useTimeTrackingStore.getState().paintMinutes(DATE, "location", 780, 1020, "loc-ian")

    const activity = entriesForDay(useTimeTrackingStore.getState().entries, DATE, "activity")
    expect(activity.map((e) => [e.startMin, e.endMin])).toEqual([[780, 1020]])
  })

  it("drops links to a pen that gets deleted", () => {
    const store = useTimeTrackingStore.getState()
    store.setPenLinks("location", "loc-ian", [{ scopeId: "activity", penId: "act-social" }])
    useTimeTrackingStore.getState().removePen("activity", "act-social")

    const ian = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")?.pens[0]
    expect(ian?.links).toBeUndefined()
  })

  it("attaches a companion to one block without touching the rule", () => {
    useTimeTrackingStore.getState().paintMinutes(DATE, "location", 780, 1020, "loc-ian")
    const ian = entriesForDay(useTimeTrackingStore.getState().entries, DATE, "location")[0]
    useTimeTrackingStore.getState().attachCompanion(ian.id, {
      scopeId: "activity",
      penId: "act-social",
      variantIds: ["v-elijah", "v-rebecca"],
    })

    const state = useTimeTrackingStore.getState()
    expect(entriesForDay(state.entries, DATE, "activity")[0]).toMatchObject({
      penId: "act-social",
      variantIds: ["v-elijah", "v-rebecca"],
    })
    expect(state.scopes.find((s) => s.id === "location")?.pens[0].links).toBeUndefined()
  })
})
