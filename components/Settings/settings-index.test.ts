import { describe, expect, it } from "vitest"
import {
  SETTINGS_GROUPS,
  SETTINGS_SECTIONS,
  groupShown,
  matchingSections,
  resolveSettingsSelection,
  sectionShown,
  selectedSectionId,
} from "./settings-index"

describe("settings index", () => {
  it("keeps each section in exactly one group, in life order", () => {
    expect(SETTINGS_GROUPS.map((group) => group.id)).toEqual([
      "you",
      "appearance",
      "points",
      "data",
      "imports",
      "library",
    ])
    const ids = SETTINGS_SECTIONS.map((section) => section.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(SETTINGS_SECTIONS.filter((section) => section.groupId === "points").map((section) => section.id)).toEqual([
      "settings-points",
    ])
    expect(SETTINGS_SECTIONS.filter((section) => section.groupId === "you").map((section) => section.title)).toEqual([
      "Baby animal friend",
      "Home location",
      "Birthday",
      "Default time of day",
    ])
  })

  it("shows every section for an empty query", () => {
    expect(matchingSections("  ").map((section) => section.id)).toEqual(SETTINGS_SECTIONS.map((section) => section.id))
    expect(groupShown("library", "")).toBe(true)
  })

  it("matches title, group, and indexed labels", () => {
    expect(matchingSections("birthday").map((section) => section.id)).toEqual(["settings-birthday"])
    expect(matchingSections("star lord").map((section) => section.id)).toEqual(["settings-birthday"])
    expect(matchingSections("you").map((section) => section.groupId)).toEqual(["you", "you", "you", "you"])
    expect(matchingSections("window gray").map((section) => section.id)).toEqual(["settings-window-gray"])
    expect(sectionShown("settings-points", "goal focus")).toBe(true)
    expect(matchingSections("points").map((section) => section.id)).toEqual(["settings-points"])
    expect(matchingSections("inbox").map((section) => section.id)).toEqual(["settings-points"])
    expect(sectionShown("settings-points", "ritual")).toBe(true)
    expect(sectionShown("settings-points", "multiplier")).toBe(true)
    expect(groupShown("appearance", "ceramic")).toBe(true)
    expect(groupShown("you", "ceramic")).toBe(false)
  })

  it("keeps the selected bay and falls back to the first match", () => {
    expect(selectedSectionId("settings-birthday", "")).toBe("settings-birthday")
    expect(selectedSectionId("settings-birthday", "inbox")).toBe("settings-points")
    expect(selectedSectionId("settings-birthday", "zzzz-no-such-bay")).toBeNull()
    expect(resolveSettingsSelection("settings-group-you", "")).toBe("settings-friend")
    expect(resolveSettingsSelection("settings-group-points", "ritual")).toBe("settings-points")
    expect(resolveSettingsSelection("settings-home", "")).toBe("settings-home")
  })

  it("returns nothing when no bay matches", () => {
    expect(matchingSections("zzzz-no-such-bay")).toEqual([])
    expect(groupShown("data", "zzzz-no-such-bay")).toBe(false)
  })
})
