import { describe, expect, it } from "vitest"
import type { Task } from "@/lib/types"
import { getWeekString } from "@/lib/date-utils"
import { pushTaskOnePeriod } from "@/lib/item-utils"
import { pushUndoneFields, pushYearUndoneFields, rollUpScheduleFieldsCascaded } from "@/lib/scheduling"
import { carryTodoMarksPatch, taskIsPrioritized, taskIsRequired, withTodoCommitment } from "@/lib/todo-commitment"

function task(partial: Partial<Task> & { id: string }): Task {
  return {
    description: partial.id,
    stage: "scheduled",
    createdAt: new Date("2026-06-01T12:00:00"),
    completed: false,
    lists: [],
    ...partial,
  }
}

const both = { required: true, prioritized: true }

describe("carryTodoMarksPatch", () => {
  it("copies the leaving period's marks onto the destination and keeps the old one", () => {
    const t = withTodoCommitment(task({ id: "a" }), "day", "2026-10-15", both)
    const next = { ...t, ...carryTodoMarksPatch(t, "day", "2026-10-15", "2026-10-16") }
    expect(taskIsRequired(next, "day", "2026-10-16")).toBe(true)
    expect(taskIsPrioritized(next, "day", "2026-10-16")).toBe(true)
    expect(taskIsRequired(next, "day", "2026-10-15")).toBe(true)
  })

  it("is a no-op for an unmarked task", () => {
    expect(carryTodoMarksPatch(task({ id: "a" }), "day", "2026-10-15", "2026-10-16")).toEqual({})
  })

  it("merges with a mark already on the destination", () => {
    let t = withTodoCommitment(task({ id: "a" }), "day", "2026-10-15", { required: true, prioritized: false })
    t = withTodoCommitment(t, "day", "2026-10-16", { required: false, prioritized: true })
    const next = { ...t, ...carryTodoMarksPatch(t, "day", "2026-10-15", "2026-10-16") }
    expect(taskIsRequired(next, "day", "2026-10-16")).toBe(true)
    expect(taskIsPrioritized(next, "day", "2026-10-16")).toBe(true)
  })

  it("turns a ritual priority into a real mark on the new day", () => {
    const t = task({ id: "a" })
    const next = { ...t, ...carryTodoMarksPatch(t, "day", "2026-10-15", "2026-10-16", true) }
    expect(taskIsPrioritized(next, "day", "2026-10-16")).toBe(true)
    expect(taskIsRequired(next, "day", "2026-10-16")).toBe(false)
  })
})

describe("marks follow every push path", () => {
  it("manual Push, day", () => {
    const t = withTodoCommitment(task({ id: "a", scheduledDate: new Date(2026, 9, 15) }), "day", "2026-10-15", both)
    const next = { ...t, ...pushTaskOnePeriod(t, "day") }
    expect(taskIsRequired(next, "day", "2026-10-16")).toBe(true)
    expect(taskIsPrioritized(next, "day", "2026-10-16")).toBe(true)
  })

  it("manual Push, week", () => {
    const week = getWeekString(new Date(2026, 9, 14))
    const nextWeek = getWeekString(new Date(2026, 9, 21))
    const t = withTodoCommitment(task({ id: "a", scheduledWeek: week }), "week", week, both)
    const next = { ...t, ...pushTaskOnePeriod(t, "week") }
    expect(next.scheduledWeek).toBe(nextWeek)
    expect(taskIsRequired(next, "week", nextWeek)).toBe(true)
  })

  it("manual Push, month", () => {
    const t = withTodoCommitment(task({ id: "a", scheduledMonth: "2026-10" }), "month", "2026-10", both)
    const next = { ...t, ...pushTaskOnePeriod(t, "month") }
    expect(taskIsPrioritized(next, "month", "2026-11")).toBe(true)
  })

  it("manual Push carries a ritual priority", () => {
    const t = task({ id: "a", scheduledDate: new Date(2026, 9, 15) })
    const next = { ...t, ...pushTaskOnePeriod(t, "day", new Date(), undefined, true) }
    expect(taskIsPrioritized(next, "day", "2026-10-16")).toBe(true)
  })

  it("Undone Push", () => {
    const t = withTodoCommitment(task({ id: "a", scheduledDate: new Date(2026, 9, 13) }), "day", "2026-10-13", both)
    const now = new Date(2026, 9, 15, 9)
    const next = { ...t, ...pushUndoneFields(t, "day", "2026-10-13", new Date(2026, 9, 13), now) }
    // The next open day is today, not the 14th, which has already ended.
    expect(taskIsRequired(next, "day", "2026-10-15")).toBe(true)
  })

  it("auto-push across several missed days carries hop by hop", () => {
    const t = withTodoCommitment(
      task({ id: "a", scheduledDate: new Date(2026, 9, 12), autoPush: true }),
      "day",
      "2026-10-12",
      both,
    )
    const now = new Date(2026, 9, 15, 9)
    const next = { ...t, ...rollUpScheduleFieldsCascaded(t, now)! }
    expect(taskIsRequired(next, "day", "2026-10-15")).toBe(true)
    expect(taskIsPrioritized(next, "day", "2026-10-15")).toBe(true)
  })

  it("year Undone Push", () => {
    const t = withTodoCommitment(task({ id: "a", scheduledYear: "2025" }), "year", "2025", both)
    const next = { ...t, ...pushYearUndoneFields(t, "2025") }
    expect(taskIsRequired(next, "year", "2026")).toBe(true)
  })
})
