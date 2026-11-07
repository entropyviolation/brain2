import { beforeEach, describe, expect, it } from "vitest"
import { useEventStore } from "@/lib/event-store"
import { useTaskStore } from "@/lib/task-store"
import { answerFlightQuestion, isFlightQuestion } from "./ask"
import { PASTED } from "./fixture"
import { addFlightFromInfo } from "./file"

const NOW = new Date("2026-11-07T12:03:00")
const ask = (q: string) => answerFlightQuestion(q, NOW, useTaskStore.getState().tasks)

beforeEach(async () => {
  useTaskStore.setState({ tasks: [], lists: [] })
  useEventStore.setState({ events: [] })
  await addFlightFromInfo(PASTED, { now: NOW, live: false })
})

describe("answerFlightQuestion", () => {
  it("answers when you fly to New York from the Flight items", () => {
    const a = ask("when am I flying to new york?")!
    expect(a).toContain("Thursday, November 12 at 11:48 AM (in 5 days)")
    expect(a).toContain("JetBlue SAN → JFK")
    expect(a).not.toContain("AS25")
  })
  it("finds the way back by city, code, or 'back'", () => {
    for (const q of ["when do I fly back to san diego?", "when is my flight to SAN", "when am I flying back?"]) {
      expect(ask(q)).toContain("Wednesday, November 18 at 5:28 PM")
    }
  })
  it("lists both when asked generally, and leaves other questions alone", () => {
    expect(ask("what flights do I have?")!.match(/•/g)).toHaveLength(2)
    expect(ask("when is my flight to tokyo?")).toBeNull()
    expect(isFlightQuestion("how many days ago did elijah leave for tour?")).toBe(false)
    expect(ask("when do I eat?")).toBeNull()
  })
})
