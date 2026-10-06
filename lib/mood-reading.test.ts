import { describe, expect, it } from "vitest"
import { stablePenColor } from "@/lib/time-tracking-store"
import {
  SAME_WORD_NOTE,
  clampMoodRank,
  groupSameWord,
  identityRewrite,
  lighterMap,
  marksOf,
  moodPenColor,
  moodSentence,
  normalizeWord,
  waterOf,
} from "./mood-reading"

const when = { date: "2026-10-06", startLabel: "9:00 AM", endLabel: "10:00 AM" }

describe("moodSentence", () => {
  it("quotes the name, dates the stretch, lists only set marks, and ends with etc.", () => {
    expect(
      moodSentence({ word: "hopeless", energy: 3, tension: 7, sensation: "tight chest" }, when),
    ).toBe('On 2026-10-06, 9:00 AM–10:00 AM, the word "hopeless". Energy 3, Tension 7. etc.')
    expect(moodSentence({ sensation: "tight chest" }, when)).toBe("On 2026-10-06, 9:00 AM–10:00 AM. etc.")
    expect(moodSentence({ word: "  ", energy: 0 }, when)).toBe("")
  })
})

describe("identity and forever", () => {
  it("lifts the bare word out of an identity", () => {
    expect(identityRewrite("I am hopeless.")).toBe("hopeless")
    expect(identityRewrite("I'm thin light")).toBe("thin light")
    expect(identityRewrite("nothing works")).toBeNull()
  })

  it("offers a lighter map that keeps the body and does not invent a pleasanter one", () => {
    expect(
      lighterMap(
        { narrative: "I am hopeless", sensation: "a tight chest", word: "hopeless" },
        "2026-10-06",
      ),
    ).toBe(
      'This stretch, 2026-10-06: a tight chest, the word "hopeless," and a story that it covers everything.',
    )
    expect(lighterMap({ narrative: "nothing works", word: "low" }, "2026-10-06")).toBe(
      'This stretch, 2026-10-06: the word "low," and a story that it is nothing.',
    )
    expect(lighterMap({ narrative: "it is always like this", word: "flat" }, "2026-10-06")).toMatch(
      /a story that it is always so/,
    )
    expect(lighterMap({ narrative: "a quiet hour", word: "quiet" }, "2026-10-06")).toBeNull()
  })

  it("refuses a lighter map when the shorthand already dates this stretch", () => {
    expect(
      lighterMap(
        { narrative: "This stretch, 2026-10-06: I am hopeless", sensation: "a tight chest", word: "hopeless" },
        "2026-10-06",
      ),
    ).toBeNull()
    expect(
      lighterMap({ narrative: "On 2026-10-06 I am hopeless", word: "hopeless" }, "2026-10-06"),
    ).toBeNull()
  })
})

describe("clampMoodRank", () => {
  it("keeps integers 1–10 and leaves a blank or an out-of-range mark unset", () => {
    expect(clampMoodRank(1)).toBe(1)
    expect(clampMoodRank(10)).toBe(10)
    expect(clampMoodRank(0)).toBeUndefined()
    expect(clampMoodRank(11)).toBeUndefined()
    expect(clampMoodRank(1.5)).toBeUndefined()
    expect(clampMoodRank(undefined)).toBeUndefined()
    expect(clampMoodRank(null)).toBeUndefined()
  })
})

describe("moodPenColor", () => {
  it("is stable for a name regardless of case", () => {
    expect(moodPenColor("Hopeless")).toBe(moodPenColor("  hopeless "))
    expect(moodPenColor("Hopeless")).toBe(stablePenColor(normalizeWord("Hopeless")))
  })
})

describe("groupSameWord", () => {
  it("groups by normalized word and keeps different hours apart", () => {
    const groups = groupSameWord([
      {
        id: "a",
        date: "2026-10-06",
        startMin: 540,
        endMin: 600,
        moodReading: { word: "Hopeless", sensation: "tight chest", energy: 3 },
      },
      {
        id: "b",
        date: "2026-10-07",
        startMin: 600,
        endMin: 660,
        moodReading: { word: "hopeless", vibe: "thin light" },
      },
      {
        id: "c",
        date: "2026-10-06",
        startMin: 700,
        endMin: 760,
        moodReading: { sensation: "warm" },
      },
    ])
    expect(groups).toHaveLength(1)
    expect(groups[0]?.rows.map((row) => row.id)).toEqual(["a", "b"])
    expect(groups[0]?.rows).toHaveLength(2)
    expect(SAME_WORD_NOTE).toBe("These share a word. They are not the same stretch.")
  })
})

describe("water and marks", () => {
  it("averages only the marks that were set and leaves missing tones out", () => {
    const entries = [
      {
        id: "a",
        date: "2026-10-06",
        startMin: 540,
        endMin: 600,
        moodReading: { vibe: "Thin light", cast: 8, energy: 4, tone: "unpleasant" as const, grasping: 7, about: "keeping it" },
      },
      {
        id: "b",
        date: "2026-10-07",
        startMin: 540,
        endMin: 600,
        moodReading: { vibe: "thin light", cast: 4, grasping: 3 },
      },
    ]
    expect(waterOf(entries).phrases).toEqual([{ vibe: "Thin light", dates: ["2026-10-06", "2026-10-07"] }])
    expect(waterOf(entries).means.find((mean) => mean.key === "cast")).toMatchObject({ n: 2, mean: 6 })
    expect(waterOf(entries).means.find((mean) => mean.key === "sociability")).toBeUndefined()
    const marks = marksOf(entries)
    expect(marks.tones.map((tone) => tone.tone)).toEqual(["unpleasant"])
    expect(marks.means.find((mean) => mean.key === "energy")).toMatchObject({ n: 1, mean: 4 })
    expect(marks.graspingWithAbout).toMatchObject({ n: 1, mean: 7 })
    expect(marks.graspingWithoutAbout).toMatchObject({ n: 1, mean: 3 })
  })
})
