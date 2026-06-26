/**
 * components/Home/Plan/agenda-grid.tsx — Shared hour-by-hour agenda grid
 *
 * Used by Plan day view (scheduling) and Tracking day log (actual time).
 * Supports drag-drop scheduling, unscheduling, current-time indicator,
 * and 15-minute snap positioning.
 */
"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo, useCallback } from "react"
import { Clock, MapPin, CalendarClock } from "lucide-react"
import { format } from "date-fns"
import { formatLocalDateKey, isToday, sameCalendarDay } from "@/lib/date-utils"
import { getBannerEvents, getMustBeDoneBefore } from "@/lib/event-links"
import type { CalendarEvent, Task, TimeLogEntry } from "@/lib/types"

export const HOUR_HEIGHT = 70
const SNAP_MINUTES = 15

export type AgendaGridMode = "plan" | "log"

export interface AgendaGridProps {
  date: Date
  events: CalendarEvent[]
  /** Tasks scheduled for this day (plan mode) or planned tasks to reference (log mode) */
  tasks: Task[]
  mode: AgendaGridMode
  maxHeight?: string
  onTaskClick?: (taskId: string) => void
  onEventClick?: (event: CalendarEvent) => void
  onCreateEvent?: (date: Date, hour: number, endHour?: number) => void
  onScheduleTask?: (taskId: string, hour: number, minute: number) => void
  onRescheduleEvent?: (eventId: string, hour: number, minute: number) => void
  /** Log mode: update or create time log entries */
  onUpdateTimeLog?: (taskId: string, logId: string, updates: Partial<TimeLogEntry>) => void
  onCreateTimeLog?: (taskId: string, hour: number, minute: number) => void
  showCurrentTimeIndicator?: boolean
}

function parseTimeParts(time?: string): { hour: number; minute: number } {
  if (!time) return { hour: 0, minute: 0 }
  const [h, m] = time.split(":").map(Number)
  return { hour: h || 0, minute: m || 0 }
}

function timeToMinutes(time?: string): number {
  const { hour, minute } = parseTimeParts(time)
  return hour * 60 + minute
}

