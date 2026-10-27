import { describe, expect, it } from "vitest"
import { taskModifiedMs, withModifiedStamp } from "@/lib/task-modified"
import type { Task } from "@/lib/types"

function task(partial: Partial<Task> = {}): Task {
  return {
    id: "t",
    description: "Task",
    stage: "clarified",
    createdAt: new Date("2026-06-01T12:00:00.000Z"),
    completed: false,
    lists: [],
    ...partial,
  }
}

describe("task modified stamp", () => {
  it("stamps a content change and leaves a no-op alone", () => {
    const prev = task()
    const now = new Date("2026-10-27T15:00:00.000Z")
    const edited = withModifiedStamp(prev, { ...prev, description: "Renamed" }, now)
    expect(edited.modifiedAt).toBe(now.toISOString())
    const again = withModifiedStamp(edited, { ...edited, description: "Renamed" }, new Date("2026-10-28T00:00:00.000Z"))
    expect(again.modifiedAt).toBe(now.toISOString())
    const bare = withModifiedStamp(prev, { ...prev }, new Date("2026-10-28T00:00:00.000Z"))
    expect(bare.modifiedAt).toBeUndefined()
  })

  it("orders by the stamp ahead of an older created date", () => {
    const older = task({
      id: "older",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      modifiedAt: "2026-10-27T15:00:00.000Z",
    })
    const newer = task({ id: "newer", createdAt: new Date("2026-10-01T00:00:00.000Z") })
    expect(taskModifiedMs(older)).toBeGreaterThan(taskModifiedMs(newer))
  })
})
