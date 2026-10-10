import { describe, expect, it, vi } from "vitest"
import {
  daysUntilFieldsFromEvent,
  syncDaysUntilScheduledEvent,
} from "@/lib/home-days-until-event"
import type { HomeDaysUntilItem } from "@/lib/home-days-until-store"
import type { CalendarEvent } from "@/lib/types"

const baseItem: HomeDaysUntilItem = {
  id: "du-1",
  label: "Tour",
  date: "2026-10-19",
  time: "",
  format: "unit",
  mode: "countdown",
  eventId: "",
  scheduleAllDay: true,
}

describe("home-days-until-event", () => {
  it("reads label and date from an all-day Plan event", () => {
    const event: CalendarEvent = {
      id: "e1",
      title: "elijah leaves for tour",
      date: new Date(2026, 9, 19),
      startTime: "00:00",
      endTime: "23:59",
      type: "event",
      isScheduled: true,
      isAllDay: true,
    }
    expect(daysUntilFieldsFromEvent(event)).toEqual({
      label: "elijah leaves for tour",
      date: "2026-10-19",
      time: "",
      eventId: "e1",
      scheduleAllDay: true,
    })
  })

  it("creates an all-day Plan event when scheduling is on", () => {
    const addEvent = vi.fn()
    const updateEvent = vi.fn()
    const eventId = syncDaysUntilScheduledEvent({
      item: baseItem,
      events: [],
      addEvent,
      updateEvent,
    })
    expect(eventId).toBe("du-event-du-1")
    expect(addEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "du-event-du-1",
        title: "Tour",
        isAllDay: true,
        startTime: "00:00",
        endTime: "23:59",
        isScheduled: true,
      }),
    )
    expect(updateEvent).not.toHaveBeenCalled()
  })

  it("refreshes an existing linked event instead of creating another", () => {
    const existing: CalendarEvent = {
      id: "keep-me",
      title: "Old",
      date: new Date(2026, 0, 1),
      startTime: "00:00",
      endTime: "23:59",
      type: "event",
      isScheduled: true,
      isAllDay: true,
    }
    const addEvent = vi.fn()
    const updateEvent = vi.fn()
    const eventId = syncDaysUntilScheduledEvent({
      item: { ...baseItem, eventId: "keep-me", label: "New title" },
      events: [existing],
      addEvent,
      updateEvent,
    })
    expect(eventId).toBe("keep-me")
    expect(addEvent).not.toHaveBeenCalled()
    expect(updateEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "keep-me", title: "New title", isAllDay: true }),
    )
  })
})