function minutesToTime(total: number): string {
  const h = Math.floor(total / 60) % 24
  const m = total % 60
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`
}

function snapMinute(raw: number): number {
  return Math.round(raw / SNAP_MINUTES) * SNAP_MINUTES
}

function dropPosition(e: React.DragEvent<HTMLDivElement>, hour: number): { hour: number; minute: number } {
  const rect = e.currentTarget.getBoundingClientRect()
  const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top))
  const minute = snapMinute(Math.round((y / rect.height) * 60))
  return { hour, minute: Math.min(45, minute) }
}

function getEventDurationMinutes(event: CalendarEvent): number {
  const [sh, sm] = event.startTime.split(":").map(Number)
  const [eh, em] = event.endTime.split(":").map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

interface GridItem {
  kind: "task" | "event" | "log"
  id: string
  taskId?: string
  logId?: string
  event?: CalendarEvent
  label: string
  startMinutes: number
  durationMinutes: number
  color?: string
  isGhost?: boolean
  location?: string
  sublabel?: string
  /** Event-linked prerequisite deadline (HM1) — renders a "must be done before" badge. */
  mustBeDoneBefore?: Date
}

export function AgendaGrid({
  date,
  events,
  tasks,
  mode,
  maxHeight = "max-h-96",
  onTaskClick,
  onEventClick,
  onCreateEvent,
  onScheduleTask,
  onRescheduleEvent,
  onUpdateTimeLog,
  onCreateTimeLog,
  showCurrentTimeIndicator = true,
}: AgendaGridProps) {
  const dragCreateHour = useRef<number | null>(null)
  const didDragCreate = useRef(false)
  const [dragHighlight, setDragHighlight] = useState<{ lo: number; hi: number } | null>(null)
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })

  const dayKey = formatLocalDateKey(date)

  useEffect(() => {
    if (!showCurrentTimeIndicator || !isToday(date)) return
    const tick = () => {
      const n = new Date()
      setNowMinutes(n.getHours() * 60 + n.getMinutes())
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [date, showCurrentTimeIndicator])

  const dayEvents = useMemo(
    () => events.filter((event) => sameCalendarDay(event.date, date)),
    [events, date],
  )

  const timedEvents = dayEvents.filter((e) => !e.isAllDay)

  // All-day + multi-day events covering this day, rendered as banner rows above
  // the hour grid (HM1). Uses the event's full span via `endDate`.
  const bannerEvents = useMemo(() => getBannerEvents(events, date), [events, date])

  const gridItems = useMemo((): GridItem[] => {
    const items: GridItem[] = []

    if (mode === "plan") {
      for (const event of timedEvents) {
        items.push({
          kind: "event",
          id: event.id,
          event,
          label: event.title,
          startMinutes: timeToMinutes(event.startTime),
          durationMinutes: getEventDurationMinutes(event),
          color: event.color,
          location: event.location,
          sublabel: `${event.startTime} - ${event.endTime}`,
        })
      }
      for (const task of tasks) {
        if (!task.scheduledTime) continue
        items.push({
          kind: "task",
          id: task.id,
          taskId: task.id,
          label: task.description,
          startMinutes: timeToMinutes(task.scheduledTime),
          durationMinutes: task.estimatedDuration ?? 30,
          sublabel: `${task.estimatedDuration ?? 30}m`,
          mustBeDoneBefore: getMustBeDoneBefore(task),
        })
      }
    } else {
      // Log mode: show time logs as primary blocks, planned tasks as ghosts
      const loggedTaskIds = new Set<string>()
      for (const task of tasks) {
        for (const log of task.timeLogs || []) {
          if (log.date !== dayKey) continue
          loggedTaskIds.add(task.id)
          const start = timeToMinutes(log.startTime)
          items.push({
            kind: "log",
            id: log.id,
            taskId: task.id,
            logId: log.id,
            label: log.activityLabel || task.description,
            startMinutes: start,
            durationMinutes: log.durationMinutes,
            sublabel: log.notes || `${log.durationMinutes}m logged`,
          })
        }
      }
      for (const task of tasks) {
        if (loggedTaskIds.has(task.id) || !task.scheduledTime) continue
        items.push({
          kind: "task",
          id: `ghost-${task.id}`,
          taskId: task.id,
          label: task.description,
          startMinutes: timeToMinutes(task.scheduledTime),
          durationMinutes: task.estimatedDuration ?? 30,
          isGhost: true,
          sublabel: `Planned ${task.estimatedDuration ?? 30}m`,
        })
      }
      for (const event of timedEvents) {
        items.push({
          kind: "event",
          id: event.id,
          label: event.title,
          startMinutes: timeToMinutes(event.startTime),
          durationMinutes: getEventDurationMinutes(event),
          color: event.color,
          isGhost: true,
          sublabel: "Planned event",
        })
      }
    }

    return items.sort((a, b) => a.startMinutes - b.startMinutes)
  }, [mode, tasks, timedEvents, dayKey])

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, hour: number) => {
    e.preventDefault()
    const { minute } = dropPosition(e, hour)
    const taskId = e.dataTransfer.getData("taskId")
    const eventId = e.dataTransfer.getData("eventId")
    const logId = e.dataTransfer.getData("logId")
    const logTaskId = e.dataTransfer.getData("logTaskId")

    if (logId && logTaskId && mode === "log" && onUpdateTimeLog) {
      const task = tasks.find((t) => t.id === logTaskId)
      const log = task?.timeLogs?.find((l) => l.id === logId)
      if (log) {
        const newStart = hour * 60 + minute
        const newEnd = newStart + log.durationMinutes
        onUpdateTimeLog(logTaskId, logId, {
          startTime: minutesToTime(newStart),
          endTime: minutesToTime(newEnd),
        })
      }
      return
    }

    if (taskId) {
      if (mode === "log" && onCreateTimeLog) {
        onCreateTimeLog(taskId, hour, minute)
      } else if (mode === "plan" && onScheduleTask) {
        onScheduleTask(taskId, hour, minute)
      }
    } else if (eventId && mode === "plan" && onRescheduleEvent) {
      onRescheduleEvent(eventId, hour, minute)
    }
  }

  const onTaskDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("taskId", taskId)
    e.dataTransfer.effectAllowed = "move"
  }

  const onEventDragStart = (e: React.DragEvent, eventId: string) => {
    e.dataTransfer.setData("eventId", eventId)
    e.dataTransfer.effectAllowed = "move"
  }

  const onLogDragStart = (e: React.DragEvent, taskId: string, logId: string) => {
    e.dataTransfer.setData("logId", logId)
    e.dataTransfer.setData("logTaskId", taskId)
    e.dataTransfer.effectAllowed = "move"
  }

  const itemsForHour = useCallback(
    (hour: number) => gridItems.filter((item) => Math.floor(item.startMinutes / 60) === hour),
    [gridItems],
  )

  const showNowLine = showCurrentTimeIndicator && isToday(date)

  return (
    <div className={`space-y-1 overflow-y-auto ${maxHeight} relative`}>
      {bannerEvents.length > 0 && (
        <div className="space-y-1 pb-1">
          {bannerEvents.map((event) => {
            const spansMultiDay = !!event.endDate
            return (
              <div
                key={`banner-${event.id}`}
                className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-white shadow-sm cursor-pointer"
                style={{ backgroundColor: event.color || "#8cd4a5" }}
                onClick={() => onEventClick?.(event)}
              >
                <CalendarClock className="h-3.5 w-3.5 shrink-0" />
                <span className="font-semibold truncate">{event.title}</span>
                <span className="ml-auto shrink-0 text-xs opacity-90">
                  {spansMultiDay
                    ? `${format(event.date, "MMM d")} – ${format(event.endDate as Date, "MMM d")}`
                    : "All day"}
                </span>
              </div>
            )
          })}
        </div>
      )}
      {Array.from({ length: 24 }, (_, hour) => (
        <div
          key={hour}
          className="flex border-b border-slate-100 hover:bg-gradient-to-r hover:from-blue-50/50 hover:to-purple-50/50 transition-all duration-200 rounded-lg"
        >
          <div className="w-20 text-sm text-slate-500 p-4 border-r border-slate-100 font-medium shrink-0">
            {hour.toString().padStart(2, "0")}:00
          </div>
          <div
            className={`flex-1 relative cursor-pointer p-2 ${
              dragHighlight && hour >= dragHighlight.lo && hour <= dragHighlight.hi
                ? "bg-blue-100/60 ring-1 ring-blue-300"
                : ""
            }`}
            style={{ minHeight: HOUR_HEIGHT }}
            onDragOver={onDragOver}
            onDrop={(e) => handleDrop(e, hour)}
            onMouseDown={() => {
              if (mode !== "plan" || !onCreateEvent) return
              dragCreateHour.current = hour
              didDragCreate.current = false
              setDragHighlight({ lo: hour, hi: hour })
            }}
            onMouseEnter={() => {
              if (dragCreateHour.current !== null) {
                didDragCreate.current = true
                const lo = Math.min(dragCreateHour.current, hour)
                const hi = Math.max(dragCreateHour.current, hour)
                setDragHighlight({ lo, hi })
              }
            }}
            onMouseUp={() => {
              if (dragCreateHour.current !== null && mode === "plan" && onCreateEvent) {
                if (didDragCreate.current) {
                  onCreateEvent(date, dragCreateHour.current, hour)
                } else {
                  onCreateEvent(date, hour)
                }
              }
              dragCreateHour.current = null
              didDragCreate.current = false
              setDragHighlight(null)
            }}
          >
            {itemsForHour(hour).map((item, idx) => {
              const topOffset = (item.startMinutes % 60) * (HOUR_HEIGHT / 60)
              const height = Math.max(28, (item.durationMinutes / 60) * HOUR_HEIGHT)
              const isLog = item.kind === "log"
              const isEvent = item.kind === "event"
              const draggable = mode === "plan" || isLog || (mode === "log" && !!item.taskId)

              return (
                <div
                  key={item.id}
                  className={`absolute left-2 right-2 rounded-lg text-sm p-2 cursor-pointer shadow-md hover:shadow-lg transition-shadow ${
                    item.isGhost
                      ? "border-2 border-dashed border-slate-300 bg-slate-50/80 text-slate-500 opacity-60"
                      : isEvent
                        ? "text-white"
                        : isLog
                          ? "bg-gradient-to-r from-amber-100 to-orange-100 text-amber-900 border border-amber-200"
                          : "bg-gradient-to-r from-emerald-100 to-teal-100 text-emerald-800 border border-emerald-200"
                  }`}
                  style={{
                    top: topOffset + idx * 4,
                    height,
                    backgroundColor: isEvent && !item.isGhost ? item.color : undefined,
                    zIndex: item.isGhost ? 1 : 10 + idx,
                  }}
                  draggable={draggable}
                  onDragStart={(e) => {
                    if (isLog && item.taskId && item.logId) onLogDragStart(e, item.taskId, item.logId)
                    else if (isEvent) onEventDragStart(e, item.id)
                    else if (item.taskId) onTaskDragStart(e, item.taskId)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isEvent && !item.isGhost && item.event) onEventClick?.(item.event)
                    else if (item.taskId && !item.isGhost) onTaskClick?.(item.taskId)
                    else if (item.taskId && item.isGhost && mode === "log") onTaskClick?.(item.taskId)
                  }}
                >
                  <div className="font-semibold truncate flex items-center gap-1">
                    {!isEvent && <Clock className="h-3.5 w-3.5 shrink-0" />}
                    {item.label}
                  </div>
                  {item.sublabel && <div className="opacity-75 text-xs mt-0.5 truncate">{item.sublabel}</div>}
                  {item.mustBeDoneBefore && (
                    <div className="mt-1 inline-flex items-center gap-1 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700">
                      <CalendarClock className="h-3 w-3" />
                      must be done before {format(item.mustBeDoneBefore, "MMM d, h:mm a")}
                    </div>
                  )}
                  {item.location && (
                    <div className="opacity-80 text-xs flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" />
                      {item.location}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {showNowLine && (
        <div
          className="absolute left-20 right-0 pointer-events-none z-20"
          style={{ top: (nowMinutes / 60) * (HOUR_HEIGHT + 4) + 2 }}
        >
          <div className="relative flex items-center">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 -ml-1 shrink-0 shadow-sm" />
            <div className="flex-1 h-0.5 bg-red-500 shadow-sm" />
            <span className="text-[10px] font-semibold text-red-500 ml-1 bg-white/90 px-1 rounded">
              {minutesToTime(nowMinutes)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
