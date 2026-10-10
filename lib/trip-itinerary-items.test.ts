import { describe, it, expect } from "vitest"
import type { ModuleInstance } from "@/lib/modules-store"
import { emptyTripItinerary, genTripId, type TripItineraryData } from "@/lib/trip-itinerary"
import { planTripModuleLists } from "@/lib/module-list-import-trip"
import {
  hasTripRecordItems,
  mergeTripScheduleFromItems,
  resolveTripItinerary,
} from "@/lib/trip-itinerary-items"

function sampleTrip(): TripItineraryData {
  const base = emptyTripItinerary("2026-07-10", "2026-07-12")
  return {
    ...base,
    days: base.days.map((d, i) =>
      i === 0
        ? {
            ...d,
            city: "Lima, Peru",
            schedule: [
              { id: genTripId("p"), kind: "plan", time: "09:00", text: "Walk the plaza" },
              { id: genTripId("n"), kind: "note", text: "Bring cash" },
            ],
          }
        : d,
    ),
  }
}

function mod(trip: TripItineraryData): ModuleInstance {
  return {
    id: "mod-trip",
    type: "custom",
    title: "Portugal 2026",
    kind: "workspace",
    config: { tripItinerary: trip },
  }
}

describe("trip-itinerary-items", () => {
  it("overlays schedule rows from Items onto the config day shell", () => {
    const trip = sampleTrip()
    const module = mod(trip)
    const plan = planTripModuleLists(module, trip)
    expect(hasTripRecordItems(module.id, plan.items)).toBe(true)

    const merged = mergeTripScheduleFromItems(module.id, trip, plan.items, plan.lists)
    expect(merged.days[0].city).toBe("Lima, Peru")
    expect(merged.days[0].schedule.some((e) => e.text === "Walk the plaza")).toBe(true)
    expect(merged.days[0].schedule.some((e) => e.text === "Bring cash")).toBe(true)
  })

  it("resolveTripItinerary falls back to config when no Items exist", () => {
    const trip = sampleTrip()
    const module = mod(trip)
    const resolved = resolveTripItinerary(module, [], [])
    expect(resolved.days[0].schedule).toEqual(trip.days[0].schedule)
  })
})
