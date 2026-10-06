import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { unfinishedTasksForRitual } from "./ritual-unfinished"

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    description: partial.id,
    stage: "scheduled",
    createdAt: new Date(2026, 9, 1, 12, 0, 0),
    completed: false,
    lists: [],
    ...partial,
  }
}

/** Monday 5 Oct 2026, noon. Yesterday is Sunday 4 Oct. */
const oct5 = new Date(2026, 9, 5, 12, 0, 0)

describe("unfinishedTasksForRitual", () => {
  it("uses yesterday's undone placements, not tasks scheduled today", () => {
    const rolled = task({
      id: "rolled",
      description: "Still open from yesterday",
      scheduledDate: new Date(2026, 9, 5, 9, 0, 0),
      schedulePlacements: [{ period: "day", value: "2026-10-04" }],
    })
    const onlyToday = task({
      id: "today",
      description: "New today",
      scheduledDate: new Date(2026, 9, 5, 9, 0, 0),
    })
    const finishedYesterday = task({
      id: "done",
      description: "Finished on the 4th",
      completed: true,
      completedDate: new Date(2026, 9, 4, 18, 0, 0),
      schedulePlacements: [{ period: "day", value: "2026-10-04" }],
    })

    const yesterday = unfinishedTasksForRitual([rolled, onlyToday, finishedYesterday], "day", "2026-10-04", oct5)
    expect(yesterday.map((row) => row.id)).toEqual(["rolled"])

    const today = unfinishedTasksForRitual([rolled, onlyToday, finishedYesterday], "day", "2026-10-05", oct5)
    expect(today.map((row) => row.id).sort()).toEqual(["rolled", "today"])
  })

  it("keeps a task still scheduled on the ritual day", () => {
    const stayed = task({
      id: "stayed",
      scheduledDate: new Date(2026, 9, 4, 15, 0, 0),
    })
    const rows = unfinishedTasksForRitual([stayed], "day", "2026-10-04", oct5)
    expect(rows.map((row) => row.id)).toEqual(["stayed"])
  })
})
