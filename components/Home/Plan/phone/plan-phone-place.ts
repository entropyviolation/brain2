/**
 * components/Home/Plan/plan-phone-place.ts — Touch stand-in for Plan drag
 *
 * Same store writes as the desktop drops. Month with no hour sets the date
 * only. Week uses the week grid’s duration. Day uses `countingMinutes` and
 * returns the placement so the phone can open the planned-action dialog.
 * A free block is the drag-across-empty-time path (Session lives on that dialog).
 */
"use client"

import { getTodoPrefs } from "@/components/Home/ToDo/todo-prefs"
import { formatLocalDateKey, formatLocalMonthKey, getWeekString, toLocalCalendarDate } from "@/lib/date-utils"
import { habitScheduleMinutes } from "@/lib/habit-time-estimate"
import { useHabitsStore } from "@/lib/habits-store"
import { itemTitle } from "@/lib/item-utils"
import {
  movePlacement,
  placementFromDragRange,
  placementFromDrop,
  type PlannedAction,
} from "@/lib/planned-actions"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { useEventStore } from "@/lib/event-store"
import { useTaskStore } from "@/lib/task-store"
import { countingMinutes, DEFAULT_ESTIMATE_MIN } from "@/lib/todo-steps"
import type { CalendarEvent } from "@/lib/types"

export type PlaceMode = "day" | "week" | "month"

function pad(n: number): string {
  return n.toString().padStart(2, "0")
}

function eventDurationMinutes(event: CalendarEvent): number {
  const [sh, sm] = event.startTime.split(":").map(Number)
  const [eh, em] = event.endTime.split(":").map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

export function placeRailItem(input: {
  kind: "task" | "habit"
  id: string
  date: Date
  hour: number | null
  mode: PlaceMode
}): PlannedAction | null {
  const dayKey = formatLocalDateKey(input.date)
  const upsert = usePlannedActionStore.getState().upsertSourcePlacement

  if (input.kind === "habit") {
    const habit = useHabitsStore.getState().tasks.find((row) => row.id === input.id)
    const durationMinutes = habitScheduleMinutes(habit)
    if (durationMinutes == null) return null
    const hour = input.hour ?? 9
    return upsert(
      placementFromDrop({
        date: dayKey,
        hour,
        minute: 0,
        durationMinutes,
        source: "habit",
        sourceId: input.id,
        title: habit?.name ?? "Habit",
      }),
    )
  }

  const task = useTaskStore.getState().tasks.find((row) => row.id === input.id)
  if (!task) return null

  if (input.hour == null) {
    useTaskStore.getState().updateTask({ ...task, scheduledDate: toLocalCalendarDate(input.date) })
    return null
  }

  const hour = input.hour
  const minute = 0
  const scheduledDate = new Date(input.date.getFullYear(), input.date.getMonth(), input.date.getDate(), hour, minute)
  useTaskStore.getState().updateTask({
    ...task,
    scheduledDate,
    scheduledTime: `${pad(hour)}:${pad(minute)}`,
    scheduledWeek: undefined,
    scheduledMonth: undefined,
    scheduledYear: undefined,
  })

  const durationMinutes =
    input.mode === "week"
      ? (task.estimatedDuration ?? 30)
      : countingMinutes(task, getTodoPrefs().defaultEstimateMin || DEFAULT_ESTIMATE_MIN)

  return upsert(
    placementFromDrop({
      date: dayKey,
      hour,
      minute,
      durationMinutes,
      source: "todo",
      sourceId: task.id,
      title: itemTitle(task),
    }),
  )
}

export function createFreeBlock(date: Date, hour: number): PlannedAction {
  return usePlannedActionStore.getState().upsertSourcePlacement(
    placementFromDragRange({
      date: formatLocalDateKey(date),
      startMinutes: hour * 60,
      endMinutes: hour * 60 + 60,
    }),
  )
}

export function moveEventTime(eventId: string, date: Date, hour: number, minute = 0): void {
  const event = useEventStore.getState().events.find((row) => row.id === eventId)
  if (!event || event.isAllDay) return
  const durationMin = eventDurationMinutes(event)
  const endTotal = hour * 60 + minute + durationMin
  const endH = Math.floor(endTotal / 60)
  const endM = endTotal % 60
  useEventStore.getState().updateEvent({
    ...event,
    date: toLocalCalendarDate(date),
    startTime: `${pad(hour)}:${pad(minute)}`,
    endTime: `${pad(endH)}:${pad(endM)}`,
  })
}

export function movePlanTime(actionId: string, date: Date, hour: number, minute = 0): PlannedAction | null {
  const action = usePlannedActionStore.getState().actions.find((row) => row.id === actionId)
  if (!action) return null
  const next = { ...movePlacement(action, hour, minute), date: formatLocalDateKey(date) }
  usePlannedActionStore.getState().updateAction(next)
  if (action.source === "todo" && action.sourceId) {
    const task = useTaskStore.getState().tasks.find((row) => row.id === action.sourceId)
    if (task) {
      useTaskStore.getState().updateTask({
        ...task,
        scheduledDate: new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute),
        scheduledTime: next.startTime,
        scheduledWeek: undefined,
        scheduledMonth: undefined,
        scheduledYear: undefined,
      })
    }
  }
  return next
}

