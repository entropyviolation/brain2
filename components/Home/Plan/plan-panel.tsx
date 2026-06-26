/**
 * components/Home/Plan/plan-panel.tsx — Plan panel container
 *
 * The calendar/plan side of the Scheduler embedded in the Home dashboard. Hosts
 * the Month/Week/Day view tabs, the Add Event and Settings actions, and wires the
 * event dialog and task detail popup to the active view.
 *
 * Spec: §7.4 (calendar views), §8.5 (Plan panel).
 */
"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskDetailPopup } from "@/components/task-detail-popup"
import { Button } from "@/components/ui/button"
import { Plus, Database, Calendar, Clock, Grid3X3 } from "lucide-react"
import type { CalendarEvent } from "@/lib/types"
import { MonthView } from "./month-view"
import { WeekView } from "./week-view"
import { DayView } from "./day-view"
import { EventDialog } from "./event-dialog"
import { useEventStore } from "@/lib/event-store"
import { SettingsDialog } from "./settings-dialog"
import { APP_NAV_KEYS, readStoredTab, writeStoredTab } from "@/lib/app-navigation"

const PLAN_TABS = ["month", "week", "day"] as const
type PlanTab = (typeof PLAN_TABS)[number]

export function PlanPanel({
  currentDate: controlledDate,
  setCurrentDate: setControlledDate,
}: {
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
} = {}) {
  const [internalDate, setInternalDate] = useState(new Date())
  const currentDate = controlledDate ?? internalDate
  const setCurrentDate = setControlledDate ?? setInternalDate
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const { events, addEvent, updateEvent, deleteEvent } = useEventStore()
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null)
  const [newEvent, setNewEvent] = useState({
    title: "",
    startTime: "09:00",
    endTime: "10:00",
    type: "event" as CalendarEvent["type"],
    date: currentDate,
    endDate: undefined as Date | undefined,
    isAllDay: false,
    location: "",
    description: "",
  })

  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [planTab, setPlanTab] = useState<PlanTab>(() => readStoredTab(APP_NAV_KEYS.homePlanTab, PLAN_TABS, "month"))

  useEffect(() => {
    writeStoredTab(APP_NAV_KEYS.homePlanTab, planTab)
  }, [planTab])

  useEffect(() => {
    setNewEvent((prev) => ({ ...prev, date: currentDate }))
  }, [currentDate])

  const handleCreateEvent = (date: Date, hour?: number, endHour?: number) => {
    const startH = hour ?? 9
    const endH = endHour !== undefined ? endHour + 1 : startH + 1
    const lo = Math.min(startH, endHour ?? startH)
    const hi = Math.max(startH, endHour ?? startH)
    setNewEvent({
      title: "",
      startTime: `${lo.toString().padStart(2, "0")}:00`,
      endTime: `${(hi + 1).toString().padStart(2, "0")}:00`,
      type: "event",
      date: date,
      endDate: undefined,
      isAllDay: false,
      location: "",
      description: "",
    })
    setEditingEvent(null)
    setShowEventDialog(true)
  }

  const handleEventClick = (event: CalendarEvent) => {
    setEditingEvent(event)
    setNewEvent({
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      type: event.type,
      date: event.date,
      endDate: event.endDate,
      isAllDay: event.isAllDay || false,
      location: event.location || "",
      description: event.description || "",
    })
    setShowEventDialog(true)
  }

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId)
  }

  const handleEventUpdate = (updatedEvents: CalendarEvent[]) => {
    // This will be handled by the individual view components
    // using the event store directly
  }

  return (
    <div className="h-full bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen">
      <div className="space-y-6 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-4xl font-bold bg-gradient-to-r from-[#8cd4a5] via-[#b89fbf] to-[#8b7ecc] bg-clip-text text-transparent">
              Plan
            </h2>
            <p className="text-gray-400 mt-1">Schedule and organize your time with elegance</p>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setShowSettingsDialog(true)}
              className="bg-gray-800/50 border-gray-600 text-white hover:bg-gradient-to-r hover:from-[#571833] hover:to-[#5f756d] hover:text-white transition-all duration-300 transform hover:scale-105"
            >
              <Database className="h-4 w-4 mr-2" />
              Settings
            </Button>
            <Button
              onClick={() => setShowEventDialog(true)}
              className="bg-gradient-to-r from-[#8cd4a5] via-[#9fc2a5] to-[#adc29f] hover:from-[#7bc394] hover:via-[#8eb194] hover:to-[#9cb18e] text-black font-semibold shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Event
            </Button>
          </div>
        </div>

        <Tabs value={planTab} onValueChange={(v) => setPlanTab(v as PlanTab)} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800/50 border border-gray-700 shadow-lg">
            <TabsTrigger
              value="month"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#8cd4a5] data-[state=active]:to-[#9fc2a5] data-[state=active]:text-black text-gray-300 hover:text-white transition-all duration-300"
            >
              <Grid3X3 className="h-4 w-4 mr-2" />
              Month View
            </TabsTrigger>
            <TabsTrigger
              value="week"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#b89fbf] data-[state=active]:to-[#8b7ecc] data-[state=active]:text-black text-gray-300 hover:text-white transition-all duration-300"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Week View
            </TabsTrigger>
            <TabsTrigger
              value="day"
              className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-[#130ead] data-[state=active]:to-[#571833] data-[state=active]:text-white text-gray-300 hover:text-white transition-all duration-300"
            >
              <Clock className="h-4 w-4 mr-2" />
              Day View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="month" className="mt-6">
            <MonthView
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              events={events}
              setEvents={handleEventUpdate}
              onTaskClick={handleTaskClick}
              onEventClick={handleEventClick}
              onCreateEvent={handleCreateEvent}
            />
          </TabsContent>

          <TabsContent value="week" className="mt-6">
            <WeekView
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              events={events}
              setEvents={handleEventUpdate}
              onTaskClick={handleTaskClick}
              onEventClick={handleEventClick}
              onCreateEvent={handleCreateEvent}
            />
          </TabsContent>

          <TabsContent value="day" className="mt-6">
            <DayView
              currentDate={currentDate}
              setCurrentDate={setCurrentDate}
              events={events}
              setEvents={handleEventUpdate}
              onTaskClick={handleTaskClick}
              onEventClick={handleEventClick}
              onCreateEvent={handleCreateEvent}
            />
          </TabsContent>
        </Tabs>

        <EventDialog
          open={showEventDialog}
          onOpenChange={setShowEventDialog}
          editingEvent={editingEvent}
          setEditingEvent={setEditingEvent}
          newEvent={newEvent}
          setNewEvent={setNewEvent}
          events={events}
          setEvents={(events) => {
            if (editingEvent) {
              const updatedEvent = events.find((e) => e.id === editingEvent.id)
              if (updatedEvent) updateEvent(updatedEvent)
            } else {
              const newEventToAdd = events[events.length - 1]
              if (newEventToAdd) addEvent(newEventToAdd)
            }
          }}
        />

        <SettingsDialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog} />

        <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
      </div>
    </div>
  )
}
