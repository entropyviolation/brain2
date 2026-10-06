import { describe, expect, it } from "vitest"
import {
  dismissCardWorkingQueue,
  finishCardInPeriod,
  partitionCardDetail,
  pushCardWorkingQueue,
  unscheduleCardWorkingQueue,
} from "./schedule-card-detail"
import type { Task } from "@/lib/types"

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    title: partial.id,
    description: partial.id,
    completed: false,
    createdAt: new Date(2026, 8, 1),
    ...partial,
  } as Task
}

const september = new Date(2026, 8, 24, 12, 0, 0)

describe("partitionCardDetail", () => {
  it("splits a current year into this grain, finer periods, and open undone", () => {
    const rows = partitionCardDetail(
      [
        task({ id: "year", scheduledYear: "2026" }),
        task({ id: "month", scheduledMonth: "2026-10" }),
        task({ id: "old", schedulePlacements: [{ period: "month", value: "2026-08" }] }),
        task({ id: "pushed", schedulePlacements: [{ period: "month", value: "2026-07", resolved: "pushed" }] }),
        task({ id: "done", completed: true, schedulePlacements: [{ period: "month", value: "2026-08" }] }),
      ],
      "year",
      "2026",
      september,
    )
    expect(rows.past).toBe(false)
    expect(rows.here.map((row) => row.id)).toEqual(["year"])
    expect(rows.finer.map((row) => row.id)).toEqual(["month"])
    expect(rows.undone.map((row) => row.id)).toEqual(["old"])
  })

  it("a past month is only its open undone work", () => {
    const rows = partitionCardDetail(
      [
        task({ id: "aug", schedulePlacements: [{ period: "month", value: "2026-08" }] }),
        task({ id: "day", schedulePlacements: [{ period: "day", value: "2026-08-03" }] }),
        task({ id: "gone", schedulePlacements: [{ period: "month", value: "2026-08", resolved: "discarded" }] }),
      ],
      "month",
      "2026-08",
      september,
    )
    expect(rows.past).toBe(true)
    expect(rows.here).toEqual([])
    expect(rows.finer).toEqual([])
    expect(rows.undone.map((row) => row.id)).toEqual(["aug", "day"])
  })

  it("a past week shows the month tasks sitting in that funnel cell", () => {
    const week = "2026-09-14_2026-09-20"
    const rows = partitionCardDetail(
      [
        task({ id: "month", scheduledMonth: "2026-09" }),
        task({ id: "handled", scheduledMonth: "2026-09", schedulePlacements: [{ period: "week", value: week, resolved: "clarified" }] }),
        task({ id: "done", completed: true, scheduledMonth: "2026-09" }),
      ],
      "week",
      week,
      september,
    )
    expect(rows.past).toBe(true)
    expect(rows.undone.map((row) => row.id)).toEqual(["month"])
  })
})

describe("card working queue", () => {
  it("push marks the period pushed and schedules the next open one", () => {
    const open = task({ id: "m", schedulePlacements: [{ period: "month", value: "2026-08" }] })
    const next = { ...open, ...pushCardWorkingQueue(open, "month", "2026-08", september) }
    expect(next.scheduledMonth).toBe("2026-09")
    expect(next.schedulePlacements).toEqual([{ period: "month", value: "2026-08", resolved: "pushed" }])
  })

  it("dismiss keeps the placement and the live assignment", () => {
    const open = task({ id: "m", scheduledMonth: "2026-08", schedulePlacements: [{ period: "month", value: "2026-08" }] })
    const next = { ...open, ...dismissCardWorkingQueue(open, "month", "2026-08", september) }
    expect(next.status).toBeUndefined()
    expect(next.completed).toBe(false)
    expect(next.scheduledMonth).toBe("2026-08")
    expect(next.schedulePlacements).toEqual([{ period: "month", value: "2026-08", resolved: "clarified" }])
  })

  it("unschedule clears the live period and keeps the undone placement", () => {
    const open = task({ id: "m", scheduledMonth: "2026-08" })
    const next = { ...open, ...unscheduleCardWorkingQueue(open, "month", "2026-08", september) }
    expect(next.scheduledMonth).toBeUndefined()
    expect(next.completed).toBe(false)
    expect(next.schedulePlacements).toEqual([{ period: "month", value: "2026-08", resolved: "clarified" }])
  })

  it("mark done finishes inside the period", () => {
    const open = task({ id: "m", scheduledMonth: "2026-08" })
    const next = { ...open, ...finishCardInPeriod(open, "month", "2026-08") }
    expect(next.completed).toBe(true)
    expect(next.completedDate).toEqual(new Date(2026, 7, 31, 12))
  })

  it("push from a week also settles the month that put it on that week", () => {
    const week = "2026-08-03_2026-08-09"
    const open = task({
      id: "w",
      scheduledYear: "2026",
      schedulePlacements: [{ period: "month", value: "2026-08" }],
    })
    const next = { ...open, ...pushCardWorkingQueue(open, "week", week, september) }
    expect(next.scheduledWeek).toBe("2026-09-21_2026-09-27")
    expect(next.schedulePlacements).toEqual([
      { period: "month", value: "2026-08", resolved: "pushed" },
      { period: "week", value: week, resolved: "pushed" },
    ])
  })

  it("push from an old week lands on the current week", () => {
    const week = "2026-08-03_2026-08-09"
    const open = task({ id: "w", scheduledWeek: week })
    const next = { ...open, ...pushCardWorkingQueue(open, "week", week, september) }
    expect(next.scheduledWeek).toBe("2026-09-21_2026-09-27")
    expect(next.weeksPushed).toBe(1)
    expect(next.schedulePlacements).toEqual([{ period: "week", value: week, resolved: "pushed" }])
  })
})
