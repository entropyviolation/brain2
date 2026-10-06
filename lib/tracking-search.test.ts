import { describe, expect, it } from "vitest"
import type { TimeEntry } from "./time-entries"
import type { TrackScope } from "./time-tracking-store"
import { searchTracking } from "./tracking-search"

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
    ],
  },
]

const block: TimeEntry = {
  id: "te-1",
  date: "2026-10-05",
  scopeId: "activity",
  penId: "walk",
  startMin: 600,
  endMin: 660,
  title: "walk to the beach",
}

describe("searchTracking", () => {
  it("matches a display name, a counts-as parent, and an action format", () => {
    expect(searchTracking("beach", [block], scopes).map((hit) => hit.entryId)).toEqual(["te-1"])
    expect(searchTracking("exercise", [block], scopes)[0]?.match).toBe("counts as")
    expect(searchTracking("went for", [block], scopes)[0]?.match).toBe("action")
    expect(searchTracking("z", [block], scopes)).toEqual([])
  })

  it("matches a mood word, body, vibe, shorthand, reframe, and about-that", () => {
    const mood: TimeEntry = {
      id: "te-mood",
      date: "2026-10-06",
      scopeId: "mood",
      penId: "mood-low",
      startMin: 540,
      endMin: 600,
      moodReading: {
        word: "hopeless",
        sensation: "tight chest",
        vibe: "thin light",
        narrative: "nothing works",
        reframe: "a story that it is nothing",
        about: "keeping it",
      },
    }
    expect(searchTracking("hopeless", [mood], scopes)[0]?.match).toBe("word")
    expect(searchTracking("tight chest", [mood], scopes)[0]?.match).toBe("body")
    expect(searchTracking("thin light", [mood], scopes)[0]?.match).toBe("vibe")
    expect(searchTracking("nothing works", [mood], scopes)[0]?.match).toBe("shorthand")
    expect(searchTracking("story that", [mood], scopes)[0]?.match).toBe("reframe")
    expect(searchTracking("keeping", [mood], scopes)[0]?.match).toBe("about-that")
  })
})
