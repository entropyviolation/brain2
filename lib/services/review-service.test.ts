import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
import {
  savePeriodReview,
  getPeriodReview,
  upsertPeriodReview,
  carryOverIncomplete,
  tasksIncompleteInPeriod,
  isReviewDue,
} from "@/lib/services/review-service"
import type { PeriodReview, Task } from "@/lib/types"

const review = (overrides: Partial<PeriodReview> = {}): PeriodReview => ({
  id: "day:2026-06-23",
  period: "day",
  periodKey: "2026-06-23",
  completedAt: new Date("2026-06-23T20:00:00"),
  summary: "Good day",
  gratitude: ["coffee"],
  nextPlans: "rest",
  reflections: {},
  resolvedTaskIds: [],
  pushedTaskIds: [],
  ...overrides,
})

const task = (overrides: Partial<Task>): Task => ({
  id: "t1",
  description: "Task",
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  ...overrides,
})

describe("review-service", () => {
  beforeEach(() => resetAllStores())

  it("saves and reads back a review by period + key", () => {
    savePeriodReview(review())
    const loaded = getPeriodReview("day", "2026-06-23")
    expect(loaded?.summary).toBe("Good day")
  })

  it("returns undefined for a missing review", () => {
    expect(getPeriodReview("week", "2026-W01")).toBeUndefined()
  })

  it("upsert creates a blank review with a stable id then patches it", () => {
    const created = upsertPeriodReview("month", "2026-06", { summary: "first" })
    expect(created.id).toBe("month:2026-06")
    expect(created.summary).toBe("first")
    expect(created.gratitude).toEqual([])

    const updated = upsertPeriodReview("month", "2026-06", { gratitude: ["sun"] })
    expect(updated.id).toBe("month:2026-06")
    expect(updated.summary).toBe("first")
    expect(updated.gratitude).toEqual(["sun"])
  })

  it("upsert does not duplicate reviews for the same period key", () => {
    upsertPeriodReview("day", "2026-06-23", { summary: "a" })
    upsertPeriodReview("day", "2026-06-23", { summary: "b" })
    const all = getPeriodReview("day", "2026-06-23")
    expect(all?.summary).toBe("b")
  })

  describe("tasksIncompleteInPeriod", () => {
    it("includes only incomplete tasks scheduled in the day", () => {
      const day = new Date("2026-06-20T00:00:00")
      const tasks = [
        task({ id: "in", scheduledDate: day }),
        task({ id: "done", scheduledDate: day, completed: true }),
        task({ id: "other-day", scheduledDate: new Date("2026-06-21T00:00:00") }),
        task({ id: "unscheduled" }),
      ]
      const ids = tasksIncompleteInPeriod(tasks, "day", "2026-06-20").map((t) => t.id)
      expect(ids).toEqual(["in"])
    })
  })

  describe("carryOverIncomplete", () => {
    it("pushes only incomplete in-period tasks to the next period", () => {
      const day = new Date("2026-06-20T00:00:00")
      taskRepository.add(task({ id: "a", scheduledDate: day }))
      taskRepository.add(task({ id: "done", scheduledDate: day, completed: true }))
      taskRepository.add(task({ id: "other", scheduledDate: new Date("2026-06-25T00:00:00") }))

      const carried = carryOverIncomplete("day", "2026-06-20")
      expect(carried).toEqual(["a"])

      expect(taskRepository.getById("a")?.scheduledDate?.getDate()).toBe(21)
      expect(taskRepository.getById("a")?.daysPushed).toBe(1)
      // untouched tasks
      expect(taskRepository.getById("done")?.scheduledDate?.getDate()).toBe(20)
      expect(taskRepository.getById("other")?.scheduledDate?.getDate()).toBe(25)
    })

    it("records carried ids on the review's pushedTaskIds", () => {
      taskRepository.add(task({ id: "a", scheduledDate: new Date("2026-06-20T00:00:00") }))
      carryOverIncomplete("day", "2026-06-20")
      expect(getPeriodReview("day", "2026-06-20")?.pushedTaskIds).toEqual(["a"])
    })

    it("is idempotent — a second call carries nothing and does not double-push", () => {
      taskRepository.add(task({ id: "a", scheduledDate: new Date("2026-06-20T00:00:00") }))

      const first = carryOverIncomplete("day", "2026-06-20")
      expect(first).toEqual(["a"])
      expect(taskRepository.getById("a")?.scheduledDate?.getDate()).toBe(21)

      const second = carryOverIncomplete("day", "2026-06-20")
      expect(second).toEqual([])
      // schedule did not advance a second time
      expect(taskRepository.getById("a")?.scheduledDate?.getDate()).toBe(21)
      expect(taskRepository.getById("a")?.daysPushed).toBe(1)
      expect(getPeriodReview("day", "2026-06-20")?.pushedTaskIds).toEqual(["a"])
    })

    it("merges into existing pushedTaskIds without duplicating", () => {
      upsertPeriodReview("day", "2026-06-20", { pushedTaskIds: ["a"] })
      taskRepository.add(task({ id: "a", scheduledDate: new Date("2026-06-20T00:00:00") }))
      taskRepository.add(task({ id: "b", scheduledDate: new Date("2026-06-20T00:00:00") }))

      const carried = carryOverIncomplete("day", "2026-06-20")
      // "a" was already recorded as pushed → skipped
      expect(carried).toEqual(["b"])
      expect(getPeriodReview("day", "2026-06-20")?.pushedTaskIds).toEqual(["a", "b"])
      // "a" was not advanced again
      expect(taskRepository.getById("a")?.scheduledDate?.getDate()).toBe(20)
    })

    it("pushes month-scheduled tasks to the next month", () => {
      taskRepository.add(task({ id: "m", scheduledMonth: "2026-06" }))
      carryOverIncomplete("month", "2026-06")
      expect(taskRepository.getById("m")?.scheduledMonth).toBe("2026-07")
    })
  })

  describe("isReviewDue", () => {
    it("is due when the period has ended and no review exists", () => {
      expect(
        isReviewDue("day", "2026-06-20", { now: new Date("2026-06-21T00:00:00"), reviews: [] }),
      ).toBe(true)
    })

    it("is not due before the period ends", () => {
      expect(
        isReviewDue("day", "2026-06-20", { now: new Date("2026-06-20T23:59:00"), reviews: [] }),
      ).toBe(false)
    })

    it("is not due when a review already exists", () => {
      const reviews = [review({ id: "day:2026-06-20", periodKey: "2026-06-20" })]
      expect(
        isReviewDue("day", "2026-06-20", { now: new Date("2026-06-25T00:00:00"), reviews }),
      ).toBe(false)
    })

    it("handles month periods via injected now", () => {
      expect(
        isReviewDue("month", "2026-06", { now: new Date("2026-07-01T00:00:00"), reviews: [] }),
      ).toBe(true)
      expect(
        isReviewDue("month", "2026-06", { now: new Date("2026-06-30T12:00:00"), reviews: [] }),
      ).toBe(false)
    })
  })
})
