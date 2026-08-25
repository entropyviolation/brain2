import { describe, it, expect } from "vitest"
import { fetchWeatherForCityDate, geocodeCity } from "./weather-client"
import { lookupFlight, normalizeFlightNumber, parseAirlineCode, buildFlightDetail } from "./flight-lookup"
import { geocodeApiUrl, parseCoord } from "./geocode"

describe("flight normalize", () => {
  it("normalizes spaces and dashes", () => {
    expect(normalizeFlightNumber("tp 204")).toBe("TP204")
    expect(normalizeFlightNumber("UA-961")).toBe("UA961")
  })
  it("parses airline codes", () => {
    expect(parseAirlineCode("TP204")).toEqual({ airlineCode: "TP", number: "204" })
    expect(parseAirlineCode("B61523")).toEqual({ airlineCode: "B6", number: "1523" })
  })
})

describe("lookupFlight", () => {
  it("returns a structured estimate without API key", async () => {
    const r = await lookupFlight("TP204", "2026-07-20")
    expect(r.flightNumber).toBe("TP204")
    expect(r.airline).toContain("TAP")
    expect(r.fromAirport).toBeTruthy()
    expect(r.toAirport).toBeTruthy()
    expect(r.departureTime).toContain("2026-07-20")
    expect(r.source).toBe("estimate")
    expect(r.title).toContain("TP204")
    expect(r.detail).toMatch(/flight/)
    expect(r.detail).toMatch(/land /i)
  })

  it("adapts airports from city context", async () => {
    const r = await lookupFlight("UA100", "2026-07-20", {
      fromCity: "San Diego",
      toCity: "Lima, Peru",
    })
    expect(r.fromAirport).toBe("SAN")
    expect(r.toAirport).toBe("LIM")
    expect(r.title).toContain("SAN–LIM")
    expect(r.detail).toContain("LIM")
  })
})

describe("flight display helpers", () => {
  it("builds land-in detail", () => {
    expect(
      buildFlightDetail({
        durationLabel: "11h 5m flight",
        arrivalTime: "2026-07-21T15:00:00",
        toAirport: "MEL",
      }),
    ).toBe("11h 5m flight · land 3:00 PM in MEL")
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

describe("weather client (live)", () => {
  it("geocodes a known city", async () => {
    const g = await geocodeCity("Lisbon")
    expect(g).toBeTruthy()
    expect(g!.lat).toBeGreaterThan(38)
    expect(g!.lng).toBeLessThan(-8)
  }, 20000)

  it("fetches weather for a near-term date", async () => {
    const d = new Date()
    d.setDate(d.getDate() + 2)
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, "0")
    const day = String(d.getDate()).padStart(2, "0")
    const date = `${y}-${m}-${day}`
    const label = await fetchWeatherForCityDate("Lisbon", date)
    expect(label).toBeTruthy()
    expect(label!).toMatch(/°F/)
  }, 20000)

  it("falls back to typical weather for far-future dates", async () => {
    const label = await fetchWeatherForCityDate("Lima, Peru", "2026-12-15")
    expect(label).toBeTruthy()
    expect(label!).toMatch(/°F/)
    expect(label!).toMatch(/Typically/i)
  }, 30000)
})
