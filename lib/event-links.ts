/**
 * lib/event-links.ts — Event-linked "must-be-done-before" checklists (HM1)
 *
 * Pure helpers that connect a `CalendarEvent` to a checklist of prerequisite
 * tasks (spec §7.5). A prerequisite task links to its event via the existing
 * `checklist-of` relation (see lib/links.ts) and carries a derived
 * `schedulingConstraints.mustBeDoneBefore` date pulled from the event's start.
 *
 * Everything here is pure and unit-tested. The Plan UI (event-dialog /
 * agenda-grid) calls these to attach/detach checklists and to render the
 * "must be done before <date>" badge; persistence goes through
 * `useTaskStore.getState().updateTask`.
 */
import type { CalendarEvent, Task } from "@/lib/types"
import { addLink, removeLinkByTarget } from "@/lib/links"
import { toLocalCalendarDate } from "@/lib/date-utils"

/** Relation a prerequisite task expresses toward its event (task → event). */
export const CHECKLIST_RELATION = "checklist-of"

/** Coerce a possibly-serialized date value into a `Date`. */
function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value)
}

/**
 * The moment a prerequisite must be completed before: the event's start.
 * All-day events resolve to local midnight on the start date; timed events
 * combine the start date with their `startTime` ("HH:mm").
 */
export function eventDeadline(event: CalendarEvent): Date {
  const base = asDate(event.date)
  const y = base.getFullYear()
  const mo = base.getMonth()
  const d = base.getDate()
  if (event.isAllDay) return new Date(y, mo, d)
  const [h, m] = (event.startTime || "00:00").split(":").map(Number)
  return new Date(y, mo, d, h || 0, m || 0)
}

/** Read a task's derived "must be done before" date, if any. */
export function getMustBeDoneBefore(task: Task): Date | undefined {
  const raw = task.schedulingConstraints?.mustBeDoneBefore
  return raw ? asDate(raw) : undefined
}

/**
 * Return a copy of `task` with `schedulingConstraints.mustBeDoneBefore` set,
 * preserving any other existing scheduling constraints.
 */
export function withMustBeDoneBefore(task: Task, before: Date): Task {
  return {
    ...task,
    schedulingConstraints: { ...(task.schedulingConstraints ?? {}), mustBeDoneBefore: before },
  }
}

/** Return a copy of `task` with the `mustBeDoneBefore` constraint removed. */
export function clearMustBeDoneBefore(task: Task): Task {
  const constraints = task.schedulingConstraints
  if (!constraints || constraints.mustBeDoneBefore === undefined) return task
  const { mustBeDoneBefore: _omit, ...rest } = constraints
  return { ...task, schedulingConstraints: rest }
}

/**
 * Attach `task` to `event` as a prerequisite: add the `checklist-of` link and
 * derive the `mustBeDoneBefore` constraint from the event's start. Idempotent —
 * re-attaching does not duplicate the link.
 */
export function attachToEvent(task: Task, event: CalendarEvent): Task {
  const links = addLink(task.links, CHECKLIST_RELATION, event.id, task.id)
  return withMustBeDoneBefore({ ...task, links }, eventDeadline(event))
}

/**
 * Detach `task` from `event`: remove the `checklist-of` link and clear the
 * derived constraint (it only existed because of the event link).
 */
export function detachFromEvent(task: Task, eventId: string): Task {
  const links = removeLinkByTarget(task.links, CHECKLIST_RELATION, eventId)
  return clearMustBeDoneBefore({ ...task, links })
}

/** True when `task` is a checklist prerequisite of `eventId`. */
export function isChecklistTaskFor(task: Task, eventId: string): boolean {
  return (task.links ?? []).some((l) => l.relation === CHECKLIST_RELATION && l.targetId === eventId)
}

/** All tasks linked to `eventId` via the `checklist-of` relation. */
export function getChecklistTasks(tasks: Task[], eventId: string): Task[] {
  return tasks.filter((t) => isChecklistTaskFor(t, eventId))
}

/** Completion rollup for an event's prerequisite checklist. */
export interface EventChecklistSummary {
  eventId: string
  tasks: Task[]
  total: number
  completed: number
  remaining: number
  /** True only when there is at least one item and every item is complete. */
  allComplete: boolean
}

/** List an event's checklist items and their completion. */
export function getEventChecklist(tasks: Task[], eventId: string): EventChecklistSummary {
  const list = getChecklistTasks(tasks, eventId)
  const completed = list.filter((t) => t.completed).length
  return {
    eventId,
    tasks: list,
    total: list.length,
    completed,
    remaining: list.length - completed,
    allComplete: list.length > 0 && completed === list.length,
  }
}

/** True when an event has a distinct end date that differs from its start day. */
export function isMultiDayEvent(event: CalendarEvent): boolean {
  if (!event.endDate) return false
  return toLocalCalendarDate(event.endDate).getTime() !== toLocalCalendarDate(event.date).getTime()
}

/**
 * True when `day` falls within the event's span [date, endDate] inclusive
 * (local calendar days). Drives multi-day / all-day banner rows in the agenda.
 */
export function eventCoversDay(event: CalendarEvent, day: Date): boolean {
  const start = toLocalCalendarDate(event.date)
  const end = event.endDate ? toLocalCalendarDate(event.endDate) : start
  const d = toLocalCalendarDate(day).getTime()
  return d >= start.getTime() && d <= end.getTime()
}

/** All-day and multi-day events that cover `day` — rendered as banner rows. */
export function getBannerEvents(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => (e.isAllDay || isMultiDayEvent(e)) && eventCoversDay(e, day))
}
