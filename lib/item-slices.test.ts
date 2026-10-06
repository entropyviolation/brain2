import { describe, expect, it } from "vitest"
import { formatDateKey, formatLocalDateKey } from "@/lib/date-utils"
import {
  homeDayTodoTasks,
  openTodosOnDay,
  operationTasks,
  revisitInboxTasks,
  taskOnPlanCalendarDay,
  tasksForDayLog,
  tasksForGemDay,
  tasksForPlanCalendar,
  tasksScheduledOnCalendarDay,
  tasksScheduledOnDays,
  tasksTimedOnDays,
  tasksWithTimeLogOnDays,
} from "@/lib/item-slices"
import type { Task } from "@/lib/types"

const DAY = new Date(2026, 5, 23)
const OTHER = new Date(2026, 5, 24)

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "t1",
    description: overrides.description ?? "Task",
    stage: "clarified",
    createdAt: DAY,
    completed: false,
    lists: [],
    ...overrides,
  }
}

describe("item slices", () => {
  it("keeps tasks scheduled on the calendar day", () => {
    const onDay = task({ id: "on", scheduledDate: DAY })
    const elsewhere = task({ id: "off", scheduledDate: OTHER })
    const undated = task({ id: "none" })
    const inboxParsed = task({ id: "inbox", stage: "inbox", scheduledDate: DAY, lists: ["reminders"] })
    expect(tasksScheduledOnCalendarDay([undated, onDay, elsewhere, inboxParsed], DAY).map((row) => row.id)).toEqual([
      "on",
    ])
  })

  it("reuses the day slice when an unrelated task object is replaced", () => {
    const onDay = task({ id: "on", scheduledDate: DAY })
    const noise = task({ id: "noise" })
    const first = tasksScheduledOnCalendarDay([onDay, noise], DAY)
    const again = tasksScheduledOnCalendarDay([onDay, { ...noise, description: "edited" }], DAY)
    expect(again).toBe(first)
    expect(again).toEqual([onDay])
  })

  it("returns a new day slice when a scheduled task object changes", () => {
    const onDay = task({ id: "on", scheduledDate: DAY })
    const first = tasksScheduledOnCalendarDay([onDay], DAY)
    const edited = { ...onDay, description: "moved" }
    const again = tasksScheduledOnCalendarDay([edited], DAY)
    expect(again).not.toBe(first)
    expect(again).toEqual([edited])
  })

  it("keeps timed tasks that land on the given days", () => {
    const timed = task({ id: "timed", scheduledDate: DAY, scheduledTime: "09:00" })
    const untimed = task({ id: "untimed", scheduledDate: DAY })
    const other = task({ id: "other", scheduledDate: OTHER, scheduledTime: "11:00" })
    const inboxTimed = task({
      id: "inbox-timed",
      stage: "inbox",
      scheduledDate: DAY,
      scheduledTime: "10:00",
    })
    expect(tasksTimedOnDays([timed, untimed, other, inboxTimed], [DAY]).map((row) => row.id)).toEqual(["timed"])
  })

  it("places a month chip only when the item is scheduled that day or finished on a past day", () => {
    const now = new Date(2026, 9, 6, 12)
    const past = new Date(2026, 9, 4)
    const future = new Date(2026, 9, 11)
    const scheduled = task({ id: "plan", stage: "clarified", scheduledDate: DAY })
    const donePast = task({
      id: "done",
      stage: "completed",
      completed: true,
      completedDate: past,
    })
    const reminder = task({
      id: "reminder",
      stage: "clarified",
      description: "write it down",
      lists: ["reminders"],
    })
    const inboxPlain = task({ id: "inbox", stage: "inbox", description: "loose capture" })
    const inboxParsed = task({
      id: "inbox-date",
      stage: "inbox",
      description: "Mercury on the 11th",
      lists: ["reminders"],
      scheduledDate: future,
    })
    const inboxDone = task({
      id: "inbox-done",
      stage: "inbox",
      completed: true,
      completedDate: past,
      scheduledDate: future,
    })
    const futureOpen = task({ id: "later", stage: "clarified", description: "someday" })
    const rows = [scheduled, donePast, reminder, inboxPlain, inboxParsed, inboxDone, futureOpen]

    expect(taskOnPlanCalendarDay(scheduled, DAY, now)).toBe(true)
    expect(taskOnPlanCalendarDay(donePast, past, now)).toBe(true)
    expect(taskOnPlanCalendarDay(inboxDone, past, now)).toBe(true)
    expect(taskOnPlanCalendarDay(reminder, DAY, now)).toBe(false)
    expect(taskOnPlanCalendarDay(inboxPlain, DAY, now)).toBe(false)
    expect(taskOnPlanCalendarDay(inboxParsed, future, now)).toBe(false)
    expect(taskOnPlanCalendarDay(inboxParsed, DAY, now)).toBe(false)
    expect(taskOnPlanCalendarDay(futureOpen, future, now)).toBe(false)
    expect(taskOnPlanCalendarDay(donePast, future, now)).toBe(false)

    expect(tasksForPlanCalendar(rows, [past, DAY, future], now).map((row) => row.id)).toEqual([
      "plan",
      "done",
      "inbox-done",
    ])
  })

  it("keeps every scheduled task on the month grid days", () => {
    const timed = task({ id: "timed", scheduledDate: DAY, scheduledTime: "09:00" })
    const untimed = task({ id: "untimed", scheduledDate: OTHER })
    const outside = task({ id: "out", scheduledDate: new Date(2026, 7, 1) })
    expect(tasksScheduledOnDays([timed, untimed, outside], [DAY, OTHER]).map((row) => row.id)).toEqual([
      "timed",
      "untimed",
    ])
  })

  it("keeps a gem-day completion that was not scheduled that day", () => {
    const completed = task({ id: "done", completed: true, completedDate: DAY, scheduledDate: OTHER })
    const scheduled = task({ id: "plan", scheduledDate: DAY })
    const neither = task({ id: "else", scheduledDate: OTHER })
    expect(tasksForGemDay([completed, scheduled, neither], DAY).map((row) => row.id)).toEqual(["done", "plan"])
  })

  it("matches the home day to-do filter, including a deadline and a finished row", () => {
    const scheduled = task({ id: "sched", scheduledDate: DAY, completed: true })
    const due = task({ id: "due", deadline: DAY })
    const hidden = task({ id: "hide", scheduledDate: DAY, hiddenFromTodo: true })
    const later = task({ id: "later", scheduledDate: OTHER })
    expect(homeDayTodoTasks([scheduled, due, hidden, later], DAY).map((row) => row.id)).toEqual(["sched", "due"])
  })

  it("drops finished rows from the next-tile to-dos", () => {
    const open = task({ id: "open", scheduledDate: DAY })
    const done = task({ id: "done", scheduledDate: DAY, completed: true })
    expect(openTodosOnDay([open, done], DAY).map((row) => row.id)).toEqual(["open"])
  })

  it("returns the revisit inbox newest first, without monkey brain", () => {
    const older = task({ id: "old", stage: "inbox", createdAt: new Date(2026, 5, 1) })
    const newer = task({ id: "new", stage: "inbox", createdAt: new Date(2026, 5, 20) })
    const monkey = task({ id: "mb", stage: "inbox", monkeyBrain: true, createdAt: new Date(2026, 5, 21) })
    const filed = task({ id: "filed", stage: "clarified" })
    expect(revisitInboxTasks([older, monkey, filed, newer]).map((row) => row.id)).toEqual(["new", "old"])
  })

  it("keeps operation items only", () => {
    const op = task({ id: "op", type: "operation" })
    const plain = task({ id: "plain", type: "task" })
    expect(operationTasks([plain, op]).map((row) => row.id)).toEqual(["op"])
  })

  it("keeps items whose time log falls on a requested key", () => {
    const logged = task({ id: "logged", timeLogs: [{ id: "l", date: "2026-06-23", durationMinutes: 10 }] })
    const other = task({ id: "other", timeLogs: [{ id: "l2", date: "2026-06-01", durationMinutes: 5 }] })
    const bare = task({ id: "bare" })
    expect(tasksWithTimeLogOnDays([logged, other, bare], ["2026-06-23"]).map((row) => row.id)).toEqual(["logged"])
  })

  it("keeps an open scheduled item or a time log for the day log", () => {
    const planned = task({ id: "plan", scheduledDate: DAY })
    const done = task({ id: "done", scheduledDate: DAY, completed: true })
    const logged = task({
      id: "log",
      timeLogs: [{ id: "l", date: formatDateKey(DAY), durationMinutes: 15 }],
    })
    const idle = task({ id: "idle", scheduledDate: OTHER })
    expect(tasksForDayLog([planned, done, logged, idle], [DAY]).map((row) => row.id)).toEqual(["plan", "log"])
  })

  it("includes a local-key time log on the day log", () => {
    const logged = task({
      id: "local",
      timeLogs: [{ id: "l", date: formatLocalDateKey(DAY), durationMinutes: 20 }],
    })
    expect(tasksForDayLog([logged], [DAY]).map((row) => row.id)).toEqual(["local"])
  })
})
