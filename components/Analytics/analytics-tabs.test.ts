/**
 * Analytics tab groups + views.
 */
import { describe, expect, it } from "vitest"
import {
  ANALYTICS_TAB_GROUPS,
  ANALYTICS_TAB_HELP,
  ANALYTICS_TABS,
  firstTabInGroup,
  groupForTab,
  tabLabel,
} from "./analytics-tabs"

describe("analytics tabs", () => {
  it("groups views under a bar with Item Types in Library", () => {
    expect(ANALYTICS_TAB_GROUPS.map((g) => g.id)).toEqual([
      "behavior",
      "time",
      "accuracy",
      "meta",
      "library",
    ])
    expect(ANALYTICS_TABS).toContain("item-types")
    expect(ANALYTICS_TABS).toContain("cross-section")
    expect(ANALYTICS_TABS).toContain("habits")
    expect(ANALYTICS_TABS).toContain("calibration")
    expect(ANALYTICS_TABS).toContain("overcommit")
    expect(groupForTab("overcommit").id).toBe("behavior")
    expect(tabLabel("overcommit")).toBe("Overcommit")
    expect(groupForTab("item-types").id).toBe("library")
    expect(groupForTab("cross-section").id).toBe("meta")
    expect(tabLabel("item-types")).toBe("Item Types")
    expect(ANALYTICS_TABS).toContain("observatory")
    expect(ANALYTICS_TABS).toContain("circadian")
    expect(ANALYTICS_TABS).toContain("places")
    expect(ANALYTICS_TABS).toContain("mood-field")
    expect(ANALYTICS_TABS).toContain("velocity")
    expect(ANALYTICS_TABS).toContain("cycle")
    expect(ANALYTICS_TABS).toContain("goals")
    expect(ANALYTICS_TABS).toContain("operations")
    expect(ANALYTICS_TABS).toContain("lists-areas")
    expect(ANALYTICS_TABS).toContain("attributes")
    expect(ANALYTICS_TABS).toContain("tags")
    expect(ANALYTICS_TABS).toContain("stages")
    expect(ANALYTICS_TABS).toContain("weight")
    expect(ANALYTICS_TABS).toContain("diversity")
    expect(ANALYTICS_TABS).toContain("screentime")
    expect(ANALYTICS_TABS).toContain("transitions")
    expect(ANALYTICS_TABS).toContain("text-events")
    expect(ANALYTICS_TABS).toContain("text-spans")
    expect(ANALYTICS_TABS).toContain("spectrum")
    expect(ANALYTICS_TABS).toContain("todo-pulse")
    expect(groupForTab("todo-pulse").id).toBe("behavior")
    expect(tabLabel("todo-pulse")).toBe("To-do pulse")
    expect(groupForTab("observatory").id).toBe("meta")
    expect(groupForTab("circadian").id).toBe("time")
    expect(groupForTab("screentime").id).toBe("time")
    expect(tabLabel("screentime")).toBe("Screen Time")
    expect(groupForTab("diversity").id).toBe("time")
    expect(groupForTab("transitions").id).toBe("time")
    expect(groupForTab("text-events").id).toBe("time")
    expect(groupForTab("text-spans").id).toBe("time")
    expect(tabLabel("text-events")).toBe("Text events")
    expect(tabLabel("text-spans")).toBe("Text spans")
    expect(groupForTab("spectrum").id).toBe("meta")
    expect(groupForTab("velocity").id).toBe("behavior")
    expect(firstTabInGroup("meta")).toBe("observatory")
  })

  it("keeps every interpretive view", () => {
    const labels = ANALYTICS_TAB_GROUPS.flatMap((g) => g.tabs.map((t) => t.label))
    expect(labels).toEqual(
      expect.arrayContaining([
        "Habits",
        "Streaks",
        "Points",
        "Reflection",
        "To-do pulse",
        "Reviews",
        "Overcommit",
        "Velocity",
        "Tracking",
        "Sleep",
        "Screen Time",
        "Circadian",
        "Places",
        "Mood field",
        "Diversity",
        "Transitions",
        "Context Switch",
        "Text events",
        "Text spans",
        "Operations",
        "Plan vs Reality",
        "Calibration",
        "Cycle",
        "Regret",
        "Goals",
        "Observatory",
        "Metrics",
        "Correlation",
        "Spectrum",
        "Cross-section",
        "Item Types",
        "Lists & areas",
        "Attributes",
        "Tags",
        "Stages",
        "Weight",
      ]),
    )
  })

  it("keeps Screen Time help honest", () => {
    expect(ANALYTICS_TAB_HELP.screentime).toMatch(/ActivityWatch/)
    expect(ANALYTICS_TAB_HELP.screentime).toMatch(/AFK/)
    expect(ANALYTICS_TAB_HELP.screentime).toMatch(/Activity occupancy/)
    expect(ANALYTICS_TAB_HELP.screentime).toMatch(/last-sync/)
  })
})
