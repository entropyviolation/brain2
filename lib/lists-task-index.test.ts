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
})
