import { beforeEach, describe, expect, it } from "vitest"
import { useEventStore } from "@/lib/event-store"
import { FLIGHT_ATTR, FLIGHT_TYPE_ID } from "@/lib/flight-types"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { applyTripPrep, findFlightDay, leadUpDates, parseTripPrep, splitItems } from "./apply-trip-prep"

// Sat Nov 7 2026, local noon.
const NOW = new Date(2026, 10, 7, 12, 0)

function flight(id: string, from: string, to: string, day: string): Task {
  return {
    id,
    description: `${from} → ${to}`,
    title: `${from} → ${to}`,
    type: FLIGHT_TYPE_ID,
    lists: [],
    completed: false,
    createdAt: NOW,
    attributes: {
      [FLIGHT_ATTR.departureAirport]: from,
      [FLIGHT_ATTR.arrivalAirport]: to,
      [FLIGHT_ATTR.departureTime]: `${day}T11:48`,
    },
  } as unknown as Task
}

beforeEach(() => {
  useTaskStore.setState({ tasks: [], lists: [] })
  useEventStore.setState({ events: [] })
  applyTripPrep("skip", NOW)
})

describe("parseTripPrep", () => {
  it("reads the place and one item per line", () => {
    expect(parseTripPrep("have to do before leaving for new york: pack \n talk to shelby \n buy gift")).toEqual({
      place: "New York",
      items: ["Pack", "Talk to shelby", "Buy gift"],
    })
  })
  it("splits one line on commas and peels bullets", () => {
    expect(splitItems("- pack, call mom, book a ride")).toEqual(["Pack", "Call mom", "Book a ride"])
  })
  it("ignores ordinary sentences", () => {
    expect(parseTripPrep("I am leaving for new york")).toBeNull()
    expect(parseTripPrep("log: pack")).toBeNull()
  })
})

describe("leadUpDates", () => {
  it("spreads early items and puts packing in the last days", () => {
    const days = leadUpDates(["Talk to Shelby", "Buy gift", "Call bank", "Pack"], "2026-11-12", NOW)
    expect(days).toEqual(["2026-11-07", "2026-11-08", "2026-11-09", "2026-11-11"])
  })
  it("puts everything today when leaving tomorrow", () => {
    expect(leadUpDates(["a", "Pack"], "2026-11-08", NOW)).toEqual(["2026-11-07", "2026-11-07"])
  })
})

describe("findFlightDay", () => {
  it("takes the next flight into the place, not the one home", () => {
    const tasks = [flight("a", "SAN", "JFK", "2026-11-12"), flight("b", "JFK", "SAN", "2026-11-18"), flight("c", "SAN", "JFK", "2026-10-01")]
    expect(findFlightDay("New York", NOW, tasks)).toBe("2026-11-12")
  })
})

describe("applyTripPrep", () => {
  const say = "have to do before leaving for new york:\npack\ntalk to shelby"

  it("uses the flight date, makes the list, and dates the tasks", () => {
    useTaskStore.setState({ tasks: [flight("f", "SAN", "JFK", "2026-11-12")] })
    const r = applyTripPrep(say, NOW)
    expect(r?.status).toBe("ok")
    const { lists, tasks } = useTaskStore.getState()
    const list = lists.find((l) => l.name === "To do before New York")!
    expect(list).toBeTruthy()
    const mine = tasks.filter((t) => t.lists?.includes(list.id))
    expect(mine.map((t) => t.description).sort()).toEqual(["Pack", "Talk to shelby"])
    expect(mine.find((t) => t.description === "Pack")?.scheduledDate).toEqual(new Date(2026, 10, 11))
    expect(mine.find((t) => t.description === "Talk to shelby")?.scheduledDate).toEqual(new Date(2026, 10, 7))
    expect(useEventStore.getState().events).toHaveLength(0)
  })

  it("falls back to an existing event", () => {
    useEventStore.getState().addEvent({
      id: "e1", title: "Fly to New York", date: new Date(2026, 10, 15), startTime: "00:00", endTime: "23:59",
      type: "event", color: "#000", isScheduled: true, isAllDay: true, location: "", description: "",
    })
    const r = applyTripPrep(say, NOW)
    expect(r?.text).toContain("November 15")
  })

  it("asks for the date, then makes the event and the list", () => {
    const ask = applyTripPrep(say, NOW)
    expect(ask?.status).toBe("needs_clarify")
    expect(useTaskStore.getState().lists).toHaveLength(0)
    const done = applyTripPrep("nov 14", NOW)
    expect(done?.status).toBe("ok")
    expect(useEventStore.getState().events.find((e) => e.title === "Leave for New York")).toBeTruthy()
    expect(useTaskStore.getState().lists[0]?.name).toBe("To do before New York")
  })

  it("asks to merge a lookalike task, and merges on yes", () => {
    useTaskStore.setState({
      tasks: [flight("f", "SAN", "JFK", "2026-11-12"), { id: "old", description: "Pack", type: "task", lists: [], completed: false, createdAt: NOW } as unknown as Task],
    })
    const ask = applyTripPrep(say, NOW)
    expect(ask?.status).toBe("needs_clarify")
    expect(useTaskStore.getState().lists).toHaveLength(0)
    applyTripPrep("yes", NOW)
    const { tasks, lists } = useTaskStore.getState()
    expect(tasks.filter((t) => t.description === "Pack")).toHaveLength(1)
    expect(tasks.find((t) => t.id === "old")?.lists).toContain(lists[0]!.id)
  })

  it("adds a twin on no", () => {
    useTaskStore.setState({
      tasks: [flight("f", "SAN", "JFK", "2026-11-12"), { id: "old", description: "Pack", type: "task", lists: [], completed: false, createdAt: NOW } as unknown as Task],
    })
    applyTripPrep(say, NOW)
    applyTripPrep("no", NOW)
    expect(useTaskStore.getState().tasks.filter((t) => t.description === "Pack")).toHaveLength(2)
  })

  it("running it twice reuses the list and does not twin its own items", () => {
    useTaskStore.setState({ tasks: [flight("f", "SAN", "JFK", "2026-11-12")] })
    applyTripPrep(say, NOW)
    applyTripPrep(say, NOW)
    expect(useTaskStore.getState().lists).toHaveLength(1)
  })
})
