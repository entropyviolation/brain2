/**
 * lib/event-store.ts — Calendar events store
 *
 * Zustand store for calendar `CalendarEvent`s shown in the Plan/Scheduler views.
 * CRUD + bulk `setEvents`, persisted to localStorage under `cogs-event-storage`
 * with Date-aware serialization. Seeded with two demo events on first run.
 *
 * Spec: §7.5 (Events). The spec's "event with a linked checklist" (via the
 * generic links field) is not modeled here yet — see docs/SPEC_MAPPING.md §7.
 * Storage: localStorage today; target MongoDB `events` collection (§3).
 */
"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { CalendarEvent } from "./types"
import { toLocalCalendarDate } from "./date-utils"

interface EventState {
  events: CalendarEvent[]
  addEvent: (event: CalendarEvent) => void
  updateEvent: (event: CalendarEvent) => void
  deleteEvent: (id: string) => void
  setEvents: (events: CalendarEvent[]) => void
}

export const useEventStore = create<EventState>()(
  persist(
    (set, get) => ({
      events: [
        {
          id: "1",
          title: "Product Strategy Hike",
          startTime: "02:00",
          endTime: "10:20",
          date: new Date(),
          type: "event",
          color: "#6366f1",
          isScheduled: true,
          isAllDay: false,
          location: "",
          description: "",
        },
        {
          id: "2",
          title: "Kayaking Workshop",
          startTime: "01:00",
          endTime: "03:00",
          date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          type: "event",
          color: "#8b5cf6",
          isScheduled: true,
          isAllDay: false,
          location: "",
          description: "",
        },
      ],

      addEvent: (event) =>
        set((state) => {
          if (!state.events.some((e) => e.id === event.id)) {
            const eventWithDates = {
              ...event,
              date: toLocalCalendarDate(event.date),
              endDate: event.endDate ? toLocalCalendarDate(event.endDate) : undefined,
            }
            return { events: [...state.events, eventWithDates] }
          }
          return state
        }),

      updateEvent: (updatedEvent) =>
        set((state) => {
          const index = state.events.findIndex((e) => e.id === updatedEvent.id)
          if (index !== -1) {
            const eventWithDates = {
              ...updatedEvent,
              date: toLocalCalendarDate(updatedEvent.date),
              endDate: updatedEvent.endDate ? toLocalCalendarDate(updatedEvent.endDate) : undefined,
            }
            const newEvents = [...state.events]
            newEvents[index] = eventWithDates
            return { events: newEvents }
          }
          return state
        }),

      deleteEvent: (id) =>
        set((state) => ({
          events: state.events.filter((event) => event.id !== id),
        })),

      setEvents: (events) => set(() => ({ events })),
    }),
    {
      name: "cogs-event-storage",
      storage: createJSONStorage(() => localStorage, {
        replacer: (_key, value) => {
          if (value instanceof Date) {
            return { __type: "Date", value: value.toISOString() }
          }
          return value
        },
        reviver: (_key, value) => {
          if (value && typeof value === "object" && (value as { __type?: string }).__type === "Date") {
            return new Date((value as { value: string }).value)
          }
          return value
        },
      }),
      version: 1,
    },
  ),
)
