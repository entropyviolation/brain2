import { describe, it, expect } from "vitest"
import {
  FLIGHT_ATTR,
  FLIGHT_TYPE_ID,
  getFlightTypeDefinition,
  withFlightType,
} from "@/lib/flight-types"
import type { ItemTypeDefinition } from "@/lib/types"

describe("Flight type definition", () => {
  it("is a built-in, scheduleable type (maps onto the timeline)", () => {
    const def = getFlightTypeDefinition()
    expect(def.id).toBe(FLIGHT_TYPE_ID)
    expect(def.builtin).toBe(true)
    expect(def.capabilities?.scheduleable).toBe(true)
  })

  it("carries airline, flight number, airports, datetimes, layovers, booking, cost, booked", () => {
    const def = getFlightTypeDefinition()
    const byId = new Map((def.attributes ?? []).map((a) => [a.id, a]))

    expect(byId.get(FLIGHT_ATTR.flightNumber)?.type).toBe("string")
    expect(byId.get(FLIGHT_ATTR.airline)?.type).toBe("string")
    expect(byId.get(FLIGHT_ATTR.departureAirport)?.type).toBe("string")
    expect(byId.get(FLIGHT_ATTR.arrivalAirport)?.type).toBe("string")
    expect(byId.get(FLIGHT_ATTR.departureTime)?.type).toBe("datetime")
    expect(byId.get(FLIGHT_ATTR.departureTime)?.datetimeMode).toBe("datetime")
    expect(byId.get(FLIGHT_ATTR.arrivalTime)?.type).toBe("datetime")
    expect(byId.get(FLIGHT_ATTR.layovers)?.type).toBe("multistring")
    expect(byId.get(FLIGHT_ATTR.bookingNumber)?.type).toBe("string")
    expect(byId.get(FLIGHT_ATTR.cost)?.type).toBe("number")
    expect(byId.get(FLIGHT_ATTR.booked)?.type).toBe("boolean")
  })

  it("defaults 'booked' to false", () => {
    const def = getFlightTypeDefinition()
    expect(def.defaultAttributeValues?.[FLIGHT_ATTR.booked]).toBe(false)
  })
})

describe("withFlightType (registration helper)", () => {
  const existing: ItemTypeDefinition[] = [{ id: "task", name: "Task", builtin: true }]

  it("appends the Flight type, preserving existing types", () => {
    const next = withFlightType(existing)
    expect(next.map((t) => t.id)).toEqual(["task", FLIGHT_TYPE_ID])
    expect(next).not.toBe(existing)
  })

  it("is idempotent (same reference when already registered)", () => {
    const once = withFlightType(existing)
    expect(withFlightType(once)).toBe(once)
    expect(once.filter((t) => t.id === FLIGHT_TYPE_ID)).toHaveLength(1)
  })
})
