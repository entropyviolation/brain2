import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { TASK_STORE_PERSIST_VERSION, useTaskStore } from "@/lib/task-store"
import { createListItem, createNextActionItem } from "@/lib/item-utils"
import type { ItemRecord, Task } from "@/lib/types"

const row = (overrides: Partial<ItemRecord>): ItemRecord => ({
  id: "t1",
  description: "Row",
  stage: "list",
  createdAt: new Date("2026-06-01T08:30:00.000Z"),
  completed: false,
  lists: [],
  ...overrides,
})

describe("ItemRecord aliases (slice 1)", () => {
  beforeEach(() => resetAllStores())

  it("treats ItemRecord as the same type as Task", () => {
    const item: ItemRecord = row({ id: "a" })
    const asTask: Task = item
    expect(asTask.id).toBe("a")
  })

  it("addItem writes the same array addTask uses", () => {
    useTaskStore.getState().addItem(row({ id: "via-item", title: "Via item", description: "Via item" }))
    const { tasks, getItems } = useTaskStore.getState()
    const found = tasks.find((t) => t.id === "via-item")
    expect(found).toBeDefined()
    expect(getItems().find((t) => t.id === "via-item")).toBe(found)
  })

  it("updateItem mutates the tasks array in place of the same id", () => {
    useTaskStore.getState().addItem(row({ id: "u", description: "old" }))
    const created = useTaskStore.getState().tasks.find((t) => t.id === "u")!
    useTaskStore.getState().updateItem({ ...created, description: "new" })
    expect(useTaskStore.getState().tasks.find((t) => t.id === "u")?.description).toBe("new")
  })

  it("deleteItem removes from tasks", () => {
    useTaskStore.getState().addItem(row({ id: "gone" }))
    useTaskStore.getState().deleteItem("gone")
    expect(useTaskStore.getState().tasks.find((t) => t.id === "gone")).toBeUndefined()
  })

  it("getItems returns the same tasks array reference", () => {
    const { tasks, getItems } = useTaskStore.getState()
    expect(getItems()).toBe(tasks)
  })

  it("persist version is 12 after the honest-type backfill", () => {
    expect(TASK_STORE_PERSIST_VERSION).toBe(12)
  })

  it("createListItem is type item; createNextActionItem is type task", () => {
    expect(createListItem("rug").type).toBe("item")
    expect(createNextActionItem("Write intro").type).toBe("task")
  })
})
