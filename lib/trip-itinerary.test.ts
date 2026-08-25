import { describe, it, expect } from "vitest"
import {
  dateRangeInclusive,
  rebuildDaysForRange,
  cityLabel,
  citiesFromTripItinerary,
  emptyTripItinerary,
  formatFlightEntry,
  weatherCityQuery,
  applyGlobalCity,
  itineraryShowsSleep,
  itineraryAccentColor,
  DEFAULT_ITINERARY_ACCENT,
} from "./trip-itinerary"
import { formatItineraryDateLabel, flightDurationLabel } from "./itinerary-assemble"
import { geocodeApiUrl, parseCoord } from "./geocode"

describe("dateRangeInclusive", () => {
  it("includes start and end", () => {
    expect(dateRangeInclusive("2026-07-10", "2026-07-12")).toEqual([
      "2026-07-10",
      "2026-07-11",
      "2026-07-12",
    ])
  })
  it("returns empty when inverted", () => {
    expect(dateRangeInclusive("2026-07-12", "2026-07-10")).toEqual([])
  })
})

describe("rebuildDaysForRange", () => {
  it("preserves existing day data", () => {
    const prev = [
      {
        date: "2026-07-10",
        cityMode: "city" as const,
        city: "Lisbon",
        schedule: [{ id: "1", kind: "plan" as const, time: "14:00", text: "Walk" }],
      },
    ]
    const days = rebuildDaysForRange("2026-07-10", "2026-07-11", prev)
    expect(days).toHaveLength(2)
    expect(days[0]!.city).toBe("Lisbon")
    expect(days[0]!.schedule).toHaveLength(1)
    expect(days[1]!.city).toBe("")
  })
})

describe("cityLabel / weatherCityQuery", () => {
  it("formats travel days", () => {
    const day = {
      date: "2026-01-01",
      cityMode: "travel" as const,
      city: "",
      fromCity: "San Diego",
      toCity: "Lima, Peru",
      schedule: [],
    }
    expect(cityLabel(day)).toBe("San Diego → Lima, Peru")
    expect(weatherCityQuery(day)).toBe("Lima, Peru")
  })
})

describe("citiesFromTripItinerary", () => {
  it("collects unique cities", () => {
    const data = emptyTripItinerary("2026-07-10", "2026-07-11")
    data.days[0]!.city = "Lisbon, Portugal"
    data.days[1]!.cityMode = "travel"
    data.days[1]!.fromCity = "Lisbon"
    data.days[1]!.toCity = "Porto"
    const cities = citiesFromTripItinerary(data)
    expect(cities).toContain("Lisbon")
    expect(cities).toContain("Porto")
  })
})

describe("formatFlightEntry", () => {
  it("builds compact title and detail", () => {
    const f = formatFlightEntry({
      flightNumber: "TP204",
      airline: "TAP",
      fromAirport: "JFK",
      toAirport: "LIS",
      departureTime: "2026-07-10T21:30",
      arrivalTime: "2026-07-11T09:15",
      confirmation: "ABC",
    })
    expect(f.text).toMatch(/TP204/)
    expect(f.text).toMatch(/JFK-LIS/)
    expect(f.detail).toMatch(/Conf ABC/)
    expect(f.time).toBe("21:30")
  })
})

describe("formatFlightLegLine / layover", () => {
  it("formats jetstar-style chunks", async () => {
    const { formatFlightLegLine, formatLayoverLine, expandFlightScheduleChunks } = await import(
      "./trip-itinerary"
    )
    expect(
      formatFlightLegLine({
        airline: "Jetstar",
        flightNumber: "JQ945",
        fromAirport: "CNS",
        toAirport: "MEL",
        durationLabel: "3h 20m",
      }),
    ).toBe("Jetstar JQ945 CNS-MEL 3h20m")
    expect(
      formatLayoverLine({ place: "Melbourne", durationLabel: "2h", confirmation: "ABC123" }),
    ).toBe("Arrive in Melbourne, ~2h layover · Conf ABC123")

    const chunks = expandFlightScheduleChunks({
      id: "f1",
      kind: "flight",
      text: "multi",
      flight: {
        flightNumber: "Y4183 / Y43918",
        airline: "Volaris México",
        confirmation: "OBGTNV",
        segments: [
          {
            flightNumber: "Y4183",
            airline: "Volaris México",
            from: "Tijuana",
            to: "Mexico City",
            departTime: "16:27",
            arriveTime: "20:50",
          },
          {
            flightNumber: "Y43918",
            airline: "Volaris México",
            from: "Mexico City",
            to: "Lima, Peru",
            departTime: "22:00",
            arriveTime: "05:01",
          },
        ],
      },
    })
    expect(chunks).toHaveLength(3)
    expect(chunks[0]!.kind).toBe("flight-leg")
    expect(chunks[0]!.text).toMatch(/Y4183/)
    expect(chunks[0]!.time).toBe("16:27")
    expect(chunks[1]!.kind).toBe("layover")
    expect(chunks[1]!.text).toMatch(/Arrive in Mexico City/)
    expect(chunks[1]!.text).toMatch(/OBGTNV/)
    expect(chunks[2]!.text).toMatch(/Y43918/)
  })
})

describe("formatItineraryDateLabel", () => {
  it("formats weekday month ordinal", () => {
    expect(formatItineraryDateLabel("2026-01-01")).toBe("THURS JAN 1ST")
  })
})

describe("flightDurationLabel", () => {
  it("computes duration", () => {
    expect(flightDurationLabel("2026-07-09T21:30", "2026-07-10T09:15")).toBe("11h 45m flight")
  })
})

describe("geocode helpers", () => {
  it("builds open-meteo url", () => {
    expect(geocodeApiUrl("Belém Tower", "Lisbon")).toContain("geocoding-api.open-meteo.com")
  })
  it("parses coords", () => {
    expect(parseCoord("38.7")).toBeCloseTo(38.7)
  })
})

describe("global city + sleep", () => {
  it("applies one city to all days", () => {
    const data = emptyTripItinerary("2026-07-10", "2026-07-12")
    data.days[1]!.cityMode = "travel"
    data.days[1]!.fromCity = "A"
    data.days[1]!.toCity = "B"
    const next = applyGlobalCity(data, "Lima, Peru")
    expect(next.globalCity).toBe("Lima, Peru")
    expect(next.days.every((d) => d.city === "Lima, Peru" && d.cityMode === "city")).toBe(true)
    expect(next.days[1]!.fromCity).toBeUndefined()
  })

  it("seeds new days from globalCity and defaults showSleep", () => {
    const data = emptyTripItinerary("2026-07-10", "2026-07-11", {
      globalCity: "Quito",
      showSleep: false,
    })
    expect(data.days[0]!.city).toBe("Quito")
    expect(itineraryShowsSleep(data)).toBe(false)
    expect(itineraryShowsSleep(emptyTripItinerary("2026-07-10", "2026-07-10"))).toBe(true)
  })

  it("resolves accent color with default crimson", () => {
    expect(itineraryAccentColor(null)).toBe(DEFAULT_ITINERARY_ACCENT)
    expect(itineraryAccentColor({ ...emptyTripItinerary("2026-07-10", "2026-07-10"), accentColor: "#2563eb" })).toBe(
      "#2563eb",
    )
    expect(itineraryAccentColor({ ...emptyTripItinerary("2026-07-10", "2026-07-10"), accentColor: "nope" })).toBe(
      DEFAULT_ITINERARY_ACCENT,
    )
  })
})
