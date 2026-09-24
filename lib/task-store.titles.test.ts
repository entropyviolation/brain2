import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { itemTitle } from "@/lib/item-utils"
import type { Task } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date("2026-06-01T08:30:00.000Z"),
  completed: false,
  lists: [],
  ...overrides,
})

/**
 * `title` is the field of record, but plenty of creators and one rename path
 * (`renameDocument`) still write only `description`. The store closes that gap
 * so a display read through `itemTitle` never shows a stale name.
 */
describe("task-store keeps title as the field of record", () => {
  beforeEach(() => resetAllStores())

  it("gives a title to an item created with only a description", () => {
    useTaskStore.getState().addTask(task({ id: "a", description: "Buy milk" }))
    expect(useTaskStore.getState().tasks[0].title).toBe("Buy milk")
  })

  it("follows a rename written through description alone", () => {
    const store = useTaskStore.getState()
    store.addTask(task({ id: "a", description: "Draft" }))
    const created = useTaskStore.getState().tasks[0]
    store.updateTask({ ...created, description: "Final" })

    const renamed = useTaskStore.getState().tasks[0]
    expect(renamed.title).toBe("Final")
    expect(itemTitle(renamed)).toBe("Final")
  })

  it("does not rename a parked note when its body text changes", () => {
    // Parked Apple Notes keep their full text in `description` so search can
    // find them; the short `title` is the name and must survive a body edit.
    const store = useTaskStore.getState()
    store.addTask(task({ id: "a", title: "Weekend", description: "Weekend\nMilk" }))
    store.updateTask({
      ...useTaskStore.getState().tasks[0],
      description: "Weekend\nMilk\nEggs",
    })

    const after = useTaskStore.getState().tasks[0]
    expect(after.title).toBe("Weekend")
    expect(after.description).toBe("Weekend\nMilk\nEggs")
  })

  it("never rewrites description from title", () => {
    const store = useTaskStore.getState()
    store.addTask(task({ id: "a", title: "Short name", description: "The whole body" }))
    expect(useTaskStore.getState().tasks[0].description).toBe("The whole body")
  })
})
