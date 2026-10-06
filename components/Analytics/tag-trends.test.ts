import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import type { TrackScope, TrackTag } from "@/lib/time-tracking-store"
import { tagMonthTrend } from "./tag-trends"

const tags: TrackTag[] = [{ id: "tag-work", name: "Work", color: "#2563eb" }]

const scopes: TrackScope[] = [
  {
    id: "activity",
    name: "Activity",
    pens: [{ id: "act-work", name: "Work", color: "#2563eb", tags: ["tag-work"] }],
  },
  {
    id: "location",
    name: "Location",
    pens: [{ id: "loc-home", name: "Home", color: "#16a34a", tags: ["tag-work"] }],
  },
]

function entry(partial: Partial<TimeEntry> & Pick<TimeEntry, "id" | "scopeId" | "penId">): TimeEntry {
  return { date: "2026-10-05", startMin: 0, endMin: 30, ...partial }
}

describe("tagMonthTrend", () => {
  it("counts a minute tagged in two scopes once, and keeps an empty month at 0", () => {
    const rows = tagMonthTrend(
      [
        entry({ id: "a", scopeId: "activity", penId: "act-work", startMin: 0, endMin: 30 }),
        entry({ id: "b", scopeId: "location", penId: "loc-home", startMin: 0, endMin: 30 }),
        entry({ id: "c", scopeId: "activity", penId: "act-work", date: "2026-11-02", startMin: 0, endMin: 10 }),
        entry({ id: "d", scopeId: "activity", penId: "act-work", date: "2026-09-01", startMin: 0, endMin: 100 }),
      ],
      scopes,
      tags,
      ["2026-10-05", "2026-11-02"],
    )
    expect(rows).toHaveLength(1)
    expect(rows[0].points).toEqual([
      { key: "2026-10", minutes: 30 },
      { key: "2026-11", minutes: 10 },
    ])
  })

  it("returns nothing when no block carries a tag", () => {
    const bare: TrackScope[] = [
      { id: "activity", name: "Activity", pens: [{ id: "act-rest", name: "Rest", color: "#10b981" }] },
    ]
    expect(
      tagMonthTrend(
        [entry({ id: "a", scopeId: "activity", penId: "act-rest" })],
        bare,
        tags,
        ["2026-10-05"],
      ),
    ).toEqual([])
  })
})
