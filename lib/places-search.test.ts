import { describe, it, expect } from "vitest"
import { formatDistance, formatDuration, googleMapsDirectionsUrl } from "./trip-directions"
import { formatCityLabel } from "./city-search"

describe("trip directions helpers", () => {
  it("formats distance and duration", () => {
    expect(formatDistance(450)).toBe("450 m")
    expect(formatDistance(2500)).toMatch(/2\.5 km/)
    expect(formatDuration(90)).toBe("2 min")
    expect(formatDuration(3750)).toBe("1h 3m")
  })

  it("builds Google Maps directions URLs", () => {
    const url = googleMapsDirectionsUrl(
      { lat: -12.02, lng: -77.11 },
      { lat: -12.05, lng: -77.03 },
      "transit",
    )
    expect(url).toContain("google.com/maps/dir")
    expect(url).toContain("travelmode=transit")
    expect(url).toContain("-12.02")
  })
})

describe("places search (live)", () => {
  it("finds lima airport via photon", async () => {
    const { searchPlaces, findCityAirport, fetchCityRegion } = await import("./places-search")
    const hits = await searchPlaces("lima airport", { limit: 5 })
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((h) => /airport|aeropuerto|ch[aá]vez/i.test(h.name + h.label))).toBe(true)

    const region = await fetchCityRegion("Lima, Peru")
    expect(region).toBeTruthy()
    expect(region!.bounds[0][0]).toBeLessThan(region!.bounds[1][0])

    const airport = await findCityAirport("Lima, Peru", region!.lat, region!.lng)
    expect(airport).toBeTruthy()
    expect(airport!.kind === "aerodrome" || /airport|aeropuerto/i.test(airport!.name)).toBe(true)
  }, 30000)
})

describe("city label still works", () => {
  it("formats lima", () => {
    expect(formatCityLabel({ name: "Lima", country: "Peru", feature_code: "PPLC" })).toBe("Lima, Peru")
  })
})
