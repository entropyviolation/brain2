/**
 * components/Home/Plan/event-dialog.tsx — Event create/edit dialog
 *
 * Creates or edits a calendar `CalendarEvent` (title, start/end time, all-day,
 * date/end-date, location, description, color) via `lib/event-store.ts`.
 * Bounded Win95 window (not a stretched shadcn sheet). Caption × is a title-bar
 * close on the right; Cancel and Create/Update sit like other BRAIN2 OK/Cancel
 * rows. Dirty close uses the house unsaved-changes guard.
 *
 * Spec: §7.5 (Events).
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { format } from "date-fns"
import type { CalendarEvent } from "@/lib/types"
import { useEventStore } from "@/lib/event-store"
import { useTaskStore } from "@/lib/task-store"
import { parseLocalDate } from "@/lib/date-utils"
import { attachToEvent, detachFromEvent, eventDeadline, getEventChecklist } from "@/lib/event-links"
import { createScheduledTodoTask } from "@/components/Home/ToDo/todo-utils"
import { ColorSwatch } from "@/components/ui/color-swatch"
import { snapshotsEqual } from "@/lib/unsaved-changes"
import { UnsavedChangesDialog, unsavedDismissProps, useUnsavedGuard } from "@/components/ui/unsaved-changes-guard"
import {
  PLAN_COLOR_PRESETS,
  PLAN_DEFAULT_EVENT_COLOR,
  resolvePlanColor,
} from "./plan-chip"
import { EventLocationField, type EventPlace } from "./event-location-field"
import { EventPrereqPicker } from "./event-prereq-picker"

interface EventDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingEvent: CalendarEvent | null
  setEditingEvent: (event: CalendarEvent | null) => void
  newEvent: {
    title: string
    startTime: string
    endTime: string
    type: CalendarEvent["type"]
    date: Date
    endDate?: Date
    isAllDay?: boolean
    location?: string
    locationAddress?: string
    locationLat?: number
    locationLng?: number
    description?: string
    color?: string
  }
  setNewEvent: (event: any) => void
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
}

/** Draft the dialog edits; Plan holds it so a click can seed it from an event. */
export type EventDraft = EventDialogProps["newEvent"]

function eventDraftSnapshot(event: EventDialogProps["newEvent"]) {
  return {
    title: event.title,
    startTime: event.startTime,
    endTime: event.endTime,
    type: event.type,
    date: event.date,
    endDate: event.endDate ?? null,
    isAllDay: !!event.isAllDay,
    location: event.location ?? "",
    locationLat: event.locationLat ?? null,
    locationLng: event.locationLng ?? null,
    description: event.description ?? "",
    color: resolvePlanColor(event.color),
  }
}

function emptyEvent(date: Date) {
  return {
    title: "",
    startTime: "09:00",
    endTime: "10:00",
    type: "event" as CalendarEvent["type"],
    date,
    endDate: undefined,
    isAllDay: false,
    location: "",
    description: "",
    color: PLAN_DEFAULT_EVENT_COLOR,
  }
}

