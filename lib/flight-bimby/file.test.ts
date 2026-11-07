import { beforeEach, describe, expect, it } from "vitest"
import { useEventStore } from "@/lib/event-store"
import { FLIGHT_ATTR } from "@/lib/flight-types"
import { useTaskStore } from "@/lib/task-store"
import { PASTED } from "./fixture"
import { addFlightFromInfo, buildFlightEvent, createEventFromFlight, flightMinutes } from "./file"
import { extractFlights } from "./extract"

const NOW = new Date("2026-11-07T12:00:00")
const flights = () => useTaskStore.getState().tasks.filter((t) => t.type === "flight")
const events = () => useEventStore.getState().events.filter((e) => e.id.startsWith("flight-event-"))

beforeEach(() => {
  useTaskStore.setState({ tasks: [], lists: [] })
  useEventStore.setState({ events: [] })
})

describe("flight length across zones", () => {
  const [sanJfk, jfkSan] = extractFlights(PASTED, NOW).flights
  it("counts the real time, not the difference of the printed clocks", () => {
    expect(flightMinutes(sanJfk!)).toBe(5 * 60 + 25)
    expect(flightMinutes(jfkSan!)).toBe(6 * 60 + 17)
  })
  it("draws the event on the departure clock for its true length", () => {
    const e = buildFlightEvent(sanJfk!, "t")!
    expect([e.startTime, e.endTime]).toEqual(["11:48", "17:13"])
    expect(e.description).toContain("Lands JFK 8:13 PM local")
    const back = buildFlightEvent(jfkSan!, "t")!
    expect([back.startTime, back.endTime]).toEqual(["17:28", "23:45"])
  })
})

describe("addFlightFromInfo", () => {
  it("files both flights and their events, once", async () => {
    const first = await addFlightFromInfo(PASTED, { now: NOW, live: false })
    expect(first.filed.map((f) => f.status)).toEqual(["created", "created"])
    expect(first.leftover).toMatch(/brow bleach/)
    expect(flights()).toHaveLength(2)
    expect(events()).toHaveLength(2)
    const out = flights().find((t) => t.attributes?.[FLIGHT_ATTR.bookingNumber] === "WTWUQC")!
    expect(out.attributes).toMatchObject({
      [FLIGHT_ATTR.departureAirport]: "SAN", [FLIGHT_ATTR.arrivalAirport]: "JFK",
      [FLIGHT_ATTR.departureTime]: "2026-11-12T11:48", [FLIGHT_ATTR.arrivalTime]: "2026-11-12T20:13", [FLIGHT_ATTR.booked]: true,
    })
    expect(out.body).toContain("flight number")

    const again = await addFlightFromInfo(PASTED, { now: NOW, live: false })
    expect(again.filed.map((f) => f.status)).toEqual(["existing", "existing"])
    expect(flights()).toHaveLength(2)
    expect(events()).toHaveLength(2)
  })
  it("fills a blank on an item that exists and never overwrites", async () => {
    await addFlightFromInfo(PASTED, { now: NOW, live: false })
    const t = flights().find((x) => x.attributes?.[FLIGHT_ATTR.bookingNumber] === "WTWUQC")!
    useTaskStore.getState().updateTask({ ...t, attributes: { ...t.attributes, [FLIGHT_ATTR.airline]: "My own words" } })
    const [draft] = extractFlights(PASTED, NOW).flights
    const more = await addFlightFromInfo({ ...draft!, flightNumber: "B6 0623".replace(" ", "") }, { now: NOW, live: false })
    expect(more.filed[0]!.status).toBe("updated")
    const after = flights().find((x) => x.id === t.id)!
    expect(after.attributes?.[FLIGHT_ATTR.airline]).toBe("My own words")
    expect(after.attributes?.[FLIGHT_ATTR.flightNumber]).toBe("B60623")
  })
  it("makes an event for a Flight item that has none", async () => {
    await addFlightFromInfo(PASTED, { now: NOW, live: false })
    const t = flights()[0]!
    useEventStore.setState({ events: [] })
    expect(createEventFromFlight(t.id)).toMatchObject({ status: "created" })
    expect(events()).toHaveLength(1)
  })
})
