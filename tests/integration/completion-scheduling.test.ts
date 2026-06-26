/**
 * Integration: completion + scheduling services over the repository & stores.
 *
 * Exercises `completion-service` and `scheduling-service` against the live task
 * store, asserting the observable side effects of completing tasks (the points
 * ledger that the store awards on the completed transition, actual-duration
 * capture) and the full schedule/unschedule/push state machine.
 */
import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { completeTask, uncompleteTask, toggleCompletion } from "@/lib/services/completion-service"
import {
  scheduleTask,
  scheduleTaskToTime,
  unscheduleTask,
  pushTask,
} from "@/lib/services/scheduling-service"
import type { Task } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "clarified",
  createdAt: new Date("2026-06-01T00:00:00"),
  completed: false,
  lists: [],
  ...overrides,
})

/** Register a "Next Actions" folder + category so its items award points. */
function seedNextActionsList() {
  const store = useTaskStore.getState()
  store.addList({ id: "na", name: "Next Actions", color: "#222", createdAt: new Date() })
  store.addFolder({ id: "naf", name: "Next Actions", createdAt: new Date(), listIds: ["na"] })
}

describe("integration: completion + scheduling", () => {
  beforeEach(() => resetAllStores())

  it("completing a task captures actual duration and awards its reward points", () => {
    // Plain (non next-action) task: points = rewardValue on completion.
    taskRepository.add(task({ id: "a", rewardValue: 50 }))

    completeTask("a", { actualDuration: 25 })

    const updated = taskRepository.getById("a")
    expect(updated?.completed).toBe(true)
    expect(updated?.actualDuration).toBe(25)
    expect(usePointsStore.getState().getTotalPoints()).toBe(50)
  })

  it("a Next Actions task awards the default single point on completion", () => {
    seedNextActionsList()
    taskRepository.add(task({ id: "na-task", lists: ["na"] }))

    completeTask("na-task")

    expect(taskRepository.getById("na-task")?.completed).toBe(true)
    expect(usePointsStore.getState().getTotalPoints()).toBe(1)
  })

  it("does not double-award points on re-completion and clears on reopen", () => {
    taskRepository.add(task({ id: "a", rewardValue: 10 }))

    completeTask("a")
    completeTask("a") // already complete: no-op, no extra points
    expect(usePointsStore.getState().getTotalPoints()).toBe(10)

    uncompleteTask("a")
    expect(taskRepository.getById("a")?.completed).toBe(false)
    // Points ledger is append-only; reopening doesn't claw points back.
    expect(usePointsStore.getState().getTotalPoints()).toBe(10)

    // Re-completing awards again (a fresh transition).
    toggleCompletion("a")
    expect(taskRepository.getById("a")?.completed).toBe(true)
    expect(usePointsStore.getState().getTotalPoints()).toBe(20)
  })

  it("counts repeated 'count' tasks and only completes at the total", () => {
    taskRepository.add(
      task({
        id: "rep",
        rewardValue: 5,
        isRepeated: true,
        repeatSettings: { type: "count", totalCount: 3, completedCount: 0 },
      }),
    )

    completeTask("rep")
    completeTask("rep")
    expect(taskRepository.getById("rep")?.completed).toBe(false)
    expect(taskRepository.getById("rep")?.repeatSettings?.completedCount).toBe(2)
    // Not completed yet → no points awarded.
    expect(usePointsStore.getState().getTotalPoints()).toBe(0)

    completeTask("rep")
    expect(taskRepository.getById("rep")?.completed).toBe(true)
    expect(usePointsStore.getState().getTotalPoints()).toBe(5)
  })

  it("moves a task through period buckets, an agenda slot, and unschedule", () => {
    taskRepository.add(task({ id: "a" }))

    // Coarse period bucket.
    scheduleTask("a", "month", "2026-06")
    let t = taskRepository.getById("a")
    expect(t?.scheduledMonth).toBe("2026-06")

    // Re-scheduling to a finer bucket clears the coarser one.
    scheduleTask("a", "week", "2026-06-15_2026-06-21")
    t = taskRepository.getById("a")
    expect(t?.scheduledWeek).toBe("2026-06-15_2026-06-21")
    expect(t?.scheduledMonth).toBeUndefined()

    // Pin to a concrete day + time of day (the agenda).
    const date = new Date("2026-06-20T00:00:00")
    scheduleTaskToTime("a", date, "09:00")
    t = taskRepository.getById("a")
    expect(t?.scheduledDate).toEqual(date)
    expect(t?.scheduledTime).toBe("09:00")
    expect(t?.scheduledWeek).toBeUndefined()

    // Unschedule wipes every scheduling field.
    unscheduleTask("a")
    t = taskRepository.getById("a")
    expect(t?.scheduledDate).toBeUndefined()
    expect(t?.scheduledTime).toBeUndefined()
    expect(t?.scheduledMonth).toBeUndefined()
  })

  it("pushes a day-scheduled task forward and tracks the pushed counter", () => {
    const day = new Date("2026-06-20T00:00:00")
    taskRepository.add(task({ id: "a", scheduledDate: day }))

    pushTask("a", "day", taskRepository, day)
    expect(taskRepository.getById("a")?.scheduledDate?.getDate()).toBe(21)
    expect(taskRepository.getById("a")?.daysPushed).toBe(1)

    pushTask("a", "day", taskRepository, day)
    expect(taskRepository.getById("a")?.daysPushed).toBe(2)
  })

  it("returns undefined when the service targets a missing task", () => {
    expect(completeTask("nope")).toBeUndefined()
    expect(scheduleTask("nope", "month", "2026-06")).toBeUndefined()
    expect(unscheduleTask("nope")).toBeUndefined()
    expect(pushTask("nope", "day")).toBeUndefined()
  })
})
