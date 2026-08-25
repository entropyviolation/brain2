/**
 * components/Home/Plan/week-view.tsx — Week calendar view
 */
"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ChevronLeft, ChevronRight, Clock, Edit3, Sparkles, MapPin } from "lucide-react"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { sameCalendarDay, toLocalCalendarDate, getWeekStartDate, getWeekDates, getWeekString } from "@/lib/date-utils"
import { eventCoversDay } from "@/lib/event-links"
import { getStoredPlanText, saveStoredPlanText } from "@/lib/plan-text"
import { format, addWeeks, subWeeks, isToday } from "date-fns"
import type { CalendarEvent } from "@/lib/types"
import { PlannedTasksSidebar } from "./planned-tasks-sidebar"

interface WeekViewProps {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  onTaskClick: (taskId: string) => void
  onEventClick: (event: CalendarEvent) => void
  onCreateEvent: (date: Date, hour?: number) => void
}

export function WeekView({
  currentDate,
  setCurrentDate,
  events,
  onTaskClick,
  onEventClick,
  onCreateEvent,
}: WeekViewProps) {
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const updateEvent = useEventStore((s) => s.updateEvent)
  const [weekPlan, setWeekPlan] = useState("")

  const weekStart = getWeekStartDate(currentDate)
  const weekDates = getWeekDates(weekStart)
  const weekKey = getWeekString(currentDate)

  useEffect(() => {
    setWeekPlan(getStoredPlanText("week", weekKey) ?? "")
  }, [weekKey])

  const handleWeekPlanChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setWeekPlan(value)
    saveStoredPlanText("week", weekKey, value)
  }

  const getScheduledTasks = (date: Date) => {
    return tasks.filter((task) => task.scheduledDate && sameCalendarDay(task.scheduledDate, date))
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>, date: Date, hour: number) => {
    e.preventDefault()
    const taskId = e.dataTransfer.getData("taskId")
    const eventId = e.dataTransfer.getData("eventId")

    if (taskId) {
      const task = tasks.find((t) => t.id === taskId)
      if (task) {
        const scheduledDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour)
        updateTask({
          ...task,
          scheduledDate,
          scheduledTime: `${hour.toString().padStart(2, "0")}:00`,
          scheduledWeek: undefined,
          scheduledMonth: undefined,
          scheduledYear: undefined,
        })
      }
    } else if (eventId) {
      const event = events.find((ev) => ev.id === eventId)
      if (event && !event.isAllDay) {
        const durationMin = getEventDurationMinutes(event)
        const endTotal = hour * 60 + durationMin
        updateEvent({
          ...event,
          date: toLocalCalendarDate(date),
          startTime: `${hour.toString().padStart(2, "0")}:00`,
          endTime: `${Math.floor(endTotal / 60).toString().padStart(2, "0")}:${(endTotal % 60).toString().padStart(2, "0")}`,
        })
      }
    }
  }

  const onTaskDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId)
    e.dataTransfer.effectAllowed = "move"
  }

  const onEventDragStart = (e: React.DragEvent<HTMLDivElement>, eventId: string) => {
    e.dataTransfer.setData("eventId", eventId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleUnscheduleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    updateTask({ ...task, scheduledDate: undefined, scheduledTime: undefined, scheduledWeek: getWeekString(currentDate) })
  }

  const getEventDurationMinutes = (event: CalendarEvent): number => {
    const [startHour, startMin] = event.startTime.split(":").map(Number)
    const [endHour, endMin] = event.endTime.split(":").map(Number)
    return endHour * 60 + endMin - (startHour * 60 + startMin)
  }

  const getEventHeight = (event: CalendarEvent) => {
    const durationMinutes = getEventDurationMinutes(event)
    return Math.max(60, (durationMinutes / 60) * 60)
  }

  const getTaskHeight = (task: { estimatedDuration?: number }) => {
    const mins = task.estimatedDuration ?? 30
    return Math.max(60, (mins / 60) * 60)
  }

  const getAllDayEventsForDate = (date: Date) => {
    return events.filter((event) => event.isAllDay && eventCoversDay(event, date))
  }

  const getTimedEventsForSlot = (date: Date, hour: number) => {
    return events.filter(
      (event) =>
        !event.isAllDay &&
        sameCalendarDay(event.date, date) &&
        Number.parseInt(event.startTime.split(":")[0]) === hour,
    )
  }

  return (
    <div className="flex gap-6 h-full">
      <div className="w-80">
        <PlannedTasksSidebar mode="week" currentDate={weekStart} onTaskClick={onTaskClick} onUnscheduleTask={handleUnscheduleTask} />
      </div>

      <div className="space-y-6 flex-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-2xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 bg-clip-text text-transparent">
              {format(weekStart, "MMM d")} - {format(weekDates[6], "MMM d, yyyy")}
            </h3>
            <Button variant="outline" size="icon" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={() => setCurrentDate(new Date())} className="bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md">
            Today
          </Button>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm overflow-auto" style={{ height: "calc(100vh - 400px)" }}>
          <CardContent className="p-0">
            <div className="grid grid-cols-8 gap-0 border rounded-lg overflow-hidden">
              <div className="bg-gradient-to-b from-slate-50 to-white p-4 border-r border-slate-200 sticky top-0 z-10">
                <span className="text-sm font-semibold text-slate-700">Time</span>
              </div>

              {weekDates.map((date, index) => (
                <div
                  key={index}
                  className="bg-gradient-to-b from-slate-50 to-white p-2 border-r border-slate-200 last:border-r-0 text-center sticky top-0 z-10"
                >
                  <div className="text-sm font-semibold text-slate-700">{format(date, "EEE")}</div>
                  <div
                    className={`text-lg font-bold mt-1 ${
                      isToday(date)
                        ? "text-blue-600 bg-blue-100 rounded-full w-6 h-6 flex items-center justify-center mx-auto text-sm"
                        : "text-slate-700"
                    }`}
                  >
                    {format(date, "d")}
                  </div>
                  <div className="mt-2 space-y-1">
                    {getAllDayEventsForDate(date).map((event) => (
                      <div
                        key={event.id}
                        className="text-xs p-1 rounded text-white cursor-pointer truncate"
                        style={{ backgroundColor: event.color }}
                        onClick={() => onEventClick(event)}
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className="contents">
                  <div className="p-3 border-r border-b border-slate-200 text-xs text-slate-500 bg-gradient-to-r from-slate-50 to-white">
                    {hour.toString().padStart(2, "0")}:00
                  </div>

                  {weekDates.map((date, dayIndex) => {
                    const dayEvents = getTimedEventsForSlot(date, hour)
                    const dayTasks = getScheduledTasks(date).filter(
                      (task) => task.scheduledTime && Number.parseInt(task.scheduledTime.split(":")[0]) === hour,
                    )

                    return (
                      <div
                        key={`${hour}-${dayIndex}`}
                        className={`min-h-[60px] border-r border-b border-slate-200 last:border-r-0 p-1 relative hover:bg-gradient-to-br hover:from-blue-50 hover:to-purple-50 cursor-pointer transition-all duration-200 ${
                          isToday(date) ? "bg-blue-50/30" : ""
                        }`}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, date, hour)}
                        onClick={() => onCreateEvent(date, hour)}
                      >
                        {dayEvents.map((event) => (
                          <div
                            key={event.id}
                            className="absolute inset-1 rounded-lg text-xs text-white p-2 cursor-pointer shadow-md hover:shadow-lg transition-shadow"
                            style={{ backgroundColor: event.color, height: `${getEventHeight(event)}px` }}
                            draggable
                            onDragStart={(e) => onEventDragStart(e, event.id)}
                            onClick={(e) => {
                              e.stopPropagation()
                              onEventClick(event)
                            }}
                          >
                            <div className="font-semibold truncate">{event.title}</div>
                            <div className="opacity-90 text-xs">
                              {event.startTime} - {event.endTime}
                            </div>
                            {event.location && (
                              <div className="opacity-80 text-xs flex items-center gap-1 mt-1">
                                <MapPin className="h-2 w-2" />
                                <span className="truncate">{event.location}</span>
                              </div>
                            )}
                          </div>
                        ))}

                        {dayTasks.map((task, idx) => (
                          <div
                            key={task.id}
                            className="absolute inset-1 rounded-lg text-xs bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 p-2 cursor-pointer border border-emerald-200 shadow-md hover:shadow-lg transition-shadow"
                            style={{
                              height: `${getTaskHeight(task)}px`,
                              top: `${dayEvents.length * 65 + idx * 4 + 4}px`,
                            }}
                            draggable
                            onDragStart={(e) => onTaskDragStart(e, task.id)}
                            onClick={(e) => {
                              e.stopPropagation()
                              onTaskClick(task.id)
                            }}
                          >
                            <div className="font-semibold truncate flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {task.description}
                            </div>
                            <div className="opacity-75 text-xs">{task.estimatedDuration}m</div>
                          </div>
                        ))}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-slate-700">
              <Edit3 className="h-5 w-5 text-blue-500" />
              Week Plan - {format(weekStart, "MMM d")} to {format(weekDates[6], "MMM d")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              placeholder="Write your week plan, priorities, and focus areas..."
              value={weekPlan}
              onChange={handleWeekPlanChange}
              rows={4}
              className="resize-none border-slate-200 focus:border-blue-300 focus:ring-blue-200 bg-white/50"
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
