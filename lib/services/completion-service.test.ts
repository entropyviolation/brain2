import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
import { completeTask, uncompleteTask, toggleCompletion, saveCompletionReview, postMortemReviewInput, markMissedOpportunity, unmarkMissedOpportunity } from "@/lib/services/completion-service"
import type { Task } from "@/lib/types"
import { NA_SMART_COMPLETED, NA_SMART_MISSED } from "@/lib/scheduled-lists-sync"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"

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

  it("stores an optional miss reason and still misses when it is left off", () => {
    taskRepository.add(task({ id: "plain" }))
    markMissedOpportunity("plain")
    expect(taskRepository.getById("plain")?.status).toBe("missed")
    expect(taskRepository.getById("plain")?.missReason).toBeUndefined()

    taskRepository.add(task({ id: "noted" }))
    markMissedOpportunity("noted", undefined, { reason: "other", note: "the rain" })
    expect(taskRepository.getById("noted")?.status).toBe("missed")
    expect(taskRepository.getById("noted")?.completed).toBe(false)
    expect(taskRepository.getById("noted")?.missReason).toEqual({ reason: "other", note: "the rain" })
  })

  it("clears a miss reason when the task is reopened", () => {
    taskRepository.add(task({ id: "a", status: "missed", missedAt: new Date(), missReason: "no-time" }))
    unmarkMissedOpportunity("a")
    const updated = taskRepository.getById("a")
    expect(updated?.status).toBe("active")
    expect(updated?.missReason).toBeUndefined()
  })

  it("marks a task as a missed opportunity without completing it", () => {
    taskRepository.add(task({ id: "a" }))
    const updated = markMissedOpportunity("a")
    expect(updated?.completed).toBe(false)
    expect(updated?.status).toBe("missed")
    expect(updated?.missedAt).toBeInstanceOf(Date)
    expect(taskRepository.getById("a")?.status).toBe("missed")
  })

  it("does not miss an already completed task", () => {
    taskRepository.add(task({ id: "a", completed: true, status: "done" }))
    expect(markMissedOpportunity("a")?.completed).toBe(true)
    expect(taskRepository.getById("a")?.status).toBe("done")
  })

  it("reopens a missed opportunity", () => {
    taskRepository.add(task({ id: "a", status: "missed", missedAt: new Date() }))
    unmarkMissedOpportunity("a")
    const updated = taskRepository.getById("a")
    expect(updated?.status).toBe("active")
    expect(updated?.completed).toBe(false)
    expect(updated?.missedAt).toBeUndefined()
  })

  it("files completed and missed tasks onto the Next Actions auto-lists", () => {
    useTaskStore.getState().setFolders([
      { id: "folder-next-actions", name: "Next Actions", createdAt: new Date(), listIds: [NA_SMART_COMPLETED, NA_SMART_MISSED] },
    ])
    useTaskStore.getState().setLists([
      { id: NA_SMART_COMPLETED, name: "Completed", color: "#059669", createdAt: new Date(), autoArchive: "completed" },
      { id: NA_SMART_MISSED, name: "Missed Opportunities", color: "#b45309", createdAt: new Date(), autoArchive: "missed" },
    ])
    taskRepository.add(task({ id: "done-me" }))
    completeTask("done-me")
    expect(taskRepository.getById("done-me")?.lists).toContain(NA_SMART_COMPLETED)
    taskRepository.add(task({ id: "late-me" }))
    markMissedOpportunity("late-me")
    expect(taskRepository.getById("late-me")?.lists).toContain(NA_SMART_MISSED)
    uncompleteTask("done-me")
    expect(taskRepository.getById("done-me")?.lists).not.toContain(NA_SMART_COMPLETED)
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

  it("stores an unknown length without a number", () => {
    taskRepository.add(task({ id: "a", completed: true, actualDuration: 40 }))
    saveCompletionReview("a", { durationCertainty: "unknown", satisfaction: 6 })
    const updated = taskRepository.getById("a")
    expect(updated?.durationCertainty).toBe("unknown")
    expect(updated?.actualDuration).toBeUndefined()
    expect(updated?.completionReview?.durationCertainty).toBe("unknown")
    expect(updated?.completionReview?.actualDuration).toBeUndefined()
    expect(updated?.completionReview?.satisfaction).toBe(6)
  })

  it("keeps an estimated length out of the exact slot and awards quick-review points", () => {
    taskRepository.add(task({ id: "a", completed: true, description: "Letter" }))
    saveCompletionReview("a", {
      durationCertainty: "estimated",
      actualDuration: 25,
      awardQuickReview: true,
      notes: "one two three",
      enjoyment: 8,
    })
    const updated = taskRepository.getById("a")
    expect(updated?.durationCertainty).toBe("estimated")
    expect(updated?.actualDuration).toBe(25)
    expect(updated?.timeRough).toBe(true)
    expect(updated?.completionReview?.reviewWordCount).toBe(3)
    expect(updated?.completionReview?.reviewPoints).toBe(3.3)
    expect(updated?.completionReview?.enjoyment).toBe(8)
    expect(updated?.completionReview?.resistance).toBeUndefined()
    const ledger = usePointsStore.getState().pointsHistory.find((entry) => entry.taskId === "review:a")
    expect(ledger?.points).toBe(3.3)
  })

  it("clears a saved reflection score and leaves scores this save does not mention", () => {
    taskRepository.add(task({ id: "a", completed: true }))
    saveCompletionReview("a", { enjoyment: 8, resistance: 4, expectedDifficulty: 3 })
    saveCompletionReview("a", { enjoyment: null })
    const review = taskRepository.getById("a")?.completionReview
    expect(review?.enjoyment).toBeUndefined()
    expect(review && "enjoyment" in review).toBe(false)
    expect(review?.resistance).toBe(4)
    expect(review?.expectedDifficulty).toBe(3)
    saveCompletionReview("a", { focus: 6 })
    const kept = taskRepository.getById("a")?.completionReview
    expect(kept?.enjoyment).toBeUndefined()
    expect(kept?.resistance).toBe(4)
    expect(kept?.expectedDifficulty).toBe(3)
    expect(kept?.focus).toBe(6)
  })

  it("a later reflect note does not revise the quick-review award", () => {
    taskRepository.add(task({ id: "a", completed: true, description: "Letter" }))
    saveCompletionReview("a", {
      awardQuickReview: true,
      notes: "one two three",
      enjoyment: 8,
      resistance: 4,
    })
    const before = usePointsStore.getState().pointsHistory.filter((entry) => entry.taskId === "review:a")
    const input = postMortemReviewInput({
      note: "a much longer note with many extra words here",
      satisfaction: 6,
      focus: 9,
    })
    expect(input).not.toHaveProperty("notes")
    expect(input).not.toHaveProperty("awardQuickReview")
    expect(input.resistance).toBeNull()
    saveCompletionReview("a", input)
    const review = taskRepository.getById("a")?.completionReview
    expect(review?.notes).toBe("one two three")
    expect(review?.reflectNotes).toBe("a much longer note with many extra words here")
    expect(review?.reviewWordCount).toBe(3)
    expect(review?.reviewPoints).toBe(3.3)
    expect(review?.enjoyment).toBe(8)
    expect(review?.resistance).toBeUndefined()
    expect(review && "resistance" in review).toBe(false)
    expect(review?.focus).toBe(9)
    const after = usePointsStore.getState().pointsHistory.filter((entry) => entry.taskId === "review:a")
    expect(after).toEqual(before)
    expect(after).toHaveLength(1)
    expect(after[0]?.points).toBe(3.3)

    saveCompletionReview("a", { notes: "one two three four five" })
    const untouched = taskRepository.getById("a")?.completionReview
    expect(untouched?.notes).toBe("one two three four five")
    expect(untouched?.reviewWordCount).toBe(3)
    expect(untouched?.reviewPoints).toBe(3.3)
    const still = usePointsStore.getState().pointsHistory.filter((entry) => entry.taskId === "review:a")
    expect(still).toEqual(before)
  })

  it("persists an exact start, an estimated start, and an unknown start with no time", () => {
    const at = new Date(2026, 5, 20, 9, 15)
    taskRepository.add(task({ id: "a", completed: true, description: "Letter" }))

    saveCompletionReview("a", { startCertainty: "exact", startedAt: at, enjoyment: 8 })
    let saved = taskRepository.getById("a")
    expect(saved?.startCertainty).toBe("exact")
    expect(saved?.startedAt?.getHours()).toBe(9)
    expect(saved?.timeRough).toBeUndefined()
    expect(saved?.completionReview?.startCertainty).toBe("exact")
    expect(saved?.completionReview?.startedAt?.getMinutes()).toBe(15)
    expect(saved?.completionReview?.enjoyment).toBe(8)

    saveCompletionReview("a", { startCertainty: "estimated", startedAt: at })
    saved = taskRepository.getById("a")
    expect(saved?.startCertainty).toBe("estimated")
    expect(saved?.startedAt).toBeDefined()
    expect(saved?.timeRough).toBe(true)
    expect(saved?.completionReview?.enjoyment).toBe(8)

    saveCompletionReview("a", { startCertainty: "unknown", enjoyment: null })
    saved = taskRepository.getById("a")
    expect(saved?.startCertainty).toBe("unknown")
    expect(saved?.startedAt).toBeUndefined()
    expect(saved?.timeRough).toBeUndefined()
    expect(saved?.completionReview?.startCertainty).toBe("unknown")
    expect(saved?.completionReview?.startedAt).toBeUndefined()
    expect(saved?.completionReview && "startedAt" in saved.completionReview).toBe(false)
    expect(saved?.completionReview?.enjoyment).toBeUndefined()
    expect(saved?.completionReview && "enjoyment" in saved.completionReview).toBe(false)
  })

  it("returns undefined when reviewing a missing task", () => {
    expect(saveCompletionReview("nope", { satisfaction: 5, resistance: 5, focus: 5, distraction: 5 })).toBeUndefined()
  })
})
