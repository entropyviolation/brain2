/**
 * Integration: end-of-period review carry-over across task + review stores.
 *
 * Schedules tasks into a period, completes some through the completion service,
 * then runs `carryOverIncomplete` and asserts (a) only incomplete in-period
 * tasks were pushed to the next period, (b) the carried ids were recorded on the
 * period review, and (c) a second run is idempotent (carries nothing, does not
 * double-advance schedules).
 */
import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
import { completeTask } from "@/lib/services/completion-service"
import {
  carryOverIncomplete,
  getPeriodReview,
  tasksIncompleteInPeriod,
} from "@/lib/services/review-service"
import type { Task } from "@/lib/types"

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "scheduled",
  createdAt: new Date("2026-06-01T00:00:00"),
  completed: false,
  lists: [],
  ...overrides,
})

describe("integration: review carry-over", () => {
  beforeEach(() => resetAllStores())

  it("carries only incomplete in-period tasks to the next day and records them", () => {
    const day = new Date("2026-06-20T00:00:00")
    taskRepository.add(task({ id: "a", scheduledDate: day }))
    taskRepository.add(task({ id: "b", scheduledDate: day }))
    taskRepository.add(task({ id: "c", scheduledDate: day }))
    taskRepository.add(task({ id: "other", scheduledDate: new Date("2026-06-25T00:00:00") }))

    // Finish one of the in-period tasks through the completion service.
    completeTask("b")
    expect(taskRepository.getById("b")?.completed).toBe(true)

    // Sanity: the selector agrees on what's still open in the period.
    const open = tasksIncompleteInPeriod(taskRepository.getAll(), "day", "2026-06-20").map((t) => t.id)
    expect(open.sort()).toEqual(["a", "c"])

    const carried = carryOverIncomplete("day", "2026-06-20")
    expect(carried.sort()).toEqual(["a", "c"])

    // Open in-period tasks advanced one day; pushed counter bumped.
    expect(taskRepository.getById("a")?.scheduledDate?.getDate()).toBe(21)
    expect(taskRepository.getById("a")?.daysPushed).toBe(1)
    expect(taskRepository.getById("c")?.scheduledDate?.getDate()).toBe(21)

    // Completed + out-of-period tasks were untouched.
    expect(taskRepository.getById("b")?.scheduledDate?.getDate()).toBe(20)
    expect(taskRepository.getById("other")?.scheduledDate?.getDate()).toBe(25)

    // The review now records who was carried.
    expect(getPeriodReview("day", "2026-06-20")?.pushedTaskIds.sort()).toEqual(["a", "c"])
  })

  it("is idempotent — a second run carries nothing and does not double-advance", () => {
    const day = new Date("2026-06-20T00:00:00")
    taskRepository.add(task({ id: "a", scheduledDate: day }))

    const first = carryOverIncomplete("day", "2026-06-20")
    expect(first).toEqual(["a"])
    expect(taskRepository.getById("a")?.scheduledDate?.getDate()).toBe(21)
    expect(taskRepository.getById("a")?.daysPushed).toBe(1)

    const second = carryOverIncomplete("day", "2026-06-20")
    expect(second).toEqual([])
    // The task is now scheduled on the 21st (out of the 20th's bucket) and the
    // pushed counter did not advance again.
    expect(taskRepository.getById("a")?.scheduledDate?.getDate()).toBe(21)
    expect(taskRepository.getById("a")?.daysPushed).toBe(1)
    expect(getPeriodReview("day", "2026-06-20")?.pushedTaskIds).toEqual(["a"])
  })

  it("carries month-scheduled tasks into the next month", () => {
    taskRepository.add(task({ id: "m1", scheduledMonth: "2026-06" }))
    taskRepository.add(task({ id: "m2", scheduledMonth: "2026-06", completed: true }))
    taskRepository.add(task({ id: "m3", scheduledMonth: "2026-07" }))

    const carried = carryOverIncomplete("month", "2026-06")
    expect(carried).toEqual(["m1"])

    expect(taskRepository.getById("m1")?.scheduledMonth).toBe("2026-07")
    expect(taskRepository.getById("m1")?.monthsPushed).toBe(1)
    expect(taskRepository.getById("m3")?.scheduledMonth).toBe("2026-07")
    expect(getPeriodReview("month", "2026-06")?.pushedTaskIds).toEqual(["m1"])

    // Re-running finds nothing left in June.
    expect(carryOverIncomplete("month", "2026-06")).toEqual([])
  })
})
