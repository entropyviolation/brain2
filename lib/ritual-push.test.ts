import { describe, expect, it } from "vitest"
import { getWeekString } from "@/lib/date-utils"
import { isPlacementPushed } from "@/lib/scheduling"
import type { Task } from "@/lib/types"
import { ritualPushPatch } from "./ritual-push"
import { unfinishedTasksForRitual } from "./ritual-unfinished"

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    description: partial.description ?? partial.id,
    stage: "scheduled",
    createdAt: new Date(2026, 8, 1, 12, 0, 0),
    completed: false,
    lists: [],
    ...partial,
  }
}

/** Monday 5 Oct 2026, noon. */
const oct5 = new Date(2026, 9, 5, 12, 0, 0)

describe("ritual push", () => {
  it("moves a past day onto the next open day and drops it from that night", () => {
    const open = task({
      id: "letter",
      description: "Letter",
      scheduledDate: new Date(2026, 9, 4, 9, 0, 0),
      schedulePlacements: [{ period: "day", value: "2026-10-04" }],
    })
    const next = { ...open, ...ritualPushPatch(open, "day", "2026-10-04", oct5) }
    expect(next.scheduledDate && new Date(next.scheduledDate).getDate()).toBe(5)
    expect(isPlacementPushed(next, "day", "2026-10-04")).toBe(true)
    expect(unfinishedTasksForRitual([next], "day", "2026-10-04", oct5)).toEqual([])
  })

  it("moves a past week onto the next open week and drops it from that review", () => {
    const week = getWeekString(new Date(2026, 8, 28))
    const open = task({
      id: "clothes",
      description: "sort my clothes",
      scheduledWeek: week,
    })
    const next = { ...open, ...ritualPushPatch(open, "week", week, oct5) }
    expect(next.scheduledWeek).not.toBe(week)
    expect(next.scheduledWeek).toBe(getWeekString(oct5))
    expect(isPlacementPushed(next, "week", week)).toBe(true)
    expect(unfinishedTasksForRitual([next], "week", week, oct5)).toEqual([])
  })
})