export function EventDialog({
  open,
  onOpenChange,
  editingEvent,
  setEditingEvent,
  newEvent,
  setNewEvent,
}: EventDialogProps) {
  const deleteEvent = useEventStore((s) => s.deleteEvent)
  const updateEvent = useEventStore((s) => s.updateEvent)
  const addEvent = useEventStore((s) => s.addEvent)

  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const addTask = useTaskStore((s) => s.addTask)

  const [baseline, setBaseline] = useState(() => eventDraftSnapshot(newEvent))

  useEffect(() => {
    if (!open) return
    setBaseline(eventDraftSnapshot(newEvent))
    // Freeze the open snapshot; live typing must not refresh the baseline.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editingEvent?.id])

  const isDirty = useMemo(
    () => open && !snapshotsEqual(eventDraftSnapshot(newEvent), baseline),
    [open, newEvent, baseline],
  )

  const persistEvent = () => {
    const color = resolvePlanColor(newEvent.color)
    if (editingEvent) {
      updateEvent({ ...editingEvent, ...newEvent, color, isScheduled: true })
      setEditingEvent(null)
    } else {
      const event: CalendarEvent = {
        id: Date.now().toString(),
        ...newEvent,
        color,
        isScheduled: true,
        isAllDay: newEvent.isAllDay || false,
        location: newEvent.location || "",
        description: newEvent.description || "",
      }
      addEvent(event)
    }
    setNewEvent(emptyEvent(new Date()))
  }

  const discardDraft = () => {
    setNewEvent(emptyEvent(newEvent.date))
    setEditingEvent(null)
  }

  const guard = useUnsavedGuard({
    open,
    onOpenChange,
    isDirty,
    onSave: persistEvent,
    onDiscard: discardDraft,
  })

  const checklist = editingEvent ? getEventChecklist(tasks, editingEvent.id) : null
  const attachableTasks = useMemo(() => {
    if (!editingEvent) return []
    const linkedIds = new Set(getEventChecklist(tasks, editingEvent.id).tasks.map((t) => t.id))
    return tasks.filter((t) => !t.completed && !linkedIds.has(t.id))
  }, [tasks, editingEvent])

  const attachTask = (taskId: string) => {
    if (!editingEvent || !taskId) return
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const liveEvent = { ...editingEvent, ...newEvent } as CalendarEvent
    updateTask(attachToEvent(task, liveEvent))
  }

  /** New item from the checklist search: an open, unscheduled to-do linked to this event. */
  const createPrereq = (title: string) => {
    if (!editingEvent) return
    const draft = createScheduledTodoTask({ description: title, period: "day", date: new Date() })
    delete draft.scheduledDate
    const liveEvent = { ...editingEvent, ...newEvent } as CalendarEvent
    addTask(attachToEvent(draft, liveEvent))
  }

  const detachTask = (taskId: string) => {
    if (!editingEvent) return
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    updateTask(detachFromEvent(task, editingEvent.id))
  }

  const eventColor = resolvePlanColor(newEvent.color)

  const handleAddEvent = () => {
    persistEvent()
    guard.forceClose()
  }

  const handleAllDayToggle = (checked: boolean) => {
    setNewEvent({
      ...newEvent,
      isAllDay: checked,
      startTime: checked ? "00:00" : "09:00",
      endTime: checked ? "23:59" : "10:00",
      endDate: checked ? newEvent.endDate : undefined,
    })
  }

  return (
    <>
      <Dialog open={open} onOpenChange={guard.handleOpenChange}>
        <DialogContent className="plan95-dialog max-h-[90vh]" hideClose data-ui-name="Plan event" data-ui-docs="components/Home/Plan/README.md" {...unsavedDismissProps(guard.requestClose)}>
          <DialogHeader className="plan95-dialog-caption flex-row items-center space-y-0 text-left">
            <DialogTitle>{editingEvent ? "Edit Event" : "Create New Event"}</DialogTitle>
            <button type="button" className="plan95-title-btn b2-close-key" aria-label="Close" onClick={guard.requestClose}>
              ×
            </button>
          </DialogHeader>
          <div className="plan95-dialog-body">
            <div className="plan95-field">
              <Label htmlFor="event-title">Event Title</Label>
              <Input
                id="event-title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Enter event title..."
              />
            </div>

            <label className="plan95-check" htmlFor="all-day">
              <input
                id="all-day"
                type="checkbox"
                checked={newEvent.isAllDay || false}
                onChange={(e) => handleAllDayToggle(e.target.checked)}
              />
              All Day Event
            </label>

            <div className="plan95-times">
              <div className="plan95-field">
                <Label htmlFor="start-date">Start Date</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={format(newEvent.date, "yyyy-MM-dd")}
                  onChange={(e) => setNewEvent({ ...newEvent, date: parseLocalDate(e.target.value) ?? new Date() })}
                />
              </div>
              {newEvent.isAllDay && (
                <div className="plan95-field">
                  <Label htmlFor="end-date">End Date (Optional)</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={newEvent.endDate ? format(newEvent.endDate, "yyyy-MM-dd") : ""}
                    onChange={(e) =>
                      setNewEvent({
                        ...newEvent,
                        endDate: e.target.value ? (parseLocalDate(e.target.value) ?? undefined) : undefined,
                      })
                    }
                  />
                </div>
              )}
            </div>

            {!newEvent.isAllDay && (
              <div className="plan95-times">
                <div className="plan95-field">
                  <Label htmlFor="start-time">Start Time</Label>
                  <ClockPicker
                    id="start-time"
                    value={newEvent.startTime}
                    onChange={(startTime) => setNewEvent({ ...newEvent, startTime })}
                  />
                </div>
                <div className="plan95-field">
                  <Label htmlFor="end-time">End Time</Label>
                  <ClockPicker
                    id="end-time"
                    value={newEvent.endTime}
                    onChange={(endTime) => setNewEvent({ ...newEvent, endTime })}
                  />
                </div>
              </div>
            )}

            <div className="plan95-field">
              <Label htmlFor="event-color">Color</Label>
              <div className="plan-color-row">
                {PLAN_COLOR_PRESETS.map((preset) => (
                  <button
                    key={preset.color}
                    type="button"
                    className="plan-color-preset"
                    aria-label={preset.label}
                    data-selected={eventColor === preset.color ? "true" : "false"}
                    style={{ background: preset.color }}
                    onClick={() => setNewEvent({ ...newEvent, color: preset.color })}
                  />
                ))}
                <ColorSwatch
                  id="event-color"
                  value={eventColor}
                  onChange={(color) => setNewEvent({ ...newEvent, color })}
                  aria-label="Event color"
                  size="md"
                />
              </div>
            </div>

            <div className="plan95-field">
              <Label htmlFor="location">Location</Label>
              <EventLocationField
                id="location"
                value={{
                  location: newEvent.location || "",
                  locationAddress: newEvent.locationAddress,
                  locationLat: newEvent.locationLat,
                  locationLng: newEvent.locationLng,
                }}
                onChange={(place: EventPlace) => setNewEvent({ ...newEvent, ...place })}
              />
            </div>

            <div className="plan95-field">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newEvent.description || ""}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Add event description..."
                rows={3}
              />
            </div>

            {editingEvent && checklist && (
              <div className="plan-danger plan95-field">
                <Label htmlFor="prereq-search">Prerequisite checklist</Label>
                <p className="plan-prereq-note">
                  Linked tasks must be done before{" "}
                  {format(eventDeadline({ ...editingEvent, ...newEvent } as CalendarEvent), "MMM d, h:mm a")}.
                </p>
                <EventPrereqPicker
                  inputId="prereq-search"
                  linked={checklist.tasks}
                  candidates={attachableTasks}
                  onAttach={attachTask}
                  onDetach={detachTask}
                  onCreate={createPrereq}
                />
              </div>
            )}

            <div className="plan95-dialog-actions">
              {editingEvent && (
                <button
                  type="button"
                  data-danger="true"
                  onClick={() => {
                    deleteEvent(editingEvent.id)
                    setEditingEvent(null)
                    guard.forceClose()
                  }}
                >
                  Delete Event
                </button>
              )}
              <button type="button" onClick={guard.requestClose}>
                Cancel
              </button>
              <button type="button" data-default="true" onClick={handleAddEvent}>
                {editingEvent ? "Update Event" : "Create Event"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog {...guard.prompt} />
    </>
  )
}
