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

// Date-typed fields on persisted CalendarEvent objects. The persist reviver
// only resurrects Dates for these keys so it never converts unrelated strings
// (e.g. `startTime`/`endTime`, which are "HH:mm" time-of-day strings).
const DATE_KEYS = new Set(["date", "endDate"])

// Matches ISO-8601 strings produced by `Date.prototype.toISOString()`
// (e.g. "2026-06-23T08:33:00.000Z"), including timezone offset variants.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

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
        // NOTE: `JSON.stringify` invokes `Date.prototype.toJSON()` (→ ISO string)
        // BEFORE this replacer runs, so the `value instanceof Date` branch never
        // fires — Dates are already plain ISO strings here. The real rehydration
        // happens in the reviver below. We keep this branch only as defensive
        // back-compat in case a raw (non-toJSON'd) Date ever reaches the replacer.
        replacer: (_key, value) => {
          if (value instanceof Date) {
            return { __type: "Date", value: value.toISOString() }
          }
          return value
        },
        // `JSON.parse`'s reviver visits every key. We restore Date instances for
        // the known Date-typed fields whose values are ISO-8601 strings (what
        // `toJSON` produced). Restricting to DATE_KEYS avoids clobbering genuine
        // string fields like `startTime`/`endTime` ("14:30"). The tagged-envelope
        // branch handles any legacy data that somehow persisted via the replacer
        // above (prevents double-conversion).
        reviver: (key, value) => {
          if (value && typeof value === "object" && (value as { __type?: string }).__type === "Date") {
            return new Date((value as { value: string }).value)
          }
          if (typeof value === "string" && DATE_KEYS.has(key) && ISO_DATE_RE.test(value)) {
            return new Date(value)
          }
          return value
        },
      }),
      version: 1,
    },
  ),
)
