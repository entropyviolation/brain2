/**
 * lib/ingest/apply-todos.test.ts
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { useTaskStore } from "@/lib/task-store"
import { applyDoNext, applyReadTodoToday, applyTodoToday } from "./apply-todos"

const NOW = new Date(2026, 8, 21, 18, 48, 0)

beforeEach(() => {
  resetAllStores()
})

describe("applyDoNext", () => {
  it("rejects empty", () => {
    const result = applyDoNext("", NOW)
    expect(result.status).toBe("error")
    expect(result.kind).toBe("do")
    if (result.status === "error") expect(result.reply).toBe("Send do: call dentist")
  })

  it("lands on General inside Next Actions and is not scheduled today", () => {
    const result = applyDoNext("call dentist", NOW)
    expect(result.status).toBe("ok")
    expect(result.kind).toBe("do")
    if (result.status === "ok") {
      expect(result.reply).toContain("Next actions · General: call dentist")
    }

    const { tasks, lists, folders } = useTaskStore.getState()
    expect(tasks).toHaveLength(1)
    const task = tasks[0]!
    expect(task.scheduledDate).toBeUndefined()
    expect(taskScheduledOnDay(task, NOW)).toBe(false)

    const general = lists.find((l) => l.name === "General")
    expect(general).toBeTruthy()
    expect(task.lists).toContain(general!.id)

    const naFolder = folders.find((f) => f.name === "Next Actions")
    expect(naFolder).toBeTruthy()
    expect(naFolder!.listIds).toContain(general!.id)
  })
})

describe("applyTodoToday", () => {
  it("schedules onto today's to-do", () => {
    const result = applyTodoToday("ship ingest", NOW)
    expect(result.status).toBe("ok")
    expect(result.kind).toBe("todo-today")
    if (result.status === "ok") {
      expect(result.reply).toContain("To do today: ship ingest")
    }

    const task = useTaskStore.getState().tasks[0]!
    expect(taskScheduledOnDay(task, NOW)).toBe(true)
  })
})

describe("applyReadTodoToday", () => {
  it("lists open tasks scheduled today", () => {
    applyTodoToday("ship ingest", NOW)
    const result = applyReadTodoToday(NOW)
    expect(result.status).toBe("ok")
    expect(result.kind).toBe("read-todo-today")
    if (result.status === "ok") {
      expect(result.reply).toContain("To do today ·")
      expect(result.reply).toContain("1. ship ingest")
    }
  })

  it("says when empty", () => {
    const result = applyReadTodoToday(NOW)
    expect(result.status).toBe("ok")
    if (result.status === "ok") {
      expect(result.reply).toBe("Nothing on to do today.")
    }
  })
})
