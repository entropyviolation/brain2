/**
 * lib/ingest/gps-places.test.ts
 */
import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { formatLocalDateKey } from "@/lib/date-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { applyGps, adoptGpsPlaceName } from "./apply-gps"
import {
  GPS_CLUSTER_RADIUS_M,
  clusterGpsSamples,
  lookupGpsPlaceName,
  recordGpsSample,
  repeatedGpsPlaces,
  resetGpsPlacesForTests,
  setGpsPlaceName,
} from "./gps-places"

const NOW = new Date(2026, 8, 21, 18, 48, 0)

beforeEach(() => {
  resetAllStores()
  resetGpsPlacesForTests()
})

describe("gps place clusters", () => {
  it("groups fixes inside 80 meters and leaves a distant pin alone", () => {
    expect(GPS_CLUSTER_RADIUS_M).toBe(80)
    const samples = [
      { lat: 37.77, lon: -122.42, at: 1 },
      { lat: 37.77025, lon: -122.42, at: 2 },
      { lat: 37.79, lon: -122.42, at: 3 },
    ]
    const clusters = clusterGpsSamples(samples)
    expect(clusters).toHaveLength(2)
    expect(clusters[0]?.count).toBe(2)
    expect(clusters[1]?.count).toBe(1)
  })

  it("hides a place until it has been seen more than once", () => {
    recordGpsSample(37.77, -122.42, 1)
    expect(repeatedGpsPlaces()).toEqual([])
    recordGpsSample(37.7701, -122.4201, 2)
    expect(repeatedGpsPlaces()).toHaveLength(1)
    expect(repeatedGpsPlaces()[0]?.name).toBe("")
  })

  it("looks up a name inside the cluster and not past it", () => {
    recordGpsSample(37.77, -122.42, 1)
    recordGpsSample(37.7701, -122.42, 2)
    const place = repeatedGpsPlaces()[0]!
    setGpsPlaceName(place, "Kitchen")
    expect(lookupGpsPlaceName(37.7702, -122.4201)).toBe("Kitchen")
    expect(lookupGpsPlaceName(37.772, -122.42)).toBeNull()
    expect(repeatedGpsPlaces()[0]?.name).toBe("Kitchen")
  })

  it("paints a later pin with the named place", () => {
    applyGps("37.77,-122.42", NOW)
    applyGps("37.7701,-122.4201", new Date(2026, 8, 21, 19, 5, 0))
    const place = repeatedGpsPlaces()[0]!
    setGpsPlaceName(place, "Kitchen")
    adoptGpsPlaceName("Kitchen", place)

    const later = applyGps("Cafe\n37.77005,-122.42005", new Date(2026, 8, 21, 19, 20, 0))
    expect(later.status === "ok" || later.status === "ignored").toBe(true)
    const text = later.status === "ok" ? later.reply : later.status === "ignored" ? later.summary : ""
    expect(text).toMatch(/Kitchen/)
    const scope = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")
    expect(scope?.pens.some((pen) => pen.name === "Kitchen")).toBe(true)
    expect(scope?.pens.some((pen) => pen.name === "Cafe")).toBe(false)
    const date = formatLocalDateKey(NOW)
    const entries = useTimeTrackingStore.getState().entriesFor(date, "location")
    const kitchen = scope?.pens.find((pen) => pen.name === "Kitchen")
    expect(entries.some((entry) => entry.penId === kitchen?.id)).toBe(true)
  })
})
