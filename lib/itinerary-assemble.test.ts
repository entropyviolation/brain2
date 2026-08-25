import { describe, it, expect } from "vitest"
import {
  assembleItineraryDays,
  flightDurationLabel,
  formatItineraryDateLabel,
  citiesFromTrip,
} from "./itinerary-assemble"
import type { Task } from "@/lib/types"
import { geocodeApiUrl, parseCoord } from "./geocode"

function task(partial: Partial<Task> & { id: string; description: string }): Task {
  return {
    stage: "list",
    createdAt: new Date(),
    completed: false,
    lists: [],
    attributes: {},
    ...partial,
  } as Task
}

describe("formatItineraryDateLabel", () => {
  it("formats weekday month ordinal", () => {
    expect(formatItineraryDateLabel("2026-01-01")).toBe("THURS JAN 1ST")
    expect(formatItineraryDateLabel("2026-01-02")).toBe("FRI JAN 2ND")
    expect(formatItineraryDateLabel("2026-01-03")).toBe("SAT JAN 3RD")
  })
})

describe("flightDurationLabel", () => {
  it("computes duration between datetimes", () => {
    expect(flightDurationLabel("2026-07-09T21:30", "2026-07-10T09:15")).toBe("11h 45m flight")
  })
})

describe("assembleItineraryDays", () => {
  it("builds day blocks with schedule + sleep", () => {
    const days = [
      task({
        id: "d1",
        description: "Arrive",
        attributes: { day: "2026-07-10", destination: "Lisbon, Portugal", weather: "Clear, 27°C" },
      }),
    ]
    const flights = [
      task({
        id: "f1",
        description: "Outbound",
        attributes: {
          flightNumber: "TP204",
          airline: "TAP",
          departureAirport: "JFK",
          arrivalAirport: "LIS",
          departureTime: "2026-07-10T09:15",
          arrivalTime: "2026-07-10T18:00",
          bookingNumber: "TP-1",
        },
      }),
    ]
    const entries = [
      task({
        id: "s1",
        description: "Hotel Alfama",
        attributes: { akind: "Stay", day: "2026-07-10", location: "Lisbon", address: "Rua 1" },
      }),
      task({
        id: "a1",
        description: "Belém Tower",
        attributes: { akind: "Activity", day: "2026-07-10", time: "14:00", location: "Belém" },
      }),
    ]
    const blocks = assembleItineraryDays({ days, flights, entries })
    expect(blocks).toHaveLength(1)
    expect(blocks[0]!.city).toBe("Lisbon")
    expect(blocks[0]!.weather).toContain("Clear")
    expect(blocks[0]!.sleep?.name).toBe("Hotel Alfama")
    expect(blocks[0]!.sleep?.address).toBe("Rua 1")
    expect(blocks[0]!.schedule.some((s) => s.kind === "flight")).toBe(true)
    expect(blocks[0]!.schedule.some((s) => s.title === "Belém Tower")).toBe(true)
  })
})

describe("citiesFromTrip", () => {
  it("collects unique cities", () => {
    const cities = citiesFromTrip(
      [task({ id: "1", description: "d", attributes: { destination: "Porto, Portugal" } })],
      [task({ id: "2", description: "s", attributes: { akind: "Stay", location: "Lisbon" } })],
    )
    expect(cities).toContain("Porto")
    expect(cities).toContain("Lisbon")
  })
})

describe("geocode helpers", () => {
  it("builds open-meteo url", () => {
    expect(geocodeApiUrl("Belém Tower", "Lisbon")).toContain("geocoding-api.open-meteo.com")
    expect(geocodeApiUrl("Belém Tower", "Lisbon")).toContain("Bel")
  })
  it("parses coords", () => {
    expect(parseCoord("38.7")).toBeCloseTo(38.7)
    expect(parseCoord(null)).toBeNull()
  })
})