export function moveTaskTime(taskId: string, date: Date, hour: number, minute = 0): PlannedAction | null {
  return placeRailItem({ kind: "task", id: taskId, date, hour, mode: "day" })
}

export function moveItemToDay(
  kind: "event" | "task" | "plan",
  id: string,
  date: Date,
): void {
  if (kind === "event") {
    const event = useEventStore.getState().events.find((row) => row.id === id)
    if (!event) return
    useEventStore.getState().updateEvent({ ...event, date: toLocalCalendarDate(date) })
    return
  }
  if (kind === "plan") {
    const action = usePlannedActionStore.getState().actions.find((row) => row.id === id)
    if (!action) return
    const [h, m] = action.startTime.split(":").map(Number)
    movePlanTime(id, date, h || 0, m || 0)
    return
  }
  const task = useTaskStore.getState().tasks.find((row) => row.id === id)
  if (!task) return
  if (task.scheduledTime) {
    const [h, m] = task.scheduledTime.split(":").map(Number)
    moveTaskTime(id, date, h || 0, m || 0)
    return
  }
  useTaskStore.getState().updateTask({ ...task, scheduledDate: toLocalCalendarDate(date) })
}

export function unscheduleTask(taskId: string, date: Date, mode: PlaceMode): void {
  const task = useTaskStore.getState().tasks.find((row) => row.id === taskId)
  if (!task) return
  if (mode === "day") {
    useTaskStore.getState().updateTask({ ...task, scheduledTime: undefined })
    usePlannedActionStore.getState().deleteForSource(formatLocalDateKey(date), "todo", taskId)
    return
  }
  if (mode === "week") {
    useTaskStore.getState().updateTask({
      ...task,
      scheduledDate: undefined,
      scheduledTime: undefined,
      scheduledWeek: getWeekString(date),
    })
    return
  }
  useTaskStore.getState().updateTask({
    ...task,
    scheduledDate: undefined,
    scheduledTime: undefined,
    scheduledWeek: undefined,
    scheduledMonth: formatLocalMonthKey(date),
  })
}

export function unscheduleEvent(eventId: string): void {
  const event = useEventStore.getState().events.find((row) => row.id === eventId)
  if (!event) return
  useEventStore.getState().updateEvent({ ...event, isAllDay: true })
}

export function unschedulePlan(actionId: string, date: Date): void {
  const action = usePlannedActionStore.getState().actions.find((row) => row.id === actionId)
  if (!action) return
  if (action.source === "todo" && action.sourceId) unscheduleTask(action.sourceId, date, "day")
  else usePlannedActionStore.getState().deleteAction(actionId)
}
