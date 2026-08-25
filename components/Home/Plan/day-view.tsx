/**
 * components/Home/Plan/day-view.tsx — Day calendar view
 *
 * Hour-by-hour day grid showing time-slotted tasks and events, the planned-tasks
 * side panel (items for this day not yet given a time), and the auto-growing
 * "Day Plan" text so a full written plan can live here without an inner scrollbar.
 *
 * Spec: §7.4 (Day View).
 */
"use client"

import type React from "react"
import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight, Edit3, Calendar, Sparkles, MapPin } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { format, addDays, subDays } from "date-fns"
import type { CalendarEvent } from "@/lib/types"
import { formatLocalDateKey, sameCalendarDay, toLocalCalendarDate } from "@/lib/date-utils"
import { getBannerEvents } from "@/lib/event-links"
import { getStoredPlanText, saveStoredPlanText } from "@/lib/plan-text"
import { PlannedTasksSidebar } from "./planned-tasks-sidebar"
import { AgendaGrid } from "./agenda-grid"

const MIN_DAY_PLAN_HEIGHT = 280

interface DayViewProps {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  onTaskClick: (taskId: string) => void
  onEventClick: (event: CalendarEvent) => void
  onCreateEvent: (date: Date, hour?: number, endHour?: number) => void
}

export function DayView({
  currentDate,
  setCurrentDate,
  events,
  onTaskClick,
  onEventClick,
  onCreateEvent,
}: DayViewProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const updateEvent = useEventStore((s) => s.updateEvent)
  const [dayPlan, setDayPlan] = useState("")
  const dayPlanRef = useRef<HTMLTextAreaElement>(null)
  const dayKey = formatLocalDateKey(currentDate)

  useEffect(() => {
    setDayPlan(getStoredPlanText("day", dayKey) ?? "")
  }, [dayKey])

  useLayoutEffect(() => {
    const el = dayPlanRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.max(el.scrollHeight, MIN_DAY_PLAN_HEIGHT)}px`
  }, [dayPlan])

  const handleDayPlanChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setDayPlan(value)
    saveStoredPlanText("day", dayKey, value)
  }

  const getScheduledTasks = (date: Date) => {
    return tasks.filter((task) => {
      if (!task.scheduledDate) return false
      return sameCalendarDay(task.scheduledDate, date)
    })
  }

  const dayTasks = getScheduledTasks(currentDate)
  // Include multi-day all-day events that span this day (not only the start date).
  const allDayEvents = getBannerEvents(events, currentDate)

  const handleScheduleTask = (taskId: string, hour: number, minute: number) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const scheduledDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, minute)
    updateTask({
      ...task,
      scheduledDate,
      scheduledTime: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      scheduledWeek: undefined,
      scheduledMonth: undefined,
      scheduledYear: undefined,
    })
  }

  const handleUnscheduleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    updateTask({ ...task, scheduledTime: undefined })
  }

  const handleRescheduleEvent = (eventId: string, hour: number, minute: number) => {
    const event = events.find((e) => e.id === eventId)
    if (!event || event.isAllDay) return
    const durationMin = (() => {
      const [sh, sm] = event.startTime.split(":").map(Number)
      const [eh, em] = event.endTime.split(":").map(Number)
      return eh * 60 + em - (sh * 60 + sm)
    })()
    const endTotal = hour * 60 + minute + durationMin
    const endH = Math.floor(endTotal / 60)
    const endM = endTotal % 60
    updateEvent({
      ...event,
      date: toLocalCalendarDate(currentDate),
      startTime: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
      endTime: `${endH.toString().padStart(2, "0")}:${endM.toString().padStart(2, "0")}`,
    })
  }

  const handleUnscheduleEvent = (eventId: string) => {
    const event = events.find((e) => e.id === eventId)
    if (!event) return
    updateEvent({ ...event, isAllDay: true })
  }

  return (
    <div className="flex gap-6 h-full">
      <PlannedTasksSidebar
        mode="day"
        currentDate={currentDate}
        onTaskClick={onTaskClick}
        onUnscheduleTask={handleUnscheduleTask}
        onUnscheduleEvent={handleUnscheduleEvent}
      />

      <div className="space-y-6 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(subDays(currentDate, 1))}
              className="hover:bg-blue-50 hover:border-blue-200 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              {format(currentDate, "EEEE, MMMM d, yyyy")}
            </h3>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addDays(currentDate, 1))}
              className="hover:bg-blue-50 hover:border-blue-200 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={() => setCurrentDate(new Date())}
            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white shadow-md"
          >
            Today
          </Button>
        </div>

        {allDayEvents.length > 0 && (
          <Card className="shadow-lg border-0 bg-gradient-to-r from-purple-100 to-blue-100">
            <CardContent className="p-4">
              <div className="space-y-2">
                {allDayEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-3 bg-white/80 rounded-lg cursor-pointer hover:bg-white/90 transition-colors"
                    onClick={() => onEventClick(event)}
                  >
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: event.color }} />
                    <div className="flex-1">
                      <div className="font-semibold text-slate-800">{event.title}</div>
                      {event.location && (
                        <div className="text-sm text-slate-600 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">
                      {event.endDate
                        ? `${format(event.date, "MMM d")} – ${format(event.endDate, "MMM d")}`
                        : "All Day"}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-700">
              <Calendar className="h-5 w-5 text-blue-500" />
              Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <AgendaGrid
              date={currentDate}
              events={events}
              tasks={dayTasks}
              mode="plan"
              maxHeight="max-h-[600px]"
              onTaskClick={onTaskClick}
              onEventClick={onEventClick}
              onCreateEvent={onCreateEvent}
              onScheduleTask={handleScheduleTask}
              onRescheduleEvent={handleRescheduleEvent}
              showCurrentTimeIndicator
              showAllDayBanners={false}
            />
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-700">
              <Edit3 className="h-5 w-5 text-blue-500" />
              Day Plan - {format(currentDate, "MMMM dd, yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              ref={dayPlanRef}
              placeholder="Write your day plan, goals, and objectives..."
              value={dayPlan}
              onChange={handleDayPlanChange}
              rows={12}
              className="min-h-[280px] overflow-hidden resize-y [field-sizing:content] border-slate-200 focus:border-blue-300 focus:ring-blue-200 bg-white/50"
            />
            <p className="text-xs text-slate-500 mt-3 flex items-center gap-1">
              <Sparkles className="h-3 w-3" />
              Auto-saved to local storage
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
