/**
 * components/Home/Plan/month-view.tsx — Month calendar view
 *
 * Month grid with event/task chips per day, drag-and-drop to (re)schedule onto a
 * date, the Planned Tasks sidebar, and the persisted "Month Plan" textarea.
 *
 * Spec: §7.4 (Month View). NOTE: Month Plan currently persists to localStorage
 * (`monthPlan-YYYY-MM`); target is a MongoDB-backed `MonthPlan` document with
 * debounced auto-save — see docs/SPEC_MAPPING.md §7.
 */
"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight, Clock, Edit3, Sparkles, MapPin, Calendar } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { formatLocalDateKey, sameCalendarDay, toLocalCalendarDate } from "@/lib/date-utils"
import { getStoredPlanText, saveStoredPlanText } from "@/lib/plan-text"
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addDays,
} from "date-fns"
import type { CalendarEvent } from "@/lib/types"
import { PlannedTasksSidebar } from "./planned-tasks-sidebar"

interface MonthViewProps {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  onTaskClick: (taskId: string) => void
  onEventClick: (event: CalendarEvent) => void
  onCreateEvent: (date: Date, hour?: number) => void
}

export function MonthView({
  currentDate,
  setCurrentDate,
  events,
  setEvents,
  onTaskClick,
  onEventClick,
  onCreateEvent,
}: MonthViewProps) {
  const { tasks, updateTask } = useTaskStore()
  const { updateEvent } = useEventStore()
  const [monthPlan, setMonthPlan] = useState("")
  const monthKey = format(currentDate, "yyyy-MM")

  useEffect(() => {
    setMonthPlan(getStoredPlanText("month", monthKey) ?? "")
  }, [monthKey])

  const handleMonthPlanChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setMonthPlan(value)
    saveStoredPlanText("month", monthKey, value)
  }

  const getScheduledTasks = (date: Date) => {
    return tasks.filter((task) => task.scheduledDate && sameCalendarDay(task.scheduledDate, date))
  }

  const getEventsForDate = (date: Date) => {
    return events.filter((event) => sameCalendarDay(event.date, date))
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const startDate = addDays(monthStart, -monthStart.getDay())
  const endDate = addDays(monthEnd, 6 - monthEnd.getDay())
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>, date: Date) => {
    const taskId = e.dataTransfer.getData("taskId")
    const eventId = e.dataTransfer.getData("eventId")

    if (taskId) {
      const task = tasks.find((t) => t.id === taskId)
      if (task) {
        updateTask({ ...task, scheduledDate: toLocalCalendarDate(date) })
      }
    } else if (eventId) {
      const event = events.find((e) => e.id === eventId)
      if (event) {
        updateEvent({ ...event, date: toLocalCalendarDate(date) })
      }
    }
  }

  return (
    <div className="flex gap-6 h-full bg-gradient-to-br from-gray-900 via-black to-gray-800 min-h-screen">
      <PlannedTasksSidebar mode="month" currentDate={currentDate} onTaskClick={onTaskClick} />

      <div className="flex-1 space-y-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="bg-gray-800/50 border-gray-600 text-white hover:bg-gradient-to-r hover:from-[#8cd4a5] hover:to-[#9fc2a5] hover:text-black transition-all duration-300 transform hover:scale-110"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-3xl font-bold bg-gradient-to-r from-[#8cd4a5] via-[#b89fbf] to-[#8b7ecc] bg-clip-text text-transparent">
              {format(currentDate, "MMMM yyyy")}
            </h3>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="bg-gray-800/50 border-gray-600 text-white hover:bg-gradient-to-r hover:from-[#8cd4a5] hover:to-[#9fc2a5] hover:text-black transition-all duration-300 transform hover:scale-110"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button
            onClick={() => setCurrentDate(new Date())}
            className="bg-gradient-to-r from-[#130ead] via-[#571833] to-[#5f756d] hover:from-[#0f0a8a] hover:via-[#451426] hover:to-[#4d5e56] text-white shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
          >
            <Calendar className="h-4 w-4 mr-2" />
            Today
          </Button>
        </div>

        {/* Calendar grid */}
        <Card className="bg-gradient-to-br from-gray-800/80 via-gray-900/80 to-black/80 border border-gray-700 shadow-2xl backdrop-blur-xl">
          <CardContent className="p-0">
            <div className="grid grid-cols-7 border-b border-gray-600">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="p-4 text-center font-semibold text-gray-200 bg-gradient-to-b from-gray-700/50 to-gray-800/50 border-r border-gray-600 last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {calendarDays.map((date, index) => {
                const dayEvents = getEventsForDate(date)
                const dayTasks = getScheduledTasks(date)
                const isCurrentMonth = isSameMonth(date, currentDate)
                const isCurrentDay = isToday(date)

                return (
                  <div
                    key={index}
                    className={`min-h-[140px] border-r border-b border-gray-600 last:border-r-0 p-3 transition-all duration-300 hover:bg-gradient-to-br hover:from-[#8cd4a5]/10 hover:to-[#b89fbf]/10 cursor-pointer group ${
                      !isCurrentMonth ? "bg-gray-800/30 text-gray-500" : "bg-gray-800/50"
                    } ${isCurrentDay ? "bg-gradient-to-br from-[#130ead]/20 via-[#8b7ecc]/20 to-[#b89fbf]/20 border-[#8cd4a5] shadow-inner" : ""}`}
                    onDragOver={onDragOver}
                    onDrop={(e) => onDrop(e, date)}
                    onClick={() => onCreateEvent(date)}
                  >
                    <div
                      className={`text-sm font-semibold mb-3 flex items-center justify-between ${
                        isCurrentDay ? "text-[#8cd4a5]" : isCurrentMonth ? "text-gray-200" : "text-gray-500"
                      }`}
                    >
                      <span>{format(date, "d")}</span>
                      {isCurrentDay && <Sparkles className="h-3 w-3 text-[#8cd4a5] animate-pulse" />}
                    </div>

                    <div className="space-y-1">
                      {/* Events */}
                      {dayEvents.slice(0, 2).map((event) => (
                        <div
                          key={event.id}
                          className="text-xs p-2 rounded-md text-white cursor-pointer truncate shadow-sm hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                          style={{
                            background: `linear-gradient(135deg, ${event.color || "#8cd4a5"}, ${event.color || "#9fc2a5"})`,
                          }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick(event)
                          }}
                        >
                          <div className="font-medium">{event.isAllDay ? "All Day" : event.startTime}</div>
                          <div className="opacity-90 truncate">{event.title}</div>
                          {event.location && (
                            <div className="opacity-80 text-xs flex items-center gap-1 mt-1">
                              <MapPin className="h-2 w-2" />
                              <span className="truncate">{event.location}</span>
                            </div>
                          )}
                        </div>
                      ))}

                      {/* Tasks */}
                      {dayTasks.slice(0, 2).map((task) => (
                        <div
                          key={task.id}
                          className="text-xs p-2 rounded-md bg-gradient-to-r from-[#5f756d]/80 to-[#adc29f]/80 text-white cursor-pointer truncate border border-[#8cd4a5]/30 hover:shadow-lg transition-all duration-300 transform hover:scale-105"
                          onClick={(e) => {
                            e.stopPropagation()
                            onTaskClick(task.id)
                          }}
                        >
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            <span className="font-medium truncate">{task.description}</span>
                          </div>
                        </div>
                      ))}

                      {/* Show more indicator */}
                      {dayEvents.length + dayTasks.length > 4 && (
                        <div className="text-xs text-gray-400 font-medium">
                          +{dayEvents.length + dayTasks.length - 4} more
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Month plan */}
        <Card className="bg-gradient-to-br from-gray-800/80 via-gray-900/80 to-black/80 border border-gray-700 shadow-2xl backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-gray-200">
              <Edit3 className="h-5 w-5 text-[#8cd4a5]" />
              Month Plan - {format(currentDate, "MMMM yyyy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Write your month plan, goals, and objectives..."
              value={monthPlan}
              onChange={handleMonthPlanChange}
              rows={6}
              className="resize-none bg-gray-800/50 border-gray-600 text-white placeholder-gray-400 focus:border-[#8cd4a5] focus:ring-[#8cd4a5]/20 transition-all duration-300"
            />
            <p className="text-xs text-gray-400 mt-3 flex items-center gap-1">
              <Sparkles className="h-3 w-3 animate-pulse" />
              Auto-saved to local storage
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
