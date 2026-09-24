import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import {
  ensureEventuallyList,
  findEventuallyList,
  leaveEventuallyList,
  placeTasksOnEventually,
  removeUnscheduledFromEventually,
} from "@/lib/eventually-list"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: ["work"],
  ...overrides,
})

describe("eventually list", () => {
  beforeEach(() => resetAllStores())

  it("creates eventually inside Next Actions and clears any period", () => {
    useTaskStore.getState().addTask(task({ id: "a", scheduledDate: new Date(2026, 8, 23), scheduledYear: "2026" }))
    placeTasksOnEventually(["a"])

    const state = useTaskStore.getState()
    const list = findEventuallyList(state.lists, state.folders)
    expect(list?.name).toBe("eventually")
    expect(state.folders.find((f) => f.name === "Next Actions")?.listIds).toContain(list?.id)
    const updated = state.tasks.find((t) => t.id === "a")
    expect(updated?.lists).toContain(list?.id)
    expect(updated?.scheduledDate).toBeUndefined()
    expect(updated?.scheduledYear).toBeUndefined()
    expect(ensureEventuallyList()).toBe(list?.id)
  })

  it("reuses a list already named eventually", () => {
    useTaskStore.getState().addList({
      id: "user-later",
      name: "Eventually",
      color: "#111",
      createdAt: new Date(),
    })
    expect(ensureEventuallyList()).toBe("user-later")
    expect(useTaskStore.getState().lists.filter((l) => l.name.toLowerCase() === "eventually")).toHaveLength(1)
  })

  it("leaves the list when scheduled, and returns an unscheduled hold to the inbox", () => {
    useTaskStore.getState().addTask(task({ id: "a" }))
    placeTasksOnEventually(["a"])
    const listId = findEventuallyList(useTaskStore.getState().lists, useTaskStore.getState().folders)!.id

    leaveEventuallyList("a")
    expect(useTaskStore.getState().tasks.find((t) => t.id === "a")?.lists).not.toContain(listId)

    placeTasksOnEventually(["a"])
    removeUnscheduledFromEventually("a")
    expect(useTaskStore.getState().tasks.find((t) => t.id === "a")?.lists).not.toContain(listId)
  })
})
