/**
 * lib/scheduling.test.ts — Roll-up ladder, past periods, schedule placements
 */
import { describe, it, expect } from "vitest"
import {
  isPastFunnelPeriod,
  isExpiredDaySchedule,
  rollUpScheduleFields,
  rollUpScheduleFieldsCascaded,
  priorityDateOf,
  appendSchedulePlacement,
  dismissFromPeriodFields,
  livePeriodMatches,
  assimilateUndoneFields,
  pushUndoneFields,
  discardUndoneFields,
  nextOpenPeriodValue,
} from "@/lib/scheduling"
import { getWeekString, formatLocalMonthKey } from "@/lib/date-utils"
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

describe("isPastFunnelPeriod", () => {
  const tuesday = new Date(2026, 8, 22, 10, 0, 0) // Tue Sep 22 2026

  it("marks past days and leaves today and future live", () => {
    expect(isPastFunnelPeriod("day", "2026-09-21", tuesday)).toBe(true)
    expect(isPastFunnelPeriod("day", "2026-09-22", tuesday)).toBe(false)
    expect(isPastFunnelPeriod("day", "2026-09-23", tuesday)).toBe(false)
  })

  it("marks a week past only after its last day", () => {
    const weekEndingMonday = "2026-09-14_2026-09-20"
    const weekContainingTuesday = "2026-09-21_2026-09-27"
    expect(isPastFunnelPeriod("week", weekEndingMonday, tuesday)).toBe(true)
    expect(isPastFunnelPeriod("week", weekContainingTuesday, tuesday)).toBe(false)
  })

  it("marks months before the current local month", () => {
    expect(isPastFunnelPeriod("month", "2026-08", tuesday)).toBe(true)
    expect(isPastFunnelPeriod("month", "2026-09", tuesday)).toBe(false)
    expect(isPastFunnelPeriod("month", "2026-10", tuesday)).toBe(false)
  })
})

describe("rollUpScheduleFields", () => {
  it("rolls Monday's open task to that week and records the day placement", () => {
    const monday = new Date(2026, 8, 21, 9, 0, 0)
    const tuesday = new Date(2026, 8, 22, 10, 0, 0)
    const open = task({ id: "mon", scheduledDate: monday, scheduledTime: "09:00" })
    const patch = rollUpScheduleFields(open, tuesday)
    expect(patch?.scheduledDate).toBeUndefined()
    expect(patch?.scheduledTime).toBeUndefined()
    expect(patch?.scheduledWeek).toBe(getWeekString(monday))
    expect(patch?.schedulePlacements).toEqual([{ period: "day", value: "2026-09-21" }])
    expect(patch?.daysPushed).toBeUndefined()
  })

  it("rolls September's open task to that year and records the month", () => {
    const october = new Date(2026, 9, 1, 8, 0, 0)
    const open = task({ id: "sep", scheduledMonth: "2026-09" })
    const patch = rollUpScheduleFields(open, october)
    expect(patch?.scheduledMonth).toBeUndefined()
    expect(patch?.scheduledYear).toBe("2026")
    expect(patch?.schedulePlacements).toEqual([{ period: "month", value: "2026-09" }])
    expect(patch?.monthsPushed).toBeUndefined()
  })

  it("does not roll a pushed-to-today task", () => {
    const today = new Date(2026, 8, 22, 10, 0, 0)
    const pushed = task({ id: "push", scheduledDate: today, daysPushed: 1 })
    expect(rollUpScheduleFields(pushed, today)).toBeNull()
    expect(isExpiredDaySchedule(pushed, today)).toBe(false)
  })

  it("does not roll a completed past-day task", () => {
    const monday = new Date(2026, 8, 21, 9, 0, 0)
    const tuesday = new Date(2026, 8, 22, 10, 0, 0)
    const done = task({ id: "done", scheduledDate: monday, completed: true })
    expect(rollUpScheduleFields(done, tuesday)).toBeNull()
    expect(isExpiredDaySchedule(done, tuesday)).toBe(false)
  })

  it("cascades a long-past day through week and month into the year", () => {
    const oldDay = new Date(2025, 5, 10, 9, 0, 0)
    const now = new Date(2026, 8, 22, 10, 0, 0)
    const open = task({ id: "old", scheduledDate: oldDay })
    const patch = rollUpScheduleFieldsCascaded(open, now)
    expect(patch?.scheduledDate).toBeUndefined()
    expect(patch?.scheduledWeek).toBeUndefined()
    expect(patch?.scheduledMonth).toBeUndefined()
    expect(patch?.scheduledYear).toBeUndefined()
    expect(patch?.schedulePlacements).toEqual(
      expect.arrayContaining([
        { period: "day", value: "2025-06-10" },
        { period: "week", value: getWeekString(oldDay) },
        { period: "month", value: formatLocalMonthKey(oldDay) },
        { period: "year", value: "2025" },
      ]),
    )
  })

  it("appendSchedulePlacement skips duplicates", () => {
    const once = appendSchedulePlacement(undefined, { period: "day", value: "2026-09-21" })
    expect(appendSchedulePlacement(once, { period: "day", value: "2026-09-21" })).toEqual(once)
  })
})

