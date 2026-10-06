import { describe, expect, it } from "vitest"
import type { TimeEntry } from "@/lib/time-entries"
import { defaultScopes } from "@/lib/time-tracking-store"
import { clipTrackedBlocksBefore, pastMinuteCutoff, planDayTrackedGhosts } from "./plan-tracked-ghosts"

function entry(partial: Partial<TimeEntry> & Pick<TimeEntry, "id" | "startMin" | "endMin">): TimeEntry {
  return {
    date: "2026-06-20",
    scopeId: "activity",
    penId: "act-work",
    ...partial,
  }
}

const activity = defaultScopes().find((scope) => scope.id === "activity")
const noon = new Date(2026, 5, 20, 12, 0, 0)
const day = new Date(2026, 5, 20, 15, 0, 0)

describe("plan day tracked ghosts", () => {
  it("returns past tracked blocks on the viewed day and drops later ones", () => {
    const ghosts = planDayTrackedGhosts({
      entries: [
        entry({ id: "morning", title: "Recorded stroll", startMin: 9 * 60, endMin: 10 * 60 }),
        entry({ id: "afternoon", title: "Later errand", startMin: 14 * 60, endMin: 15 * 60 }),
      ],
      scope: activity,
      dayKey: "2026-06-20",
      viewedDay: day,
      now: noon,
    })
    expect(ghosts.map((block) => block.label)).toEqual(["Recorded stroll"])
    expect(ghosts[0]?.startMinutes).toBe(9 * 60)
    expect(ghosts[0]?.durationMinutes).toBe(60)
  })

  it("clips a block that crosses now so the future part stays off the agenda", () => {
    const ghosts = planDayTrackedGhosts({
      entries: [entry({ id: "span", title: "Deep work", startMin: 11 * 60, endMin: 13 * 60 })],
      scope: activity,
      dayKey: "2026-06-20",
      viewedDay: day,
      now: noon,
    })
    expect(ghosts).toHaveLength(1)
    expect(ghosts[0]?.durationMinutes).toBe(60)
    expect(ghosts[0]?.label).toBe("Deep work")
  })

  it("shows every logged block once the viewed day is over", () => {
    const ghosts = planDayTrackedGhosts({
      entries: [
        entry({ id: "morning", date: "2026-06-19", title: "Recorded stroll", startMin: 9 * 60, endMin: 10 * 60 }),
        entry({ id: "afternoon", date: "2026-06-19", title: "Later errand", startMin: 14 * 60, endMin: 15 * 60 }),
      ],
      scope: activity,
      dayKey: "2026-06-19",
      viewedDay: new Date(2026, 5, 19, 8, 0, 0),
      now: noon,
    })
    expect(ghosts.map((block) => block.label)).toEqual(["Recorded stroll", "Later errand"])
  })

  it("shows nothing on a future day", () => {
    const ghosts = planDayTrackedGhosts({
      entries: [entry({ id: "morning", title: "Recorded stroll", date: "2026-06-21", startMin: 9 * 60, endMin: 10 * 60 })],
      scope: activity,
      dayKey: "2026-06-21",
      viewedDay: new Date(2026, 5, 21, 9, 0, 0),
      now: noon,
    })
    expect(ghosts).toEqual([])
    expect(pastMinuteCutoff(new Date(2026, 5, 21, 9, 0, 0), noon)).toBe(0)
  })

  it("shows nothing when nothing was tracked", () => {
    expect(
      planDayTrackedGhosts({
        entries: [],
        scope: activity,
        dayKey: "2026-06-20",
        viewedDay: day,
        now: noon,
      }),
    ).toEqual([])
  })

  it("drops a block that starts at or after the cutoff", () => {
    expect(clipTrackedBlocksBefore([{ id: "now", label: "Now", startMinutes: 12 * 60, durationMinutes: 30 }], 12 * 60)).toEqual(
      [],
    )
  })
})
