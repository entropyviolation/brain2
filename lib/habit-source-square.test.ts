import { describe, expect, it } from "vitest"
import {
  describeSourceSquare,
  habitTagWiringSummary,
  resolveTrackingTagNames,
  trackingCombineModeLabel,
} from "./habit-source-square"
import { TaskType, type WeeklyTask } from "./types"

const catalog = [
  { id: "tag-cleaning", name: "Cleaning" },
  { id: "tag-work", name: "Work" },
]

function goalHabit(extra: Partial<WeeklyTask> = {}): WeeklyTask {
  return {
    id: "cook",
    name: "Cook",
    type: TaskType.GOAL,
    goal: 2,
    frequency: "weekly",
    completionSources: ["taggedTasks", "tags"],
    taggedTaskTag: "cooking",
    trackingLink: { tagIds: ["tag-cleaning", "tag-work"], unit: "minutes", mode: "add", enabled: true },
    ...extra,
  }
}

describe("resolveTrackingTagNames", () => {
  it("maps ids to catalog names and falls back to the id", () => {
    expect(resolveTrackingTagNames(["tag-cleaning", "gone"], catalog)).toEqual(["Cleaning", "gone"])
    expect(resolveTrackingTagNames(undefined, catalog)).toEqual([])
  })
})

describe("trackingCombineModeLabel", () => {
  it("matches Auto-fill combine labels", () => {
    expect(trackingCombineModeLabel(undefined)).toBe("Add")
    expect(trackingCombineModeLabel("add")).toBe("Add")
    expect(trackingCombineModeLabel("max")).toBe("Higher of the two")
    expect(trackingCombineModeLabel("replace")).toBe("Tracking only")
  })
})

describe("habitTagWiringSummary", () => {
  it("returns Counts and Minutes names without editing", () => {
    expect(habitTagWiringSummary(goalHabit(), catalog)).toEqual({
      counts: "cooking",
      minutes: "Cleaning, Work",
    })
    expect(habitTagWiringSummary(goalHabit({ taggedTaskTag: undefined, trackingLink: undefined }), catalog)).toEqual({
      counts: null,
      minutes: null,
    })
  })
})

describe("describeSourceSquare tag wiring", () => {
  it("lists Tracking tag names, unit, combine, on/off, and minutes", () => {
    const square = describeSourceSquare({
      task: goalHabit({ completionSources: ["tags"] }),
      periodLabel: "Oct 5",
      date: new Date(2026, 9, 5),
      completion: { trackedValue: 45, value: 45 },
      tasks: [],
      weeklyData: {},
      weeklyHabitData: {},
      monthlyHabitData: {},
      gradeTolerance: 0,
      outputGradeTolerance: 0,
      trackingTags: catalog,
    })
    const tags = square.sources.find((source) => source.id === "tags")
    expect(tags?.label).toBe("Tracking tags")
    expect(tags?.lines).toEqual([
      { name: "Tags", value: "Cleaning, Work" },
      { name: "Unit", value: "minutes" },
      { name: "Combine", value: "Add" },
      { name: "Auto-fill", value: "On" },
      { name: "Minutes", value: "45" },
    ])
  })

  it("names the tagged-task tag and the each-Done rule with the goal", () => {
    const square = describeSourceSquare({
      task: goalHabit({ completionSources: ["taggedTasks"] }),
      periodLabel: "Oct 5",
      date: new Date(2026, 9, 5),
      completion: { taggedTaskCount: 1, value: 1 },
      tasks: [],
      weeklyData: {},
      weeklyHabitData: {},
      monthlyHabitData: {},
      gradeTolerance: 0,
      outputGradeTolerance: 0,
      trackingTags: catalog,
    })
    const tagged = square.sources.find((source) => source.id === "taggedTasks")
    expect(tagged?.label).toBe("Tagged tasks")
    expect(tagged?.lines).toEqual([
      { name: "Tag", value: "cooking" },
      { name: "Rule", value: "each Done counts as 1 toward the goal (2)" },
      { name: "Count", value: "1" },
    ])
  })
})
