import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import {
  buildListsTaskIndex,
  completionRateForList,
  EMPTY_TASKS,
  tasksForList,
} from "@/lib/lists-task-index"

const task = (partial: Partial<Task> & Pick<Task, "id" | "description">): Task => ({
  createdAt: new Date(),
  completed: false,
  urgency: 1,
  importance: 1,
  lists: [],
  stage: "list",
  ...partial,
})

describe("lists-task-index", () => {
  it("indexes active tasks and completion in one pass", () => {
    const tasks = [
      task({ id: "a", description: "A", lists: ["work"], completed: false }),
      task({ id: "b", description: "B", lists: ["work"], completed: true }),
      task({ id: "c", description: "C", lists: ["home", "work"], completed: false }),
    ]
    const index = buildListsTaskIndex(tasks)
    expect(tasksForList(index, "work").map((t) => t.id)).toEqual(["a", "c"])
    expect(tasksForList(index, "home").map((t) => t.id)).toEqual(["c"])
    expect(tasksForList(index, "missing")).toBe(EMPTY_TASKS)
    expect(completionRateForList(index, "work")).toBe(33)
    expect(completionRateForList(index, "home")).toBe(0)
    expect(index.activeCount).toBe(2)
  })

  it("drops missed opportunities from active list membership", () => {
    const tasks = [
      task({ id: "open", description: "Open", lists: ["work"] }),
      task({ id: "late", description: "Late", lists: ["work"], status: "missed" }),
    ]
    const index = buildListsTaskIndex(tasks)
    expect(tasksForList(index, "work").map((t) => t.id)).toEqual(["open"])
    expect(index.activeCount).toBe(1)
  })

  it("reuses previous list arrays when membership did not change", () => {
    const keep = task({ id: "keep", description: "Keep", lists: ["stable"] })
    const gone = task({ id: "gone", description: "Gone", lists: ["other"] })
    const prev = buildListsTaskIndex([keep, gone])
    const next = buildListsTaskIndex(
      [keep, { ...gone, completed: true }],
      prev,
    )
    expect(tasksForList(next, "stable")).toBe(tasksForList(prev, "stable"))
    expect(tasksForList(next, "other")).toBe(EMPTY_TASKS)
    expect(tasksForList(next, "other")).not.toBe(tasksForList(prev, "other"))
  })

  it("returns the previous index when list and smart-list membership is unchanged", () => {
    const keep = task({ id: "keep", description: "Keep", lists: ["stable"] })
    const loose = task({ id: "loose", description: "Loose" })
    const now = new Date(2026, 0, 15)
    const prev = buildListsTaskIndex([keep, loose], null, now)
    const same = buildListsTaskIndex([keep, loose], prev, now)
    expect(same).toBe(prev)
    const renamed = buildListsTaskIndex([keep, { ...loose, description: "Renamed" }], prev, now)
    expect(renamed).toBe(prev)
  })

  it("returns a new index when a listed task changes or the active count changes", () => {
    const keep = task({ id: "keep", description: "Keep", lists: ["stable"] })
    const loose = task({ id: "loose", description: "Loose" })
    const now = new Date(2026, 0, 15)
    const prev = buildListsTaskIndex([keep, loose], null, now)
    const titled = buildListsTaskIndex([{ ...keep, description: "Renamed" }, loose], prev, now)
    expect(titled).not.toBe(prev)
    expect(tasksForList(titled, "stable")[0]?.description).toBe("Renamed")
    const cleared = buildListsTaskIndex([keep, { ...loose, completed: true }], prev, now)
    expect(cleared).not.toBe(prev)
    expect(cleared.activeCount).toBe(1)
    expect(tasksForList(cleared, "stable")).toBe(tasksForList(prev, "stable"))
  })
})
