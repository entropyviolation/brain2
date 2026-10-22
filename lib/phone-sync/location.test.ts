import { beforeEach, describe, expect, it } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { resetGpsPlacesForTests, setGpsPlaceName } from "@/lib/ingest/gps-places"
import {
  MOVING_PEN_ID,
  applyLocationBatch,
  locationEventToEntries,
  locationSourceId,
  parseLocationBatch,
  type LocationEvent,
} from "./location"

beforeEach(() => {
  resetAllStores()
  resetGpsPlacesForTests()
})

// Made-up coordinates (a park in Portland, a cafe 2 km away).
const HOME = { lat: 45.5231, lon: -122.6765 }
const CAFE = { lat: 45.5051, lon: -122.675 }
const at = (h: number, m = 0, day = 21) => new Date(2026, 9, day, h, m).getTime()
const targets = { scopeId: "location", penFor: () => "pen" }

const locationRows = () =>
  useTimeTrackingStore.getState().entries.filter((e) => e.scopeId === "location" && e.generatedBy?.kind === "phone-sync")

describe("parseLocationBatch", () => {
  it("reads the phone's wire shape and drops bad events", () => {
    const batch = parseLocationBatch({
      v: 1,
      kind: "location",
      device: "d1",
      events: [
        { type: "point", at: at(9), lat: HOME.lat, lon: HOME.lon, acc: 65 },
        { type: "visit", arriveAt: at(10), departAt: at(11), lat: CAFE.lat, lon: CAFE.lon, acc: -1 },
        { type: "point", at: at(9), lat: 200, lon: 0 },
        { type: "point", lat: 1, lon: 1 },
        { type: "visit", lat: 1, lon: 1 },
        { type: "visit", arriveAt: at(11), departAt: at(10), lat: 1, lon: 1 },
        { type: "point", at: at(9), lat: 0, lon: 0 },
      ],
    })
    expect(batch?.device).toBe("d1")
    expect(batch?.events).toEqual([
      { type: "point", at: at(9), lat: HOME.lat, lon: HOME.lon, accuracyM: 65 },
      { type: "visit", arriveAt: at(10), departAt: at(11), lat: CAFE.lat, lon: CAFE.lon, accuracyM: undefined },
    ])
  })

  it("is null for anything that is not a location batch", () => {
    expect(parseLocationBatch(null)).toBeNull()
    expect(parseLocationBatch({ kind: "health", events: [] })).toBeNull()
    expect(parseLocationBatch({ kind: "location" })).toBeNull()
  })
})

describe("locationEventToEntries", () => {
  it("makes a move an instant", () => {
    const [row] = locationEventToEntries({ type: "point", at: at(9, 14), ...HOME, accuracyM: 412.4 }, targets)
    expect(row).toMatchObject({ kind: "instant", date: "2026-10-21", startMin: 554, endMin: 554, title: "moved ±412 m" })
    expect(row.generatedBy).toEqual({ kind: "phone-sync", id: expect.stringMatching(/^location:pt:/) })
    expect(row.precision).toBeUndefined()
  })

  it("makes a closed visit a block, sliced at midnight", () => {
    const rows = locationEventToEntries({ type: "visit", arriveAt: at(22, 30), departAt: at(7, 15, 22), ...CAFE }, targets)
    expect(rows.map((r) => [r.date, r.startMin, r.endMin])).toEqual([
      ["2026-10-21", 1350, 1440],
      ["2026-10-22", 0, 435],
    ])
    expect(new Set(rows.map((r) => r.spanId)).size).toBe(1)
    expect(new Set(rows.map((r) => r.id)).size).toBe(2)
  })

  it("makes a half-known visit an instant", () => {
    const [arrived] = locationEventToEntries({ type: "visit", arriveAt: at(10), ...CAFE }, targets)
    const [left] = locationEventToEntries({ type: "visit", departAt: at(12), ...CAFE }, targets)
    expect(arrived).toMatchObject({ kind: "instant", title: "arrived", startMin: 600 })
    expect(left).toMatchObject({ kind: "instant", title: "left", startMin: 720 })
  })

  it("gives the arrival and the closed visit different ids", () => {
    const open: LocationEvent = { type: "visit", arriveAt: at(10), ...CAFE }
    const closed: LocationEvent = { type: "visit", arriveAt: at(10), departAt: at(11), ...CAFE }
    expect(locationSourceId(open)).not.toBe(locationSourceId(closed))
  })
})

describe("applyLocationBatch", () => {
  const batch = {
    events: [
      { type: "visit", arriveAt: at(8), departAt: at(9), ...HOME },
      { type: "point", at: at(9, 20), lat: 45.514, lon: -122.68, accuracyM: 500 },
      { type: "visit", arriveAt: at(9, 40), departAt: at(11), ...CAFE },
    ] as LocationEvent[],
  }

  it("writes once and is idempotent", () => {
    const first = applyLocationBatch(batch)
    expect(first).toEqual({ read: 3, written: 3, skipped: 0 })
    const again = applyLocationBatch(batch)
    expect(again).toEqual({ read: 3, written: 0, skipped: 3 })
    expect(locationRows()).toHaveLength(3)
  })

  it("puts an unknown move on the one On the move pen, and visits on coordinate pens", () => {
    applyLocationBatch(batch)
    const pens = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")!.pens
    const rows = locationRows()
    expect(rows.find((r) => r.kind === "instant")?.penId).toBe(MOVING_PEN_ID)
    const visitPens = rows.filter((r) => r.kind !== "instant").map((r) => pens.find((p) => p.id === r.penId)?.name)
    expect(visitPens).toEqual(["45.523,-122.677", "45.505,-122.675"])
  })

  it("reuses a coordinate pen within 150 m instead of making another", () => {
    applyLocationBatch({ events: [{ type: "visit", arriveAt: at(8), departAt: at(9), ...HOME }] })
    applyLocationBatch({ events: [{ type: "visit", arriveAt: at(18), departAt: at(19), lat: HOME.lat + 0.0005, lon: HOME.lon }] })
    const rows = locationRows()
    expect(rows).toHaveLength(2)
    expect(rows[0].penId).toBe(rows[1].penId)
  })

  it("uses a named repeated place", () => {
    setGpsPlaceName(HOME, "Home")
    applyLocationBatch({ events: [{ type: "visit", arriveAt: at(8), departAt: at(9), ...HOME }] })
    const pens = useTimeTrackingStore.getState().scopes.find((s) => s.id === "location")!.pens
    expect(pens.find((p) => p.id === locationRows()[0].penId)?.name).toBe("Home")
  })

  it("does not bring back a row the person deleted", () => {
    applyLocationBatch(batch)
    const victim = locationRows()[0]
    useTimeTrackingStore.getState().removeEntry(victim.id)
    applyLocationBatch(batch)
    expect(locationRows().some((r) => r.id === victim.id)).toBe(false)
  })
})
