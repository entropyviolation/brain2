/**
 * components/Home/Plan/event-dialog.tsx — Event create/edit dialog
 *
 * Creates or edits a calendar `CalendarEvent` (title, start/end time, all-day,
 * date/end-date, location, description, color) via `lib/event-store.ts`.
 *
 * Spec: §7.5 (Events).
 */
"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { format } from "date-fns"
import { CheckCircle2, Circle, X } from "lucide-react"
import type { CalendarEvent } from "@/lib/types"
import { useEventStore } from "@/lib/event-store"
import { useTaskStore } from "@/lib/task-store"
import { parseLocalDate } from "@/lib/date-utils"
import { attachToEvent, detachFromEvent, eventDeadline, getEventChecklist } from "@/lib/event-links"

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
    description?: string
  }
  setNewEvent: (event: any) => void
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
}

export function EventDialog({
  open,
  onOpenChange,
  editingEvent,
  setEditingEvent,
  newEvent,
  setNewEvent,
  events,
  setEvents,
}: EventDialogProps) {
  const deleteEvent = useEventStore((s) => s.deleteEvent)
  const updateEvent = useEventStore((s) => s.updateEvent)
  const addEvent = useEventStore((s) => s.addEvent)

  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)

  // Prerequisite checklist (HM1): tasks linked to this event via `checklist-of`,
  // each carrying a derived `mustBeDoneBefore` constraint. Only available once
  // the event exists (it needs a stable id to link against).
  const checklist = editingEvent ? getEventChecklist(tasks, editingEvent.id) : null
  const checklistIds = new Set(checklist?.tasks.map((t) => t.id) ?? [])
  const attachableTasks = tasks.filter((t) => !t.completed && !checklistIds.has(t.id))

  const attachTask = (taskId: string) => {
    if (!editingEvent || !taskId) return
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const liveEvent = { ...editingEvent, ...newEvent } as CalendarEvent
    updateTask(attachToEvent(task, liveEvent))
  }

  const detachTask = (taskId: string) => {
    if (!editingEvent) return
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    updateTask(detachFromEvent(task, editingEvent.id))
  }

  const handleAddEvent = () => {
    if (editingEvent) {
      updateEvent({ ...editingEvent, ...newEvent, color: editingEvent.color, isScheduled: true })
      setEditingEvent(null)
    } else {
      const event: CalendarEvent = {
        id: Date.now().toString(),
        ...newEvent,
        color: "#8cd4a5",
        isScheduled: true,
        isAllDay: newEvent.isAllDay || false,
        location: newEvent.location || "",
        description: newEvent.description || "",
      }
      addEvent(event)
    }

    setNewEvent({
      title: "",
      startTime: "09:00",
      endTime: "10:00",
      type: "event",
      date: new Date(),
      endDate: undefined,
      isAllDay: false,
      location: "",
      description: "",
    })
    onOpenChange(false)
  }

  const handleAllDayToggle = (checked: boolean) => {
    setNewEvent({
      ...newEvent,
      isAllDay: checked,
      startTime: checked ? "00:00" : "09:00",
      endTime: checked ? "23:59" : "10:00",
      endDate: checked ? newEvent.endDate : undefined, // Clear end date if not all-day
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl bg-gradient-to-br from-gray-900 via-gray-800 to-black border border-gray-700 shadow-2xl max-h-[90vh] overflow-y-auto backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-[#8cd4a5] via-[#b89fbf] to-[#8b7ecc] bg-clip-text text-transparent">
            {editingEvent ? "Edit Event" : "Create New Event"}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {editingEvent ? "Modify your event details" : "Add a new event to your calendar"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="event-title" className="text-sm font-semibold text-gray-200">
              Event Title
            </Label>
            <Input
              id="event-title"
              value={newEvent.title}
              onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
              placeholder="Enter event title..."
              className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-[#8cd4a5] focus:ring-[#8cd4a5]/20 transition-all duration-300"
            />
          </div>

          <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-gray-800/30 to-gray-700/30 rounded-lg border border-gray-600">
            <Switch
              id="all-day"
              checked={newEvent.isAllDay || false}
              onCheckedChange={handleAllDayToggle}
              className="data-[state=checked]:bg-[#8cd4a5]"
            />
            <Label htmlFor="all-day" className="text-sm font-semibold text-gray-200 cursor-pointer">
              All Day Event
            </Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-sm font-semibold text-gray-200">
                Start Date
              </Label>
              <Input
                id="start-date"
                type="date"
                value={format(newEvent.date, "yyyy-MM-dd")}
                onChange={(e) => setNewEvent({ ...newEvent, date: parseLocalDate(e.target.value) ?? new Date() })}
                className="bg-gray-800/50 border-gray-600 text-white focus:border-[#8cd4a5] focus:ring-[#8cd4a5]/20 transition-all duration-300"
              />
            </div>
            {newEvent.isAllDay && (
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-sm font-semibold text-gray-200">
                  End Date (Optional)
                </Label>
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
                  className="bg-gray-800/50 border-gray-600 text-white focus:border-[#8cd4a5] focus:ring-[#8cd4a5]/20 transition-all duration-300"
                />
              </div>
            )}
          </div>

          {!newEvent.isAllDay && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-time" className="text-sm font-semibold text-gray-200">
                  Start Time
                </Label>
                <Input
                  id="start-time"
                  type="time"
                  value={newEvent.startTime}
                  onChange={(e) => setNewEvent({ ...newEvent, startTime: e.target.value })}
                  className="bg-gray-800/50 border-gray-600 text-white focus:border-[#8cd4a5] focus:ring-[#8cd4a5]/20 transition-all duration-300"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-time" className="text-sm font-semibold text-gray-200">
                  End Time
                </Label>
                <Input
                  id="end-time"
                  type="time"
                  value={newEvent.endTime}
                  onChange={(e) => setNewEvent({ ...newEvent, endTime: e.target.value })}
                  className="bg-gray-800/50 border-gray-600 text-white focus:border-[#8cd4a5] focus:ring-[#8cd4a5]/20 transition-all duration-300"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="location" className="text-sm font-semibold text-gray-200">
              Location
            </Label>
            <Input
              id="location"
              value={newEvent.location || ""}
              onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
              placeholder="Enter location..."
              className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-[#8cd4a5] focus:ring-[#8cd4a5]/20 transition-all duration-300"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-semibold text-gray-200">
              Description
            </Label>
            <Textarea
              id="description"
              value={newEvent.description || ""}
              onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
              placeholder="Add event description..."
              rows={3}
              className="bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-[#8cd4a5] focus:ring-[#8cd4a5]/20 transition-all duration-300 resize-none"
            />
          </div>

          {editingEvent && checklist && (
            <div className="space-y-3 rounded-lg border border-gray-600 bg-gray-800/30 p-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold text-gray-200">Prerequisite checklist</Label>
                {checklist.total > 0 && (
                  <span
                    className={`text-xs font-medium ${checklist.allComplete ? "text-[#8cd4a5]" : "text-gray-400"}`}
                  >
                    {checklist.completed}/{checklist.total} done
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400">
                Linked tasks must be done before {format(eventDeadline({ ...editingEvent, ...newEvent } as CalendarEvent), "MMM d, h:mm a")}.
              </p>

              {checklist.tasks.length > 0 ? (
                <ul className="space-y-1">
                  {checklist.tasks.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center gap-2 rounded bg-gray-800/50 px-2 py-1.5 text-sm text-gray-200"
                    >
                      {task.completed ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8cd4a5]" />
                      ) : (
                        <Circle className="h-4 w-4 shrink-0 text-gray-500" />
                      )}
                      <span className={`flex-1 truncate ${task.completed ? "line-through text-gray-500" : ""}`}>
                        {task.description}
                      </span>
                      <button
                        type="button"
                        onClick={() => detachTask(task.id)}
                        className="shrink-0 rounded p-0.5 text-gray-400 hover:bg-gray-700 hover:text-white transition-colors"
                        aria-label={`Remove ${task.description} from checklist`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs italic text-gray-500">No prerequisite tasks linked yet.</p>
              )}

              <select
                value=""
                onChange={(e) => {
                  attachTask(e.target.value)
                  e.target.value = ""
                }}
                disabled={attachableTasks.length === 0}
                className="w-full rounded-md border border-gray-600 bg-gray-800/50 px-3 py-2 text-sm text-white focus:border-[#8cd4a5] focus:outline-none disabled:opacity-50"
              >
                <option value="" disabled>
                  {attachableTasks.length === 0 ? "No tasks available to add" : "Add a prerequisite task…"}
                </option>
                {attachableTasks.map((task) => (
                  <option key={task.id} value={task.id}>
                    {task.description}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex gap-3 pt-6">
            <Button
              onClick={handleAddEvent}
              className="flex-1 bg-gradient-to-r from-[#8cd4a5] via-[#9fc2a5] to-[#adc29f] hover:from-[#7bc394] hover:via-[#8eb194] hover:to-[#9cb18e] text-black font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              {editingEvent ? "Update Event" : "Create Event"}
            </Button>
            {editingEvent && (
              <Button
                variant="destructive"
                onClick={() => {
                  deleteEvent(editingEvent.id)
                  onOpenChange(false)
                  setEditingEvent(null)
                }}
                className="bg-gradient-to-r from-[#571833] to-red-600 hover:from-[#461426] hover:to-red-700 text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                Delete Event
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
