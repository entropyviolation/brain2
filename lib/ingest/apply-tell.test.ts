import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useEventStore } from "@/lib/event-store"
import { useHomeDaysUntilStore } from "@/lib/home-days-until-store"
import { taskScheduledOnDay } from "@/lib/date-utils"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { openTellQuestion, sendToBim } from "./bim-chat"

const NOW = new Date(2026, 9, 30, 12, 0)

function task(over: Partial<Task> & { id: string; title: string }): Task {
  return {
    description: over.title,
    type: "task",
    stage: "clarified",
    createdAt: new Date(2026, 9, 1),
    completed: false,
    lists: [],
    ...over,
  } as Task
}

const tasks = () => useTaskStore.getState().tasks
const byId = (id: string) => tasks().find((t) => t.id === id)!

describe("BIM Chat: told facts, questions, commands", () => {
  beforeEach(async () => {
    resetAllStores()
    useEventStore.setState({ events: [] })
    useHomeDaysUntilStore.setState({ items: [] })
    useTaskStore.setState({
      tasks: [
        task({ id: "p-shelby", title: "Shelby", type: "person" }),
        task({ id: "p-eli1", title: "Elijah Moss", type: "person", personProfile: { nicknames: ["Elijah"] } }),
        task({ id: "p-eli2", title: "Elijah Park", type: "person", personProfile: { nicknames: ["Elijah"] } }),
        task({ id: "t-fox", title: "Foxtide CDs", urgency: 2, importance: 3 }),
      ],
    } as never)
    await sendToBim("nothing", NOW) // settle any pending question from a prior test
  })

  it("files 'the last time I saw Shelby' as Last seen", async () => {
    const line = await sendToBim("The last time I saw Shelby was July 5th", NOW)
    expect(line.kind).toBe("tell")
    expect(line.text).toContain("Shelby: last seen July 5")
    const row = byId("p-shelby").personProfile?.interactions?.[0]
    expect(row).toMatchObject({ date: "2026-07-05", saw: true })
  })

  it("answers a last-seen question, and asks when it does not know", async () => {
    const asked = await sendToBim("when was the last time i saw shelby?", NOW)
    expect(asked.status).toBe("needs_clarify")
    expect(asked.text).toBe("I don't have any info on that. When do you remember last seeing Shelby?")
    expect(openTellQuestion()).not.toBeNull()
    const filled = await sendToBim("it was july 5th I think", NOW)
    expect(filled.text).toContain("last seen July 5")
    expect(byId("p-shelby").personProfile?.interactions?.[0]?.date).toBe("2026-07-05")
    expect(openTellQuestion()).toBeNull()
    const again = await sendToBim("when did I last see shelby", NOW)
    expect(again.text).toContain("You last saw Shelby on July 5")
  })

  it("an unrelated line after a question drops the question and runs normally", async () => {
    await sendToBim("when was the last time i saw shelby?", NOW)
    const line = await sendToBim("inbox: buy stamps", NOW)
    expect(line.kind).not.toBe("tell")
    expect(openTellQuestion()).toBeNull()
  })

  it("an unknown person falls through to the log, not swallowed", async () => {
    const line = await sendToBim("I saw a movie yesterday", NOW)
    expect(line.kind).not.toBe("tell")
  })

  it("asks which when two people share a name", async () => {
    const asked = await sendToBim("I saw Elijah yesterday", NOW)
    expect(asked.status).toBe("needs_clarify")
    expect(asked.text).toContain("1. Elijah Moss")
    const done = await sendToBim("2", NOW)
    expect(done.text).toContain("Elijah Park: last seen October 29")
    expect(byId("p-eli2").personProfile?.interactions?.[0]?.date).toBe("2026-10-29")
    expect(byId("p-eli1").personProfile?.interactions).toBeUndefined()
  })

  it("an overdue task goes to the top of today, with a note", async () => {
    const line = await sendToBim("The Foxtide CDs are extremely overdue and need to be done immediately", NOW)
    expect(line.text).toContain("Foxtide CDs: top priority")
    const fox = byId("t-fox")
    expect(fox.urgency).toBe(5)
    expect(fox.importance).toBe(5)
    expect(taskScheduledOnDay(fox, NOW)).toBe(true)
    expect(fox.noteLog?.at(-1)?.text).toContain("Extremely overdue")
  })

  it("an overdue thing with no task becomes a top to do today", async () => {
    await sendToBim("taxes are extremely overdue", NOW)
    const made = tasks().find((t) => /taxes/i.test(t.description))!
    expect(made.urgency).toBe(5)
    expect(taskScheduledOnDay(made, NOW)).toBe(true)
  })

  it("'Elijah comes home on nov 18th' plans an event, then a countdown command uses it", async () => {
    const planned = await sendToBim("Elijah comes home on nov 18th", NOW)
    expect(planned.text).toContain("Planned: Elijah comes home, November 18")
    expect(useEventStore.getState().events.map((e) => e.title)).toContain("Elijah comes home")
    const made = await sendToBim("create a countdown widget to when elijah comes home", NOW)
    expect(made.text).toContain("Countdown widget made: Elijah comes home, 19 days")
    const marks = useHomeDaysUntilStore.getState().items
    expect(marks).toHaveLength(1)
    expect(marks[0]).toMatchObject({ label: "Elijah comes home", date: "2026-11-18", mode: "countdown" })
  })

  it("a countdown with no known date asks, then files the date AND makes the countdown", async () => {
    const asked = await sendToBim("create a countdown widget to when elijah comes home", NOW)
    expect(asked.text).toBe("I don't seem to have any future dates associated with elijah comes home, do you have any more information for me?")
    const done = await sendToBim("he lands on nov 18th", NOW)
    expect(done.text).toContain("Countdown widget made: Elijah comes home, 19 days")
    expect(done.text).toContain("Added it to Plan")
    expect(useEventStore.getState().events.map((e) => e.title)).toContain("Elijah comes home")
    expect(useHomeDaysUntilStore.getState().items[0]?.eventId).toBeTruthy()
  })

  it("saying 'skip' to a question drops it", async () => {
    await sendToBim("when was the last time i saw shelby?", NOW)
    const line = await sendToBim("I don't remember", NOW)
    expect(line.text).toBe("I'll leave it blank.")
    expect(byId("p-shelby").personProfile?.interactions).toBeUndefined()
  })
})
