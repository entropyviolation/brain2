import { describe, expect, it } from "vitest"
import {
  completedRitualSections,
  DEFAULT_RITUAL_COMPLETION_BONUS,
  DEFAULT_RITUAL_SECTION_POINTS,
  ritualAwardPoints,
} from "./ritual-points"

const empty = {
  period: "day" as const,
  unfinishedCount: 0,
  unfinishedTouched: 0,
  assumedPending: 0,
  assumedTouched: false,
  planShown: false,
}

describe("ritual award points", () => {
  it("defaults to 10 per completed section and 30 for submitting", () => {
    expect(DEFAULT_RITUAL_SECTION_POINTS).toBe(10)
    expect(DEFAULT_RITUAL_COMPLETION_BONUS).toBe(30)
    const points = ritualAwardPoints(
      { ...empty, summary: "a quiet day", gratitude: ["tea"] },
      { sectionPoints: 10, completionBonus: 30 },
      true,
    )
    // unfinished (vacuous) + assumed (vacuous) + summary + gratitude + 30
    expect(completedRitualSections({ ...empty, summary: "a quiet day", gratitude: ["tea"] })).toEqual([
      "unfinished",
      "assumed",
      "summary",
      "gratitude",
    ])
    expect(points).toBe(70)
  })

  it("skips optional blanks and untouched unfinished rows", () => {
    const sections = completedRitualSections({
      ...empty,
      unfinishedCount: 3,
      unfinishedTouched: 0,
      assumedPending: 2,
      assumedTouched: false,
      wakeReminder: "   ",
      tomorrowMatters: "",
      focusGoalCount: 0,
      reflections: { wentWell: "walk" },
    })
    expect(sections).toEqual(["wentWell"])
    expect(
      ritualAwardPoints(
        {
          ...empty,
          unfinishedCount: 3,
          assumedPending: 2,
          reflections: { wentWell: "walk" },
        },
        { sectionPoints: 10, completionBonus: 30 },
        true,
      ),
    ).toBe(40)
  })

  it("awards nothing for a draft", () => {
    expect(
      ritualAwardPoints({ ...empty, summary: "kept" }, { sectionPoints: 10, completionBonus: 30 }, false),
    ).toBe(0)
  })

  it("honors edited amounts", () => {
    expect(ritualAwardPoints(empty, { sectionPoints: 4, completionBonus: 7 }, true)).toBe(15)
  })

  it("counts each answered longer-ritual question, including a photo with no caption", () => {
    const sections = completedRitualSections({
      ...empty,
      period: "week",
      arc: {
        wins: "the letter",
        fear: "missing it",
        fearReframe: "I can send a short one",
        inspiredPhotos: [{ id: "p", name: "fern", mime: "image/jpeg", uri: "idb:p" }],
      },
    })
    expect(sections).toEqual(expect.arrayContaining(["arc:wins", "arc:fear", "arc:inspired"]))
    expect(sections.filter((id) => id === "arc:fear")).toHaveLength(1)
    const points = ritualAwardPoints(
      {
        ...empty,
        period: "month",
        unfinishedCount: 1,
        assumedPending: 1,
        arc: { inspiredPhotos: [{ id: "p", name: "fern", mime: "image/jpeg", uri: "idb:p" }] },
      },
      { sectionPoints: 10, completionBonus: 30 },
      true,
    )
    expect(points).toBe(40)
  })

  it("does not count blank arc answers or a day ritual's unused arc", () => {
    expect(
      completedRitualSections({ ...empty, period: "week", arc: { wins: "  ", fear: "" } }),
    ).not.toContain("arc:wins")
    expect(
      completedRitualSections({ ...empty, period: "day", arc: { wins: "kept for morning" } }),
    ).not.toContain("arc:wins")
  })
})
