import { describe, expect, it } from "vitest"
import { getWeekString, toLocalCalendarDate } from "@/lib/date-utils"
import { quarterStartDate, shiftQuarter } from "@/lib/seasons"
import type { Task } from "@/lib/types"
import { getMonthKey } from "../todo-utils"
import { scheduleTaskForPeriod, seasonMonthDate } from "./todo-desk-schedule"

const ref = new Date(2026, 9, 27, 23, 30, 0)

function task(overrides: Partial<Task>): Task {
  return {
    id: "mail-masters",
    title: "Mail the masters",
    description: "Mail the masters",
    type: "task",
    stage: "clarified",
    createdAt: ref,
    completed: false,
    lists: [],
    tags: [],
    links: [],
    subtasks: [],
    rewardValue: 1,
    estimatedDuration: 30,
    cognitiveLoad: 2,
    urgency: 3,
    importance: 3,
    context: "@general",
    entropy: 0.5,
    allowPartialCompletion: false,
    minimumChunkSize: 15,
    ...overrides,
  }
}

describe("seasonMonthDate", () => {
  it("schedules this month while the season is current and the season's first month otherwise", () => {
    const wall = new Date()
    const current = seasonMonthDate(new Date(wall.getFullYear(), wall.getMonth(), 15, 12))
    expect(Math.abs(current.getTime() - wall.getTime())).toBeLessThan(5_000)

    const previous = shiftQuarter(wall, -1)
    const landed = seasonMonthDate(previous)
    const start = quarterStartDate(previous)
    expect(landed.getFullYear()).toBe(start.getFullYear())
    expect(landed.getMonth()).toBe(start.getMonth())
    expect(landed.getDate()).toBe(1)
  })
})

describe("scheduleTaskForPeriod", () => {
  it("writes the day, the week, or the month and leaves the other placements unset", () => {
    const day = task({ id: "day-mail", title: "Mail the masters", description: "Mail the masters" })
    scheduleTaskForPeriod(day, "day", ref)
    expect(day.scheduledDate).toEqual(toLocalCalendarDate(ref))
    expect(day.scheduledWeek).toBeUndefined()
    expect(day.scheduledMonth).toBeUndefined()

    const week = task({ id: "week-press", title: "Press the lacquers", description: "Press the lacquers" })
    scheduleTaskForPeriod(week, "week", ref)
    expect(week.scheduledWeek).toBe(getWeekString(ref))
    expect(week.scheduledDate).toBeUndefined()
    expect(week.scheduledMonth).toBeUndefined()

    const month = task({ id: "month-jacket", title: "Print the jackets", description: "Print the jackets" })
    scheduleTaskForPeriod(month, "month", ref)
    expect(month.scheduledMonth).toBe(getMonthKey(ref))
    expect(month.scheduledMonth).toBe("2026-10")
    expect(month.scheduledDate).toBeUndefined()
    expect(month.scheduledWeek).toBeUndefined()
  })
})
