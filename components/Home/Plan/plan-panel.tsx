/**
 * components/Home/Plan/plan-panel.tsx — Plan panel container
 *
 * Milled fascia calendar on the Home Plan sub-tab (CRT title, metal keys,
 * Month/Week/Day bay). Hosts Month/Week/Day views, Add Event / Add Plan /
 * Paste Events / Settings, and wires dialogs. The selected day is the shared
 * `useCurrentDate` cursor passed in from Home. Month cell clicks call
 * `setPlanTab("day")` for that date; Add Event remains the event control;
 * Add Plan writes a timed planned action on the selected day.
 * Optional Plan-only Dark latch lives in `#plan-chrome-toggles` (persist
 * `brain2-plan-dark`); gem-and-trinket mode sits beside it (persist
 * `brain2-plan-gem-mode`). Both default off. Labels flip with the latch:
 * Dark → "light mode"; Gem and trinket → "no gem no trinket".
 *
 * Spec: §7.4 (calendar views), §8.5 (Plan panel).
 */
"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TaskDetailPopup } from "@/components/ItemDetail/ItemDetailPopup"
import { orbFor } from "@/components/Icons"
import type { CalendarEvent } from "@/lib/types"
import type { PlannedAction } from "@/lib/planned-actions"
import { MonthView } from "./month-view"
import { WeekView } from "./week-view"
import { DayView } from "./day-view"
import { EventDialog } from "./event-dialog"
import { PlannedActionDialog } from "./planned-action-dialog"
import { PasteEventsDialog } from "./paste-events-dialog"
import { useEventStore } from "@/lib/event-store"
import { SettingsDialog } from "./settings-dialog"
import { APP_NAV_KEYS } from "@/lib/app-navigation"
import { usePersistedTab } from "@/lib/use-persisted-tab"
import { format } from "date-fns"
import { PLAN_DEFAULT_EVENT_COLOR, resolvePlanColor } from "./plan-chip"
import { usePlanDarkMode } from "./plan-theme"
import { usePlanGemMode } from "./plan-gem-mode"
import { PlanGemModeToggle } from "./plan-gem-mode-toggle"
import "./plan-chrome.css"

const PLAN_TABS = ["month", "week", "day"] as const
type PlanTab = (typeof PLAN_TABS)[number]

