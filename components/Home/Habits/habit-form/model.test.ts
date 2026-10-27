import { describe, expect, it } from "vitest"
import { TaskType, type WeeklyTask } from "@/lib/types"
import { habitSectionNav, sourcesForListRouting, withSourceOrder } from "./model"

function habit(overrides: Partial<WeeklyTask> = {}): WeeklyTask {
  return {
    id: "read-liner",
    name: "Read the liner notes",
    type: TaskType.BOOLEAN,
    frequency: "daily",
    rewardValue: 10,
    ...overrides,
  }
}

describe("habitSectionNav", () => {
  it("mounts Target or Climb, Auto-fill, keywords, Connections, and Lift only when that section applies", () => {
    const ids = (rows: { id: string }[]) => rows.map((row) => row.id)

    const goal = habitSectionNav({
      type: TaskType.GOAL,
      frequency: "daily",
      showTracking: true,
      keywordsOn: true,
    })
    expect(goal.find((row) => row.id === "habit95-sec-target")?.label).toBe("Target")
    expect(ids(goal)).toEqual(expect.arrayContaining(["habit95-sec-fill", "habit95-sec-keywords", "habit95-sec-lift"]))
    expect(ids(goal)).not.toContain("habit95-sec-links")

    const climb = habitSectionNav({
      type: TaskType.INCREMENTAL,
      frequency: "weekly",
      showTracking: false,
      keywordsOn: false,
    })
    expect(climb.find((row) => row.id === "habit95-sec-target")?.label).toBe("Climb")
    expect(ids(climb)).not.toContain("habit95-sec-fill")
    expect(ids(climb)).not.toContain("habit95-sec-keywords")
    expect(ids(climb)).not.toContain("habit95-sec-lift")
    expect(ids(climb)).not.toContain("habit95-sec-links")

    const yesNo = habitSectionNav({
      type: TaskType.BOOLEAN,
      frequency: "daily",
      showTracking: false,
      keywordsOn: false,
    })
    expect(ids(yesNo)).toEqual(expect.arrayContaining(["habit95-sec-links", "habit95-sec-lift"]))
    expect(ids(yesNo)).not.toContain("habit95-sec-target")

    const weekly = habitSectionNav({
      type: TaskType.BOOLEAN,
      frequency: "weekly",
      showTracking: false,
      keywordsOn: false,
    })
    expect(ids(weekly)).not.toContain("habit95-sec-links")
    expect(ids(weekly)).not.toContain("habit95-sec-lift")
  })
})

describe("sources and source order", () => {
  it("routes a list measure onto list or listSent, and turns coverage and the daily floor on and off", () => {
    expect(sourcesForListRouting({ measure: "completed", target: "one" })).toEqual(["list"])
    expect(sourcesForListRouting({ measure: "sent", target: "periodSet" })).toEqual(["listSent"])
    expect(sourcesForListRouting({ measure: "sent", target: "listLength" })).toEqual(["listSent"])
    expect(sourcesForListRouting({ measure: "completed", target: "listLength" })).toEqual([])
    expect(sourcesForListRouting({ measure: "added", target: "one" })).toEqual([])

    const covered = withSourceOrder(habit({ goal: 0 }), ["coverage"])
    expect(covered.coverageLink).toEqual({ threshold: 75, enabled: true })
    expect(covered.goal).toBe(75)
    expect(covered.unit).toBe("%")

    const kept = withSourceOrder(habit({ type: TaskType.GOAL, goal: 40, unit: "pages" }), ["coverage"])
    expect(kept.coverageLink).toEqual({ threshold: 40, enabled: true })
    expect(kept.goal).toBe(40)
    expect(kept.unit).toBe("pages")
    expect(withSourceOrder(kept, []).coverageLink).toBeNull()

    const floor = withSourceOrder(habit({ type: TaskType.GOAL, frequency: "monthly" }), ["dailyFloor"])
    expect(floor.frequency).toBe("weekly")
    expect(floor.type).toBe(TaskType.GOAL)
    expect(floor.dailyFloorLink).toEqual({ floorPercent: 0, enabled: true })
    expect(withSourceOrder(floor, []).dailyFloorLink).toBeNull()

    const tagged = withSourceOrder(habit({ trackingLink: { tagIds: ["cooking"], enabled: true } }), [])
    expect(tagged.trackingLink).toEqual({ tagIds: ["cooking"], enabled: false })
  })
})
