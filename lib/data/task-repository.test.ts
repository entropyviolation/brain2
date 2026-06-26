import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
import { ValidationError } from "@/lib/data/schemas"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  ...overrides,
})

describe("taskRepository", () => {
  beforeEach(() => resetAllStores())

  it("adds and reads tasks", () => {
    taskRepository.add(task({ id: "a" }))
    taskRepository.add(task({ id: "b" }))
    expect(taskRepository.getAll().map((t) => t.id).sort()).toEqual(["a", "b"])
    expect(taskRepository.getById("a")?.id).toBe("a")
    expect(taskRepository.getById("missing")).toBeUndefined()
  })

  it("find filters tasks", () => {
    taskRepository.add(task({ id: "a", completed: true }))
    taskRepository.add(task({ id: "b", completed: false }))
    expect(taskRepository.find((t) => !t.completed).map((t) => t.id)).toEqual(["b"])
  })

  it("updates a task", () => {
    taskRepository.add(task({ id: "a", description: "old" }))
    taskRepository.update(task({ id: "a", description: "new" }))
    expect(taskRepository.getById("a")?.description).toBe("new")
  })

  it("removes a task", () => {
    taskRepository.add(task({ id: "a" }))
    taskRepository.remove("a")
    expect(taskRepository.getById("a")).toBeUndefined()
  })

  it("rejects invalid writes with a ValidationError", () => {
    expect(() => taskRepository.add(task({ id: "", description: "bad" }))).toThrow(ValidationError)
    expect(useTaskStore.getState().tasks).toHaveLength(0)
  })

  describe("tags & links", () => {
    it("byTag matches case/whitespace-insensitively", () => {
      taskRepository.add(task({ id: "a", tags: ["Urgent", "home"] }))
      taskRepository.add(task({ id: "b", tags: ["urgent"] }))
      taskRepository.add(task({ id: "c", tags: [] }))
      expect(taskRepository.byTag(" URGENT ").map((t) => t.id).sort()).toEqual(["a", "b"])
      expect(taskRepository.byTag("home").map((t) => t.id)).toEqual(["a"])
    })

    it("addLink adds a typed link and dedupes", () => {
      taskRepository.add(task({ id: "a" }))
      taskRepository.add(task({ id: "b" }))
      taskRepository.addLink("a", "blocks", "b")
      expect(taskRepository.getById("a")?.links).toHaveLength(1)
      taskRepository.addLink("a", "blocks", "b") // duplicate
      expect(taskRepository.getById("a")?.links).toHaveLength(1)
    })

    it("addLink rejects self-links", () => {
      taskRepository.add(task({ id: "a" }))
      taskRepository.addLink("a", "blocks", "a")
      expect(taskRepository.getById("a")?.links ?? []).toHaveLength(0)
    })

    it("removeLink removes by id", () => {
      taskRepository.add(task({ id: "a" }))
      taskRepository.add(task({ id: "b" }))
      taskRepository.addLink("a", "supports", "b")
      const linkId = taskRepository.getById("a")!.links![0].id
      taskRepository.removeLink("a", linkId)
      expect(taskRepository.getById("a")?.links).toHaveLength(0)
    })

    it("store selectors resolve linked items and backlinks", () => {
      taskRepository.add(task({ id: "a" }))
      taskRepository.add(task({ id: "b" }))
      taskRepository.addLink("a", "blocks", "b")
      const store = useTaskStore.getState()
      expect(store.getLinkedItems("a").map((t) => t.id)).toEqual(["b"])
      expect(store.getLinkedItems("a", "supports")).toHaveLength(0)
      expect(store.getBacklinks("b").map((t) => t.id)).toEqual(["a"])
      expect(store.getBacklinks("b", "blocks").map((t) => t.id)).toEqual(["a"])
    })
  })
})
