import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import type { TrackScope } from "@/lib/time-tracking-store"
import { entriesMatching, findBlocks, placeHits, scopeWithMostHits } from "./block-search"

const scopes: TrackScope[] = [
  {
    id: "activity",
    name: "Activity",
    pens: [
      { id: "exercise", name: "Exercise", color: "#16a34a" },
      {
        id: "walk",
        name: "Walk",
        color: "#22c55e",
        parentId: "exercise",
        parentIds: ["exercise"],
        actionFormats: [{ id: "fmt", template: "Went for a walk" }],
      },
      { id: "music", name: "Music", color: "#8b5cf6" },
    ],
  },
  {
    id: "location",
    name: "Location",
    pens: [{ id: "home", name: "Home", color: "#0ea5e9" }],
  },
]

function block(partial: Partial<TimeEntry> & Pick<TimeEntry, "id">): TimeEntry {
  return {
    date: "2026-10-05",
    scopeId: "activity",
    penId: "walk",
    startMin: 600,
    endMin: 660,
    ...partial,
  }
}

describe("findBlocks", () => {
  const walk = block({ id: "te-1", title: "walk to the beach" })
  const withMusic = block({ id: "te-2", penId: "walk", secondaryPenIds: ["music"], title: "evening" })

  it("matches a display name, a counts-as parent, and an action format", () => {
    expect(findBlocks("beach", [walk], scopes).map((hit) => hit.entryId)).toEqual(["te-1"])
    expect(findBlocks("exercise", [walk], scopes)[0]?.match).toBe("counts as")
    expect(findBlocks("went for", [walk], scopes)[0]?.match).toBe("action")
    expect(findBlocks("z", [walk], scopes)).toEqual([])
  })

  it("matches a secondary pen", () => {
    expect(findBlocks("music", [withMusic], scopes)[0]?.match).toBe("also")
  })
})

describe("entriesMatching", () => {
  it("keeps only the hit ids, in entry order", () => {
    const entries = [block({ id: "a" }), block({ id: "b" }), block({ id: "c" })]
    expect(entriesMatching(entries, [{ entryId: "c" }, { entryId: "a" }]).map((e) => e.id)).toEqual(["a", "c"])
    expect(entriesMatching(entries, [])).toEqual([])
  })
})

describe("placeHits", () => {
  const hits = findBlocks("walk", [
    block({ id: "in", title: "walk here" }),
    block({ id: "other", title: "walk there", scopeId: "location", penId: "home", date: "2026-10-06" }),
    block({ id: "out", title: "walk later", date: "2026-01-01" }),
  ], scopes)

  it("splits hits into this view, another scope, and outside the window", () => {
    const placed = placeHits(hits, ["2026-10-05", "2026-10-06"], "activity")
    expect(placed).toEqual({ inView: 1, otherScope: 1, outsideWindow: 1 })
    expect(scopeWithMostHits(hits)).toBe("activity")
    expect(scopeWithMostHits([])).toBeNull()
  })
})
