/**
 * lib/home-days-until-event.ts — Link a Days Until mark to a Plan all-day event
 *
 * Optional: create or refresh a `CalendarEvent` so the countdown / count-up
 * date also sits on the scheduler banner as an all-day day. Clearing the
 * checkbox does not delete the event — it only stops owning the link.
 * The tile may still keep an optional clock for the live count; the Plan
 * row stays all-day.
 */
import { formatLocalDateKey, parseLocalDate, toLocalCalendarDate } from "@/lib/date-utils"
import type { HomeDaysUntilItem } from "@/lib/home-days-until-store"
import type { CalendarEvent } from "@/lib/types"

/** Same mint as Plan’s default event wash (`PLAN_DEFAULT_EVENT_COLOR`). */
const DAYS_UNTIL_EVENT_COLOR = "#8cd4a5"

export function daysUntilFieldsFromEvent(event: CalendarEvent): Pick<
  HomeDaysUntilItem,
  "label" | "date" | "time" | "eventId" | "scheduleAllDay"
> {
  return {
    label: event.title.replace(/[\r\n\t]/g, " ").replace(/ {2,}/g, " ").slice(0, 40),
    date: formatLocalDateKey(toLocalCalendarDate(event.date)),
    time: event.isAllDay ? "" : event.startTime || "",
    eventId: event.id,
    scheduleAllDay: event.isAllDay === true,
  }
}

/** Create or refresh the linked all-day Plan event. Returns the event id. */
export function syncDaysUntilScheduledEvent(input: {
  item: HomeDaysUntilItem
  events: CalendarEvent[]
  addEvent: (event: CalendarEvent) => void
  updateEvent: (event: CalendarEvent) => void
}): string {
  if (!input.item.scheduleAllDay) return input.item.eventId
  const day = parseLocalDate(input.item.date)
  if (!day) return input.item.eventId

  const title = input.item.label.trim() || "Countdown"
  const date = toLocalCalendarDate(day)
  const existing = input.item.eventId
    ? input.events.find((event) => event.id === input.item.eventId)
    : undefined

  if (existing) {
    input.updateEvent({
      ...existing,
      title,
      date,
      startTime: "00:00",
      endTime: "23:59",
      isAllDay: true,
      isScheduled: true,
      type: "event",
      endDate: undefined,
    })
    return existing.id
  }

  const id = `du-event-${input.item.id}`
  input.addEvent({
    id,
    title,
    date,
    startTime: "00:00",
    endTime: "23:59",
    type: "event",
    color: DAYS_UNTIL_EVENT_COLOR,
    isScheduled: true,
    isAllDay: true,
    location: "",
    description: "",
  })
  return id
}