describe("dismissFromPeriodFields", () => {
  const tuesday = new Date(2026, 8, 22, 10, 0, 0)

  it("removes only the matching historical placement without throwing", () => {
    const week = getWeekString(new Date(2026, 8, 21))
    const open = task({
      id: "hist",
      scheduledWeek: week,
      schedulePlacements: [
        { period: "day", value: "2026-09-21" },
        { period: "week", value: "2026-09-14_2026-09-20" },
      ],
    })
    const patch = dismissFromPeriodFields(open, "day", "2026-09-21", tuesday)
    expect(patch.schedulePlacements).toEqual([{ period: "week", value: "2026-09-14_2026-09-20" }])
    expect({ ...open, ...patch }.scheduledWeek).toBe(week)
    expect(livePeriodMatches(open, "day", "2026-09-21")).toBe(false)
  })

  it("rolls a still-live past day up to the week without re-pinning that day", () => {
    const monday = new Date(2026, 8, 21, 9, 0, 0)
    const open = task({ id: "stale", scheduledDate: monday, scheduledTime: "09:00" })
    const patch = dismissFromPeriodFields(open, "day", "2026-09-21", tuesday)
    expect(patch.scheduledDate).toBeUndefined()
    expect(patch.scheduledTime).toBeUndefined()
    expect(patch.scheduledWeek).toBe(getWeekString(monday))
    expect(patch.schedulePlacements ?? []).not.toContainEqual({ period: "day", value: "2026-09-21" })
  })
})

describe("auto-push", () => {
  const tuesday = new Date(2026, 8, 22, 10, 0, 0)

  it("schedules the next week and records the missed week", () => {
    const open = task({
      id: "week",
      autoPush: true,
      scheduledWeek: "2026-09-14_2026-09-20",
    })
    const next = { ...open, ...rollUpScheduleFieldsCascaded(open, tuesday)! }
    expect(next.scheduledWeek).toBe("2026-09-21_2026-09-27")
    expect(next.scheduledMonth).toBeUndefined()
    expect(next.weeksPushed).toBe(1)
    expect(next.schedulePlacements).toEqual([
      { period: "week", value: "2026-09-14_2026-09-20", resolved: "pushed" },
    ])
  })

  it("records every missed day on the way to today", () => {
    const sunday = new Date(2026, 8, 20, 9, 0, 0)
    const open = task({ id: "days", autoPush: true, scheduledDate: sunday })
    const next = { ...open, ...rollUpScheduleFieldsCascaded(open, tuesday)! }
    expect(next.scheduledDate && new Date(next.scheduledDate).getDate()).toBe(22)
    expect(next.daysPushed).toBe(2)
    expect(next.schedulePlacements).toEqual([
      { period: "day", value: "2026-09-20", resolved: "pushed" },
      { period: "day", value: "2026-09-21", resolved: "pushed" },
    ])
    expect(priorityDateOf(next)?.getDate()).toBe(20)
  })
})

describe("undone triage", () => {
  const tuesday = new Date(2026, 8, 22, 10, 0, 0)
  const week = getWeekString(tuesday)

  it("jumps a stale next-day push onto today", () => {
    expect(nextOpenPeriodValue("day", new Date(2026, 8, 1), tuesday)).toBe("2026-09-22")
    expect(nextOpenPeriodValue("day", new Date(2026, 8, 21), tuesday)).toBe("2026-09-22")
  })

  it("assimilate keeps a rolled-up task on its week and leaves the day undone", () => {
    const open = task({
      id: "slid",
      scheduledWeek: week,
      schedulePlacements: [{ period: "day", value: "2026-09-21" }],
    })
    const patch = assimilateUndoneFields(open, "day", "2026-09-21", tuesday)
    expect(patch).toEqual({})
    expect({ ...open, ...patch }.scheduledWeek).toBe(week)
    expect({ ...open, ...patch }.schedulePlacements).toEqual([{ period: "day", value: "2026-09-21" }])
  })

  it("assimilate rolls a still-live past day onto that week and keeps the day undone", () => {
    const monday = new Date(2026, 8, 21, 9, 0, 0)
    const open = task({ id: "stale", scheduledDate: monday })
    const patch = assimilateUndoneFields(open, "day", "2026-09-21", tuesday)
    const next = { ...open, ...patch }
    expect(next.scheduledDate).toBeUndefined()
    expect(next.scheduledWeek).toBe(getWeekString(monday))
    expect(next.schedulePlacements).toEqual([{ period: "day", value: "2026-09-21" }])
  })

  it("push lands on today and leaves the day undone", () => {
    const open = task({
      id: "push",
      scheduledWeek: week,
      schedulePlacements: [{ period: "day", value: "2026-09-21" }],
    })
    const next = { ...open, ...pushUndoneFields(open, "day", "2026-09-21", new Date(2026, 8, 21), tuesday) }
    expect(next.scheduledWeek).toBeUndefined()
    expect(next.scheduledDate && new Date(next.scheduledDate).getDate()).toBe(22)
    expect(next.daysPushed).toBe(1)
    expect(next.schedulePlacements).toEqual([{ period: "day", value: "2026-09-21", resolved: "pushed" }])
  })

  it("discard cancels the task and clears the live schedule", () => {
    const open = task({
      id: "drop",
      scheduledWeek: week,
      schedulePlacements: [{ period: "day", value: "2026-09-21" }],
    })
    const next = { ...open, ...discardUndoneFields(open, "day", "2026-09-21") }
    expect(next.status).toBe("cancelled")
    expect(next.completed).toBe(false)
    expect(next.scheduledWeek).toBeUndefined()
    expect(next.schedulePlacements).toEqual([{ period: "day", value: "2026-09-21", resolved: "discarded" }])
  })
})
