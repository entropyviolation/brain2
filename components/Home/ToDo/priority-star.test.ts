import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { releaseStaleTaskPriority, taskIsPrioritized } from "@/lib/todo-commitment"

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    description: partial.id,
    stage: "scheduled",
    createdAt: new Date("2026-10-01T12:00:00"),
    completed: false,
    lists: [],
    ...partial,
  }
}

/** Saturday 25 Oct 2026, noon local. */
const asOf = new Date(2026, 9, 25, 12, 0, 0)

describe("task-card priority star", () => {
  it("keeps a fresh star prioritized and treats a stamp past 14 days as not", () => {
    const fresh = task({
      id: "a",
      priorityRefreshedOn: "2026-10-25",
      todoMarks: [{ period: "day", periodKey: "2026-10-25", prioritized: true }],
    })
    expect(taskIsPrioritized(fresh, "day", "2026-10-25", undefined, asOf)).toBe(true)
    expect(releaseStaleTaskPriority(fresh, asOf)).toBe(fresh)

    const held = task({
      id: "a",
      priorityRefreshedOn: "2026-10-12",
      todoMarks: [{ period: "day", periodKey: "2026-10-25", prioritized: true }],
    })
    expect(taskIsPrioritized(held, "day", "2026-10-25", undefined, asOf)).toBe(true)

    const fortnight = task({
      id: "a",
      priorityRefreshedOn: "2026-10-11",
      todoMarks: [{ period: "day", periodKey: "2026-10-25", prioritized: true }],
    })
    expect(taskIsPrioritized(fortnight, "day", "2026-10-25", undefined, asOf)).toBe(false)

    const stale = task({
      id: "a",
      priorityRefreshedOn: "2026-10-10",
      todoMarks: [{ period: "day", periodKey: "2026-10-25", prioritized: true, required: true }],
    })
    expect(taskIsPrioritized(stale, "day", "2026-10-25", ["a"], asOf)).toBe(false)
    const released = releaseStaleTaskPriority(stale, asOf)
    expect(taskIsPrioritized(released, "day", "2026-10-25", undefined, asOf)).toBe(false)
    expect(released.todoMarks).toEqual([{ period: "day", periodKey: "2026-10-25", required: true }])
    expect(released.priorityRefreshedOn).toBeUndefined()
    expect(released.priorityLog?.at(-1)).toMatchObject({ kind: "off", dayKey: "2026-10-25" })
  })
})
