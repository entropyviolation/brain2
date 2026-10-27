import { describe, expect, it } from "vitest"
import { getBuiltinItemTypes } from "@/lib/item-types"
import { applyItemTypeToNewTask, itemTypeListLabel, tasksOfItemType } from "@/lib/item-type-lists"
import { COMPUTER_PROJECT_TYPE_ID } from "@/lib/computer-project-types"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import type { Task } from "@/lib/types"

function task(partial: Partial<Task> & Pick<Task, "id">): Task {
  return {
    description: partial.id,
    stage: "list",
    createdAt: new Date("2026-01-01"),
    completed: false,
    lists: [],
    ...partial,
  }
}

describe("item type lists", () => {
  const types = getBuiltinItemTypes()

  it("names a list from the plural", () => {
    expect(itemTypeListLabel({ name: "Book", pluralName: "Books" })).toBe("Books")
    expect(itemTypeListLabel({ name: "Task" })).toBe("Tasks")
  })

  it("includes a subtype in the parent list and not the other way around", () => {
    const items = [
      task({ id: "op", type: OPERATION_TYPE_ID }),
      task({ id: "cp", type: COMPUTER_PROJECT_TYPE_ID }),
      task({ id: "book", type: "book" }),
    ]
    expect(tasksOfItemType(OPERATION_TYPE_ID, items, types).map((row) => row.id).sort()).toEqual(["cp", "op"])
    expect(tasksOfItemType(COMPUTER_PROJECT_TYPE_ID, items, types).map((row) => row.id)).toEqual(["cp"])
    expect(tasksOfItemType("book", items, types).map((row) => row.id)).toEqual(["book"])
  })

  it("stamps a new computer project as an operation with the project preset", () => {
    const base = task({ id: "new", description: "Brain2", type: "item" })
    const next = applyItemTypeToNewTask(base, COMPUTER_PROJECT_TYPE_ID, types)
    expect(next.type).toBe(COMPUTER_PROJECT_TYPE_ID)
    expect(next.title).toBe("Brain2")
    expect(next.attributes?.[OPERATION_ATTR.stage]).toBe("planning")
    expect(next.attributes?.[OPERATION_ATTR.panels]).toEqual(
      expect.arrayContaining(["home", "tasks", "phases"]),
    )
    expect(next.attributes?.[OPERATION_ATTR.categories]).toEqual(["computer work"])
  })
})
