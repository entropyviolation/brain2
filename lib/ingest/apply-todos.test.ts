/**
 * lib/ingest/apply-todos.test.ts
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { useTaskStore } from "@/lib/task-store"
import { isEstimated } from "@/lib/estimated-values"
import { deliverIngestReply } from "./deliver-reply"
import { useIngestStore } from "./ingest-store"
import { applyDoNext, applyReadTodoToday, applyTodoPinReply, applyTodoToday } from "./apply-todos"

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
      expect(result.pinText).toBe(result.reply)
      expect(result.pinKind).toBe("todo")
    }
  })

  it("pins the to-do card once", async () => {
    applyTodoToday("ship ingest", NOW)
    const dumped = applyReadTodoToday(NOW)
    expect(dumped.status).toBe("ok")
    if (dumped.status !== "ok") return
    expect(dumped.pinText).toBe(dumped.reply)
    expect(dumped.pinKind).toBe("todo")
    const sent: string[] = []
    await deliverIngestReply("5", dumped, {
      send: async (_chatId, text) => {
        sent.push(text)
        return { messageId: 77 }
      },
      pin: async () => {},
    })
    expect(sent).toEqual([dumped.reply])
    expect(useIngestStore.getState().livePins.todo?.messageId).toBe(77)
    expect(useIngestStore.getState().livePins.grocery).toBeUndefined()
  })
})

describe("applyTodoPinReply", () => {
  function titles() {
    return useTaskStore.getState().tasks.map((task) => task.description)
  }

  it("adds a line that is not a number", () => {
    applyTodoToday("ship ingest", NOW)
    const result = applyTodoPinReply("file taxes", NOW)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") return
    expect(result.reply).toMatch(/file taxes/)
    expect(result.reply).not.toMatch(/1\. ship ingest/)
    expect(result.pinText).toMatch(/1\. ship ingest/)
    expect(result.pinText).toMatch(/2\. file taxes/)
    expect(result.pinText).not.toBe(result.reply)
    expect(titles()).toContain("file taxes")
  })

  it("marks line 2 done at the current time", () => {
    applyTodoToday("alpha\nbeta\ngamma", NOW)
    const result = applyTodoPinReply("2", NOW)
    expect(result.reply).toMatch(/Done 2\. beta/)
    const beta = useTaskStore.getState().tasks.find((task) => task.description === "beta")
    expect(beta?.completed).toBe(true)
    expect(beta?.completedDate?.getTime()).toBe(NOW.getTime())
    const reviewed = beta?.completionReview?.completedAt
    const reviewedAt = reviewed instanceof Date ? reviewed : reviewed ? new Date(reviewed) : null
    expect(reviewedAt?.getTime()).toBe(NOW.getTime())
    expect(isEstimated(beta?.estimates, "completedDate")).toBe(false)
    expect(useTaskStore.getState().tasks.find((task) => task.description === "alpha")?.completed).toBeFalsy()
  })

  it("marks 1 at 3 pm and 5 at 4pm, and still adds a mixed line", () => {
    applyTodoToday("one\ntwo\nthree\nfour\nfive", NOW)
    const result = applyTodoPinReply("1. 3 pm\n5. 4pm\nbuy stamps", NOW)
    expect(result.reply).toMatch(/Done 1\. one/)
    expect(result.reply).toMatch(/Done 5\. five/)
    expect(result.reply).toMatch(/buy stamps/)
    const one = useTaskStore.getState().tasks.find((task) => task.description === "one")
    const five = useTaskStore.getState().tasks.find((task) => task.description === "five")
    expect(one?.completedDate?.getHours()).toBe(15)
    expect(one?.completedDate?.getMinutes()).toBe(0)
    expect(one?.completedDate?.getDate()).toBe(NOW.getDate())
    expect(five?.completedDate?.getHours()).toBe(16)
    expect(five?.completedDate?.getMinutes()).toBe(0)
    expect(useTaskStore.getState().tasks.find((task) => task.description === "buy stamps")).toBeTruthy()
  })

  it("stores -est and -e as an estimated finish and shows a tilde on the pin", () => {
    applyTodoToday("one\ntwo\nthree\nfour\nfive", NOW)
    const result = applyTodoPinReply("1. 3 pm -est\n5. 4pm -e", NOW)
    const one = useTaskStore.getState().tasks.find((task) => task.description === "one")
    const five = useTaskStore.getState().tasks.find((task) => task.description === "five")
    expect(isEstimated(one?.estimates, "completedDate")).toBe(true)
    expect(one?.estimates?.find((row) => row.field === "completedDate")?.kind).toBe("logged")
    expect(isEstimated(five?.estimates, "completedDate")).toBe(true)
    expect(one?.completedDate?.getHours()).toBe(15)
    expect(five?.completedDate?.getHours()).toBe(16)
    expect(result.pinText).toMatch(/~3:00 PM/)
    expect(result.pinText).toMatch(/~4:00 PM/)
    expect(result.reply).toMatch(/~3:00 PM/)
    expect(result.reply).toMatch(/~4:00 PM/)
  })

  it("names a missing number and still applies the valid line", () => {
    applyTodoToday("ship ingest", NOW)
    const result = applyTodoPinReply("9\nfile taxes", NOW)
    expect(result.reply).toMatch(/No line 9/)
    expect(result.reply).toMatch(/file taxes/)
    expect(titles()).toContain("file taxes")
    expect(useTaskStore.getState().tasks.find((task) => task.description === "ship ingest")?.completed).toBeFalsy()
  })
})
