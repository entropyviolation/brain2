import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskRepository } from "@/lib/data/task-repository"
import {
  scheduleTask,
  scheduleTaskToTime,
  unscheduleTask,
  pushTask,
  rollUpExpiredSchedules,
} from "@/lib/services/scheduling-service"
import { getWeekString } from "@/lib/date-utils"
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

  it("rolls Monday's open task to that week and keeps the day placement", () => {
    const monday = new Date(2026, 8, 21, 9, 0, 0)
    const tuesday = new Date(2026, 8, 22, 10, 0, 0)
    taskRepository.add(task({ id: "stale", scheduledDate: monday, scheduledTime: "09:00" }))
    taskRepository.add(task({ id: "today", scheduledDate: tuesday }))
    taskRepository.add(task({ id: "done", scheduledDate: monday, completed: true }))
    taskRepository.add(task({ id: "pushed", scheduledDate: monday }))
    pushTask("pushed", "day", taskRepository, monday)

    expect(rollUpExpiredSchedules(tuesday)).toEqual(["stale"])
    const stale = taskRepository.getById("stale")
    expect(stale?.scheduledDate).toBeUndefined()
    expect(stale?.scheduledTime).toBeUndefined()
    expect(stale?.scheduledWeek).toBe(getWeekString(monday))
    expect(stale?.schedulePlacements).toEqual([{ period: "day", value: "2026-09-21" }])
    expect(stale?.daysPushed ?? 0).toBe(0)
    expect(taskRepository.getById("today")?.scheduledDate).toEqual(tuesday)
    expect(taskRepository.getById("done")?.scheduledDate).toEqual(monday)
    expect(taskRepository.getById("pushed")?.scheduledDate?.getDate()).toBe(22)
    expect(taskRepository.getById("pushed")?.daysPushed).toBe(1)
    expect(rollUpExpiredSchedules(tuesday)).toEqual([])
  })

  it("rolls September's open month task to the year and keeps the month placement", () => {
    const october = new Date(2026, 9, 2, 9, 0, 0)
    taskRepository.add(task({ id: "sep", scheduledMonth: "2026-09" }))
    expect(rollUpExpiredSchedules(october)).toEqual(["sep"])
    const t = taskRepository.getById("sep")
    expect(t?.scheduledMonth).toBeUndefined()
    expect(t?.scheduledYear).toBe("2026")
    expect(t?.schedulePlacements).toEqual([{ period: "month", value: "2026-09" }])
  })

  it("keeps a pushed-to-today task on today", () => {
    const yesterday = new Date(2026, 8, 21, 9, 0, 0)
    const today = new Date(2026, 8, 22, 9, 0, 0)
    taskRepository.add(task({ id: "pushed", scheduledDate: yesterday }))
    pushTask("pushed", "day", taskRepository, yesterday)
    expect(rollUpExpiredSchedules(today)).toEqual([])
    expect(taskRepository.getById("pushed")?.scheduledDate?.getDate()).toBe(22)
  })
})
