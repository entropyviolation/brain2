/**
 * lib/ingest/line-reply.test.ts — the Line Reply BIMBY
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTaskStore } from "@/lib/task-store"
import { applyTodoToday } from "./apply-todos"
import { readResolution, replyToLine, todoNamesIn } from "./line-reply"

const NOW = new Date(2026, 10, 24, 9, 34, 0)
const LATER = new Date(2026, 10, 24, 10, 5, 0)

beforeEach(() => {
  resetAllStores()
})

const task = () => useTaskStore.getState().tasks.find((t) => t.description === "find another usb-c to usb-c" || (t as { title?: string }).title === "find another usb-c to usb-c") ?? useTaskStore.getState().tasks[0]!

describe("readResolution", () => {
  it("reads done, dropped and unsure", () => {
    expect(readResolution("found one, headphones charging now")).toBe("done")
    expect(readResolution("never mind, don't need it")).toBe("dropped")
    expect(readResolution("couldn't find one yet")).toBeNull()
    expect(readResolution("headphones charging now")).toBeNull()
  })
})

describe("todoNamesIn", () => {
  it("reads the to-do BIM said back", () => {
    expect(todoNamesIn("To do today: find another usb-c to usb-c")).toEqual(["find another usb-c to usb-c"])
  })
})

describe("replyToLine", () => {
  it("ticks off the to-do your quoted line made and notes the reply", async () => {
    applyTodoToday("find another usb-c to usb-c", NOW)
    const out = await replyToLine("found one, headphones charging now", { id: "a", who: "you", text: "need to find another usb-c to usb-c", pair: "To do today: find another usb-c to usb-c" }, LATER)
    expect(out?.route).toBe("REPLY · to-do done · code")
    expect(out?.text).toContain("Done: find another usb-c to usb-c")
    const t = task()
    expect(t.completed).toBe(true)
    expect(t.noteLog?.[0]?.text).toBe("found one, headphones charging now")
  })

  it("works from BIM's line too, and without the pair", async () => {
    applyTodoToday("find another usb-c to usb-c", NOW)
    const out = await replyToLine("got one", { id: "b", who: "bim", text: "To do today: find another usb-c to usb-c" }, LATER)
    expect(out?.taskId).toBe(task().id)
    expect(task().completed).toBe(true)
  })

  it("takes a dropped to-do off To Do without deleting it", async () => {
    applyTodoToday("find another usb-c to usb-c", NOW)
    const out = await replyToLine("never mind, don't need it", { id: "a", who: "you", text: "need to find another usb-c to usb-c" }, LATER)
    expect(out?.route).toContain("dropped")
    expect(task().hiddenFromTodo).toBe(true)
    expect(task().completed).toBeFalsy()
  })

  it("asks the gate when code is unsure, and leaves it when nothing is said", async () => {
    applyTodoToday("find another usb-c to usb-c", NOW)
    const ref = { id: "a", who: "you" as const, text: "need to find another usb-c to usb-c" }
    expect(await replyToLine("headphones charging now", ref, LATER)).toBeNull()
    const out = await replyToLine("headphones charging now", ref, LATER, async () => "done")
    expect(out?.route).toBe("REPLY · to-do done · model")
  })

  it("passes when the quoted line made no to-do", async () => {
    expect(await replyToLine("found one", { id: "c", who: "bim", text: "How are you feeling right now?" }, LATER)).toBeNull()
  })
})
