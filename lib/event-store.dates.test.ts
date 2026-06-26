import { describe, it, expect, beforeEach } from "vitest"
import { resetAllStores } from "@/tests/test-utils"
import { useEventStore } from "@/lib/event-store"
import type { CalendarEvent } from "@/lib/types"

const event = (overrides: Partial<CalendarEvent>): CalendarEvent => ({
  id: "e1",
  title: "Event",
  startTime: "09:00",
  endTime: "10:00",
  date: new Date("2026-06-01T08:30:00.000Z"),
  type: "event",
  isScheduled: true,
  ...overrides,
})

describe("event-store date rehydration", () => {
  beforeEach(() => resetAllStores())

  it("rehydrates persisted date fields as Date instances (not ISO strings)", async () => {
    // Seed an event with real Date instances; persist writes it to localStorage.
    useEventStore.getState().setEvents([
      event({
        id: "a",
        date: new Date("2026-06-01T08:30:00.000Z"),
        endDate: new Date("2026-06-02T09:45:00.000Z"),
      }),
    ])

    // Simulate a reload: re-read from localStorage through the persist reviver.
    await useEventStore.persist.rehydrate()

    const restored = useEventStore.getState().events.find((e) => e.id === "a")
    expect(restored).toBeDefined()
    expect(restored!.date).toBeInstanceOf(Date)
    expect(restored!.endDate).toBeInstanceOf(Date)
    // Values must survive the round-trip unchanged.
    expect(restored!.date.toISOString()).toBe("2026-06-01T08:30:00.000Z")
    expect((restored!.endDate as Date).toISOString()).toBe("2026-06-02T09:45:00.000Z")
  })

  it("leaves non-date string fields (e.g. startTime/endTime) as strings", async () => {
    useEventStore.getState().setEvents([
      event({ id: "b", startTime: "14:30", endTime: "15:45" }),
    ])

    await useEventStore.persist.rehydrate()

    const restored = useEventStore.getState().events.find((e) => e.id === "b")
    expect(restored!.startTime).toBe("14:30")
    expect(restored!.endTime).toBe("15:45")
  })
})
