/**
 * components/Home/Plan/plan-capacity.ts — Planned load vs waking window
 *
 * Pure math for the Plan sidebar capacity line. Sleep evidence is read by the
 * caller via `awakeWindowFor` (`lib/sleep-sync.ts`); this file does not import
 * Tracking stores.
 */
import type { CalendarEvent, Task } from "@/lib/types"
import { formatLocalDateKey, sameCalendarDay } from "@/lib/date-utils"
import { eventCoversDay, isMultiDayEvent } from "@/lib/event-links"
import { formatDuration } from "@/lib/time-entries"
import {
  plannedDurationMinutes,
  todoIdsCoveredByPlacements,
  type PlannedAction,
} from "@/lib/planned-actions"

export function eventDurationMinutes(event: CalendarEvent): number {
  if (event.isAllDay || isMultiDayEvent(event)) return 0
  const [sh, sm] = (event.startTime || "00:00").split(":").map(Number)
  const [eh, em] = (event.endTime || "00:00").split(":").map(Number)
  const span = (eh || 0) * 60 + (em || 0) - ((sh || 0) * 60 + (sm || 0))
  return Math.max(0, span)
}

export function plannedMinutesForDay(
  date: Date,
  tasks: Task[],
  events: CalendarEvent[],
  actions: PlannedAction[] = [],
): number {
  let minutes = 0
  const coveredTodos = todoIdsCoveredByPlacements(actions, date)
  const dayKey = formatLocalDateKey(date)
  for (const task of tasks) {
    if (coveredTodos.has(task.id)) continue
    if (task.scheduledDate && sameCalendarDay(task.scheduledDate, date)) {
      minutes += task.estimatedDuration ?? 0
    }
  }
  for (const event of events) {
    const onDay =
      event.isAllDay || isMultiDayEvent(event) ? eventCoversDay(event, date) : sameCalendarDay(event.date, date)
    if (onDay) minutes += eventDurationMinutes(event)
  }
  for (const action of actions) {
    if (action.date === dayKey) minutes += plannedDurationMinutes(action)
  }
  return minutes
}

export function wakingWindowMinutes(awake: { wake?: number; bed?: number } | undefined): number | null {
  if (!awake) return null
  const { wake, bed } = awake
  if (wake === undefined || bed === undefined) return null
  const span = bed - wake
  if (span <= 0) return null
  return span
}

/** "11h into a 9h window" — planned minutes versus that day's waking hours. */
export function formatCapacityLine(plannedMinutes: number, windowMinutes: number | null): string {
  const planned = formatDuration(Math.max(0, plannedMinutes))
  if (windowMinutes === null) return `${planned} planned · waking window unknown`
  const window = formatDuration(windowMinutes)
  return `${planned} into a ${window} window`
}

export const CAPACITY_PIPS = 10

/** How many of the 10 rail via-dots are lit. Unknown window → none. Overfill stays full (10). */
export function capacityPipCount(plannedMinutes: number, windowMinutes: number | null): number {
  if (windowMinutes === null || windowMinutes <= 0 || plannedMinutes <= 0) return 0
  const pct = (plannedMinutes / windowMinutes) * 100
  if (pct >= 100) return CAPACITY_PIPS
  return Math.round(pct / 10)
}
