import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
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
  stage: "list",
  createdAt: new Date(),
  completed: false,
  lists: [],
  ...overrides,
})

describe("scheduling-service", () => {
  beforeEach(() => resetAllStores())

  it("schedules to a month bucket and clears other fields", () => {
    taskRepository.add(task({ id: "a", scheduledYear: "2025" }))
    scheduleTask("a", "month", "2026-06")
    const t = taskRepository.getById("a")
    expect(t?.scheduledMonth).toBe("2026-06")
    expect(t?.scheduledYear).toBeUndefined()
  })

  it("scheduling to always clears everything", () => {
    taskRepository.add(task({ id: "a", scheduledMonth: "2026-06" }))
    scheduleTask("a", "always", "")
    expect(taskRepository.getById("a")?.scheduledMonth).toBeUndefined()
  })

  it("pins a task to a date and time", () => {
    taskRepository.add(task({ id: "a" }))
    const date = new Date("2026-06-20T00:00:00")
    scheduleTaskToTime("a", date, "09:00")
    const t = taskRepository.getById("a")
    expect(t?.scheduledTime).toBe("09:00")
    expect(t?.scheduledDate).toEqual(date)
  })

  it("unschedules a task", () => {
    taskRepository.add(task({ id: "a", scheduledMonth: "2026-06" }))
    unscheduleTask("a")
    expect(taskRepository.getById("a")?.scheduledMonth).toBeUndefined()
  })

  it("pushes a day-scheduled task forward one day", () => {
    const day = new Date("2026-06-20T00:00:00")
    taskRepository.add(task({ id: "a", scheduledDate: day }))
    pushTask("a", "day", taskRepository, day)
    const t = taskRepository.getById("a")
    expect(t?.scheduledDate?.getDate()).toBe(21)
  })

  it("returns undefined for a missing task", () => {
    expect(scheduleTask("nope", "month", "2026-06")).toBeUndefined()
  })
})
