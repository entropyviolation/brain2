import { beforeEach, describe, expect, it } from "vitest"
import { useTaskStore } from "@/lib/task-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { getTodoPrefs, resetTodoPrefsForTests } from "../todo-prefs"
import { createTodoRange, deleteTodoRange, syncRangeDeadlines, tasksInRange, todoTitle, todoViewPhrase, updateTodoRange } from "./todo-ranges"
import { createScheduledTodoTask } from "../todo-utils"

const now = new Date(2026, 9, 20, 10)
const prefs = { titleBase: "To do", titleByView: {} }

describe("todo title", () => {
  it("names the view relative to now", () => {
    expect(todoTitle("day", now, prefs, undefined, now)).toBe("To do today")
    expect(todoViewPhrase("day", new Date(2026, 9, 21), now)).toBe("tomorrow")
    expect(todoViewPhrase("week", now, now)).toBe("this week")
    expect(todoViewPhrase("month", new Date(2026, 10, 3), now)).toBe("next month")
    expect(todoViewPhrase("quarter", now, now)).toBe("this season")
    expect(todoTitle("other", now, prefs, "album release", now)).toBe("To do before album release")
  })
  it("uses a per-view override", () => {
    expect(todoTitle("week", now, { titleBase: "To do", titleByView: { week: "This week's push" } }, undefined, now)).toBe("This week's push")
  })
})


describe("todo ranges", () => {
  beforeEach(() => {
    localStorage.clear()
    resetTodoPrefsForTests()
    useTaskStore.setState({ tasks: [], lists: [], folders: [] })
  })

  it("makes a List, stamps deadlines, and moves them with the end", () => {
    const id = createTodoRange("album release", "2026-11-30")
    expect(useTaskStore.getState().lists.find((l) => l.id === id)?.name).toBe("album release")
    expect(getTodoPrefs().activeRangeId).toBe(id)
    // Added on the Lists side, no deadline yet.
    const task = { ...createScheduledTodoTask({ description: "Mix", period: "day", date: new Date() }), lists: [id] }
    useTaskStore.getState().addTask(task)
    syncRangeDeadlines(useTaskStore.getState().tasks, getTodoPrefs().ranges)
    const due = () => formatLocalDateKey(new Date(tasksInRange(useTaskStore.getState().tasks, id)[0].deadline!))
    expect(due()).toBe("2026-11-30")
    updateTodoRange(id, { end: "2026-12-05", name: "the album" })
    expect(due()).toBe("2026-12-05")
    expect(useTaskStore.getState().lists.find((l) => l.id === id)?.name).toBe("the album")
    deleteTodoRange(id)
    expect(getTodoPrefs().ranges).toEqual([])
    expect(useTaskStore.getState().tasks).toHaveLength(1)
  })
})