const TAB_STATUS: Record<PlanTab, string> = {
  month: "Month view",
  week: "Week view",
  day: "Day view",
}

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
  const events = useEventStore((s) => s.events)
  const addEvent = useEventStore((s) => s.addEvent)
  const updateEvent = useEventStore((s) => s.updateEvent)
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
    color: PLAN_DEFAULT_EVENT_COLOR,
  })

  const [showSettingsDialog, setShowSettingsDialog] = useState(false)
  const [showPasteDialog, setShowPasteDialog] = useState(false)
  const [showPlanDialog, setShowPlanDialog] = useState(false)
  const [planDialogAction, setPlanDialogAction] = useState<PlannedAction | null>(null)
  const [planTab, setPlanTab] = usePersistedTab(APP_NAV_KEYS.homePlanTab, PLAN_TABS, "month")
  const [planDark, setPlanDark] = usePlanDarkMode()
  const [gemMode, setGemMode] = usePlanGemMode()

  useEffect(() => {
    setNewEvent((prev) => ({ ...prev, date: currentDate }))
  }, [currentDate])

  const handleOpenDay = (date: Date) => {
    setCurrentDate(date)
    setPlanTab("day")
  }

  const handleCreateEvent = (date: Date, hour?: number, endHour?: number) => {
    const startH = hour ?? 9
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
      color: PLAN_DEFAULT_EVENT_COLOR,
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
      color: resolvePlanColor(event.color),
    })
    setShowEventDialog(true)
  }

  const handleTaskClick = (taskId: string) => {
    setSelectedTaskId(taskId)
  }

  const handleOpenPlannedAction = (action: PlannedAction) => {
    setPlanDialogAction(action)
    setShowPlanDialog(true)
  }

  const handleEventUpdate = (_updatedEvents: CalendarEvent[]) => {
    // Views write through the event store directly.
  }

  const eventCount = events.length
  const eventLabel = `${eventCount} event(s)`

  return (
    <div
      className="plan95"
      data-plan-dark={planDark ? "true" : "false"}
      data-ui-name="Plan"
      data-ui-help="Calendar window: Month, Week, and Day plus written plan logs."
      data-ui-docs="components/Home/Plan/README.md"
    >
      <div className="plan-window">
        <Tabs value={planTab} onValueChange={(v) => setPlanTab(v as PlanTab)} className="flex min-h-0 flex-1 flex-col">
          <div className="plan-fascia">
            <div className="plan-fascia-row">
              <div className="plan-mark">
                <img src={orbFor("home-plan")} alt="" className="plan-title-orb" />
                <h2>Plan</h2>
                <span className="plan-mark-note">Calendar</span>
              </div>
              <div className="plan-toolbar-actions">
                <button type="button" className="plan-btn" onClick={() => setShowSettingsDialog(true)}>
                  Settings
                </button>
                <button type="button" className="plan-btn" onClick={() => setShowPasteDialog(true)}>
                  Paste Events
                </button>
                <button type="button" className="plan-btn" onClick={() => setShowEventDialog(true)}>
                  Add Event
                </button>
                <button
                  type="button"
                  className="plan-btn"
                  onClick={() => {
                    setPlanDialogAction(null)
                    setShowPlanDialog(true)
                  }}
                >
                  Add Plan
                </button>
              </div>
              <TabsList className="plan-view-keys">
                <TabsTrigger value="month">Month</TabsTrigger>
                <TabsTrigger value="week">Week</TabsTrigger>
                <TabsTrigger value="day">Day</TabsTrigger>
              </TabsList>
              <div className="plan-toolbar-modes" id="plan-chrome-toggles">
                <button
                  type="button"
                  id="plan-dark-mode"
                  className="plan-mode-toggle plan-btn"
                  aria-pressed={planDark}
                  aria-label={planDark ? "light mode" : "Dark"}
                  title={planDark ? "light mode — return to milled silver" : "Dark"}
                  onClick={() => setPlanDark(!planDark)}
                >
                  {planDark ? "light mode" : "Dark"}
                </button>
                <PlanGemModeToggle on={gemMode} onChange={setGemMode} />
              </div>
            </div>
          </div>

          <div className="plan-body">
            <TabsContent value="month" className="mt-0 min-h-0 flex-1">
              <MonthView
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                events={events}
                setEvents={handleEventUpdate}
                onTaskClick={handleTaskClick}
                onEventClick={handleEventClick}
                onOpenDay={handleOpenDay}
                onPlannedActionClick={handleOpenPlannedAction}
                gemMode={gemMode}
              />
            </TabsContent>

            <TabsContent value="week" className="mt-0 min-h-0 flex-1">
              <WeekView
                currentDate={currentDate}
                setCurrentDate={setCurrentDate}
                events={events}
                setEvents={handleEventUpdate}
                onTaskClick={handleTaskClick}
                onEventClick={handleEventClick}
                onCreateEvent={handleCreateEvent}
                onPlannedActionClick={handleOpenPlannedAction}
              />
            </TabsContent>

            <TabsContent value="day" className="mt-0 min-h-0 flex-1">
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
          </div>
        </Tabs>

        <div className="plan-status">
          <span>
            {TAB_STATUS[planTab]} · {format(currentDate, "EEEE, MMMM d, yyyy")}
          </span>
          <span>{eventLabel}</span>
        </div>
      </div>

      <EventDialog
        open={showEventDialog}
        onOpenChange={setShowEventDialog}
        editingEvent={editingEvent}
        setEditingEvent={setEditingEvent}
        newEvent={newEvent}
        setNewEvent={setNewEvent}
        events={events}
        setEvents={(nextEvents) => {
          if (editingEvent) {
            const updatedEvent = nextEvents.find((e) => e.id === editingEvent.id)
            if (updatedEvent) updateEvent(updatedEvent)
          } else {
            const newEventToAdd = nextEvents[nextEvents.length - 1]
            if (newEventToAdd) addEvent(newEventToAdd)
          }
        }}
      />

      <PlannedActionDialog
        open={showPlanDialog}
        onOpenChange={(open) => {
          setShowPlanDialog(open)
          if (!open) setPlanDialogAction(null)
        }}
        action={planDialogAction}
        createDate={currentDate}
      />

      <SettingsDialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog} />

      <PasteEventsDialog open={showPasteDialog} onOpenChange={setShowPasteDialog} />

      <TaskDetailPopup taskId={selectedTaskId} open={!!selectedTaskId} onClose={() => setSelectedTaskId(null)} />
    </div>
  )
}
