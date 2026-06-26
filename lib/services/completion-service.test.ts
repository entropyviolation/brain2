import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
import { completeTask, uncompleteTask, toggleCompletion, saveCompletionReview } from "@/lib/services/completion-service"
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

describe("completion-service", () => {
  beforeEach(() => resetAllStores())

  it("completes a task and records actual duration", () => {
    taskRepository.add(task({ id: "a" }))
    completeTask("a", { actualDuration: 25 })
    const updated = taskRepository.getById("a")
    expect(updated?.completed).toBe(true)
    expect(updated?.actualDuration).toBe(25)
  })

  it("is a no-op for an already-completed task", () => {
    taskRepository.add(task({ id: "a", completed: true }))
    expect(completeTask("a")?.completed).toBe(true)
  })

  it("counts occurrences for repeated count tasks until total reached", () => {
    taskRepository.add(
      task({ id: "a", isRepeated: true, repeatSettings: { type: "count", totalCount: 3, completedCount: 0 } }),
    )
    completeTask("a")
    expect(taskRepository.getById("a")?.completed).toBe(false)
    expect(taskRepository.getById("a")?.repeatSettings?.completedCount).toBe(1)
    completeTask("a")
    completeTask("a")
    expect(taskRepository.getById("a")?.completed).toBe(true)
    expect(taskRepository.getById("a")?.repeatSettings?.completedCount).toBe(3)
  })

  it("reopens a completed task", () => {
    taskRepository.add(task({ id: "a", completed: true }))
    uncompleteTask("a")
    expect(taskRepository.getById("a")?.completed).toBe(false)
  })

  it("toggles completion both directions", () => {
    taskRepository.add(task({ id: "a" }))
    toggleCompletion("a")
    expect(taskRepository.getById("a")?.completed).toBe(true)
    toggleCompletion("a")
    expect(taskRepository.getById("a")?.completed).toBe(false)
  })

  it("returns undefined for a missing task", () => {
    expect(completeTask("nope")).toBeUndefined()
  })

  it("saves a post-mortem review onto the task", () => {
    taskRepository.add(task({ id: "a", completed: true, actualDuration: 40 }))
    saveCompletionReview("a", { actualDuration: 45, satisfaction: 8, resistance: 3, focus: 7, distraction: 2, notes: "smooth" })
    const updated = taskRepository.getById("a")
    expect(updated?.completionReview?.satisfaction).toBe(8)
    expect(updated?.completionReview?.taskId).toBe("a")
    expect(updated?.completionReview?.actualDuration).toBe(45)
    expect(updated?.actualDuration).toBe(45)
  })

  it("reuses the task's actual duration when the review omits one", () => {
    taskRepository.add(task({ id: "a", completed: true, actualDuration: 30 }))
    saveCompletionReview("a", { satisfaction: 5, resistance: 5, focus: 5, distraction: 5 })
    expect(taskRepository.getById("a")?.completionReview?.actualDuration).toBe(30)
  })

  it("returns undefined when reviewing a missing task", () => {
    expect(saveCompletionReview("nope", { satisfaction: 5, resistance: 5, focus: 5, distraction: 5 })).toBeUndefined()
  })
})
