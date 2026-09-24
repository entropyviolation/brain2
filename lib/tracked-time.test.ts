import { describe, expect, it } from "vitest"
import type { TimeEntry } from "./time-entries"
import type { TrackScope } from "./time-tracking-store"
import {
  effectiveTagIds,
  penIdsForTags,
  tagsForPen,
  trackedDateKeys,
  trackedMinutesByTag,
  trackedMinutesForTags,
  trackedMinutesForTagsInRange,
  type TrackedTimeSource,
} from "./tracked-time"

const scopes: TrackScope[] = [
  {
    id: "activity",
    name: "Activity",
    pens: [
      { id: "dishes", name: "Do dishes", color: "#111", tags: ["cleaning"] },
      { id: "laundry", name: "Laundry", color: "#222", tags: ["cleaning", "chores"] },
      { id: "work", name: "Work", color: "#333", tags: ["deep"] },
      { id: "untagged", name: "Untagged", color: "#444" },
    ],
  },
  {
    id: "location",
    name: "Location",
    pens: [{ id: "home", name: "Home", color: "#555", tags: ["cleaning"] }],
  },
]

let seq = 0
/** Minutes, end-exclusive: `block("2026-09-17", "activity", "dishes", 480, 540)` = 8–9am. */
function block(date: string, scopeId: string, penId: string, startMin: number, endMin: number): TimeEntry {
  return { id: `e${++seq}`, date, scopeId, penId, startMin, endMin }
}

const source: TrackedTimeSource = {
  scopes,
  entries: [
    // 60 min of dishes + 30 of laundry + 60 of work, with Location home spanning
    // the first 120 minutes of that.
    block("2026-09-17", "activity", "dishes", 480, 540),
    block("2026-09-17", "activity", "laundry", 540, 570),
    block("2026-09-17", "activity", "work", 600, 660),
    block("2026-09-17", "location", "home", 480, 600),
    block("2026-09-16", "activity", "dishes", 120, 150),
  ],
}

describe("tracked-time tag rollups", () => {
  it("collects every pen carrying a tag across scopes", () => {
    expect([...penIdsForTags(scopes, ["cleaning"])].sort()).toEqual(["dishes", "home", "laundry"])
    expect(penIdsForTags(scopes, []).size).toBe(0)
  })

  it("counts a minute once even when several scopes tag it", () => {
    // Activity dishes+laundry (8:00–9:30) and Location home (8:00–10:00) all
    // carry "cleaning": the union is 8:00–10:00, i.e. two hours, not three and a half.
    expect(trackedMinutesForTags(source, "2026-09-17", ["cleaning"])).toBe(120)
  })

  it("matches a pen carrying any one of the linked tags", () => {
    expect(trackedMinutesForTags(source, "2026-09-17", ["chores"])).toBe(30)
    expect(trackedMinutesForTags(source, "2026-09-17", ["chores", "deep"])).toBe(90)
  })

  it("returns zero for untracked days and unknown tags", () => {
    expect(trackedMinutesForTags(source, "2026-01-01", ["cleaning"])).toBe(0)
    expect(trackedMinutesForTags(source, "2026-09-17", ["nope"])).toBe(0)
  })

  it("sums a date range", () => {
    expect(trackedMinutesForTagsInRange(source, ["2026-09-17", "2026-09-16"], ["cleaning"])).toBe(150)
  })

  it("breaks a day down per tag", () => {
    const totals = trackedMinutesByTag(source, "2026-09-17")
    expect(totals).toEqual({ cleaning: 120, chores: 30, deep: 60 })
  })

  it("lists tracked dates newest first", () => {
    expect(trackedDateKeys(source)).toEqual(["2026-09-17", "2026-09-16"])
  })

  it("counts a tag pinned to one block, even on a pen that carries no tags", () => {
    const zoo: TimeEntry = {
      ...block("2026-09-17", "location", "untagged", 600, 840),
      tagIds: ["exercise"],
    }
    const withZoo: TrackedTimeSource = { scopes, entries: [...source.entries, zoo] }
    expect(trackedMinutesForTags(withZoo, "2026-09-17", ["exercise"])).toBe(240)
    expect(trackedMinutesByTag(withZoo, "2026-09-17").exercise).toBe(240)
  })

  it("adds a block tag to the pen's standing tags rather than replacing them", () => {
    const dishesAlsoExercise: TimeEntry = {
      ...block("2026-09-18", "activity", "dishes", 480, 540),
      tagIds: ["exercise"],
    }
    const src: TrackedTimeSource = { scopes, entries: [dishesAlsoExercise] }
    expect(effectiveTagIds(dishesAlsoExercise, scopes).sort()).toEqual(["cleaning", "exercise"])
    expect(trackedMinutesByTag(src, "2026-09-18")).toEqual({ cleaning: 60, exercise: 60 })
  })

  it("resolves the tag objects on a pen", () => {
    const tags = [
      { id: "cleaning", name: "Cleaning", color: "#a" },
      { id: "deep", name: "Deep work", color: "#b" },
    ]
    expect(tagsForPen(tags, scopes[0].pens[0]).map((t) => t.name)).toEqual(["Cleaning"])
    expect(tagsForPen(tags, scopes[0].pens[3])).toEqual([])
  })

  it("unions tags from primary and secondary pens on the same block", () => {
    const dual: TimeEntry = {
      ...block("2026-09-19", "activity", "work", 540, 600),
      secondaryPenIds: ["dishes"],
    }
    expect(effectiveTagIds(dual, scopes).sort()).toEqual(["cleaning", "deep"])
    const src: TrackedTimeSource = { scopes, entries: [dual] }
    expect(trackedMinutesForTags(src, "2026-09-19", ["cleaning"])).toBe(60)
    expect(trackedMinutesForTags(src, "2026-09-19", ["deep"])).toBe(60)
  })
})
