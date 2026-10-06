import { describe, expect, it } from "vitest"
import { buildTodoItems } from "@/components/Home/ToDo/todo-utils"
import { sameCalendarDay } from "@/lib/date-utils"
import { rollUpScheduleFieldsCascaded } from "@/lib/scheduling"
import type { Task } from "@/lib/types"
import {
  PROCESS_INBOX_LIMIT,
  PROCESS_INBOX_TITLE,
  PROCESS_INBOX_TODO_ID,
  processInboxTodoToAdd,
  revisitInboxCount,
} from "./inbox-process-todo"

const now = new Date(2026, 9, 6, 14, 0, 0)

function idea(id: string, extra: Partial<Task> = {}): Task {
  return {
    id,
    description: id,
    stage: "inbox",
    completed: false,
    createdAt: now,
    lists: [],
    ...extra,
  }
}

function pile(count: number, extra: Partial<Task> = {}): Task[] {
  return Array.from({ length: count }, (_, index) => idea(`in-${index}`, extra))
}

describe("process inbox todo", () => {
  it("counts the revisit pile and leaves Monkey brain and done ideas out", () => {
    const tasks = [
      ...pile(3),
      idea("mb", { monkeyBrain: true }),
      idea("done", { completed: true }),
      idea("filed", { stage: "clarified" }),
    ]
    expect(revisitInboxCount(tasks)).toBe(3)
  })

  it("stays quiet at 100 and adds today's auto-push todo at 101", () => {
    expect(processInboxTodoToAdd(pile(PROCESS_INBOX_LIMIT), now)).toBeNull()

    const added = processInboxTodoToAdd(pile(PROCESS_INBOX_LIMIT + 1), now)
    expect(added).toMatchObject({
      id: PROCESS_INBOX_TODO_ID,
      description: PROCESS_INBOX_TITLE,
      title: PROCESS_INBOX_TITLE,
      autoPush: true,
      completed: false,
      stage: "clarified",
      type: "task",
    })
    expect(added?.scheduledDate && sameCalendarDay(added.scheduledDate, now)).toBe(true)
    expect(added?.scheduledWeek).toBeUndefined()

    const rows = buildTodoItems([...pile(PROCESS_INBOX_LIMIT + 1), added!], false, now)
    expect(rows.map((row) => row.description)).toContain(PROCESS_INBOX_TITLE)
  })

  it("does not add a second copy while one is still open", () => {
    const first = processInboxTodoToAdd(pile(PROCESS_INBOX_LIMIT + 1), now)!
    const renamed = { ...first, description: "clear the pile", title: "clear the pile" }
    expect(processInboxTodoToAdd([...pile(200), renamed], now)).toBeNull()
  })

  it("treats a hand-written task with the same name as the cue", () => {
    const handwritten: Task = {
      ...idea("hand", { stage: "clarified", description: "Process Inbox Information" }),
      scheduledDate: now,
    }
    expect(processInboxTodoToAdd([...pile(PROCESS_INBOX_LIMIT + 1), handwritten], now)).toBeNull()
  })

  it("holds off for the rest of the day after it is marked done", () => {
    const done: Task = {
      id: PROCESS_INBOX_TODO_ID,
      description: PROCESS_INBOX_TITLE,
      stage: "completed",
      completed: true,
      completedDate: now,
      createdAt: now,
      lists: [],
      autoPush: true,
      scheduledDate: now,
    }
    expect(processInboxTodoToAdd([...pile(PROCESS_INBOX_LIMIT + 1), done], now)).toBeNull()

    const nextDay = new Date(2026, 9, 7, 9, 0, 0)
    const again = processInboxTodoToAdd([...pile(PROCESS_INBOX_LIMIT + 1), done], nextDay)
    expect(again?.id).toBe(`${PROCESS_INBOX_TODO_ID}:2026-10-07`)
    expect(again?.autoPush).toBe(true)
    expect(again?.scheduledDate && sameCalendarDay(again.scheduledDate, nextDay)).toBe(true)
  })

  it("walks an unfinished copy onto the next day", () => {
    const yesterday = new Date(2026, 9, 5, 18, 0, 0)
    const task = processInboxTodoToAdd(pile(PROCESS_INBOX_LIMIT + 1), yesterday)!
    const patch = rollUpScheduleFieldsCascaded(task, now)
    expect(patch?.scheduledDate && sameCalendarDay(patch.scheduledDate, now)).toBe(true)
    expect(patch?.daysPushed).toBe(1)
    expect(processInboxTodoToAdd([...pile(PROCESS_INBOX_LIMIT + 1), { ...task, ...patch }], now)).toBeNull()
  })

  it("leaves the cue alone once the pile is back to 100", () => {
    const first = processInboxTodoToAdd(pile(PROCESS_INBOX_LIMIT + 1), now)!
    expect(processInboxTodoToAdd([...pile(PROCESS_INBOX_LIMIT), first], now)).toBeNull()
  })
})
