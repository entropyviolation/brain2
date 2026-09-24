/**
 * components/Home/Plan/agenda-grid.tsx — Shared hour-by-hour agenda grid
 *
 * Used by Plan day view (scheduling) and Tracking day log (actual time).
 * Supports drag-drop scheduling, unscheduling, current-time indicator,
 * sunrise/sunset lines (from Settings home location), and 15-minute snap
 * positioning. Log mode can overlay painted Tracking blocks (`trackedBlocks`)
 * so Day Log shows the same intervals as the Time Grid and Activity Log.
 * Tracked blocks that span hours render as **one continuous slab** (position +
 * height across the hour grid) — clickable everywhere, title once — instead of
 * a sliced reprint in every hour. Plan-mode events still slice per hour.
 */
"use client"

import type React from "react"
import { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from "react"
import { format } from "date-fns"
import { formatDateKey, formatLocalDateKey, isToday, sameCalendarDay } from "@/lib/date-utils"
import { getBannerEvents, getMustBeDoneBefore } from "@/lib/event-links"
import { fetchDayClimate, minutesFromHhmm } from "@/lib/weather-client"
import { DEFAULT_HOME_CITY, useUserSettingsStore } from "@/lib/user-settings-store"
import type { CalendarEvent, Task, TimeLogEntry } from "@/lib/types"
import { readPlanDrag, writePlanDrag, type PlanDragPayload } from "@/lib/plan-drag"
import { usePlanPointerDrop } from "./use-plan-rail-drag"
import {
  hhmmToMinutes,
  plannedDurationMinutes,
  todoIdsCoveredByPlacements,
  type PlannedAction,
} from "@/lib/planned-actions"
import { PLAN_TASK_COLOR, planEventTimeLabel, resolvePlanColor } from "./plan-chip"
import "./plan-chrome.css"

export const HOUR_HEIGHT = 152
const SNAP_MINUTES = 15

export type AgendaGridMode = "plan" | "log"

/** A painted Tracking block overlaid on the Day Log agenda. */
export interface TrackedAgendaBlock {
  id: string
  label: string
  startMinutes: number
  durationMinutes: number
  color?: string
  sublabel?: string
}

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
  onScheduleHabit?: (habitId: string, hour: number, minute: number) => void
  onRescheduleEvent?: (eventId: string, hour: number, minute: number) => void
  onReschedulePlannedAction?: (actionId: string, hour: number, minute: number) => void
  /** Click-drag empty minutes: start + end. Click without drag still uses onCreateEvent. */
  onCreatePlannedAction?: (date: Date, startMinutes: number, endMinutes: number) => void
  plannedActions?: PlannedAction[]
  onPlannedActionClick?: (action: PlannedAction) => void
  /** Log mode: update or create time log entries */
  onUpdateTimeLog?: (taskId: string, logId: string, updates: Partial<TimeLogEntry>) => void
  onCreateTimeLog?: (taskId: string, hour: number, minute: number) => void
  /**
   * Log mode: painted Time Grid blocks for this day. These are the same
   * intervals the Activity Log lists — Day Log overlays them on the plan so
   * tracking input is visible here too.
   */
  trackedBlocks?: TrackedAgendaBlock[]
  onTrackedBlockClick?: (id: string) => void
  showCurrentTimeIndicator?: boolean
  /** Sunrise/sunset lines from Settings home location. Default true. */
  showSunTimes?: boolean
  /** When false, skip all-day/multi-day banner rows (e.g. day view renders them separately). */
  showAllDayBanners?: boolean
  /** Minutes past midnight to land the scroll (now, or wake). Midnight hours stay in the grid. */
  scrollToMinutes?: number
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

function dropPosition(e: { currentTarget: Element; clientY: number }, hour: number): { hour: number; minute: number } {
  const rect = e.currentTarget.getBoundingClientRect()
  const height = rect.height || HOUR_HEIGHT
  const y = Math.max(0, Math.min(height, e.clientY - rect.top))
  const raw = snapMinute(Math.round((y / height) * 60))
  const minute = Number.isFinite(raw) ? Math.min(45, raw) : 0
  return { hour, minute }
}

function getEventDurationMinutes(event: CalendarEvent): number {
  const [sh, sm] = event.startTime.split(":").map(Number)
  const [eh, em] = event.endTime.split(":").map(Number)
  return eh * 60 + em - (sh * 60 + sm)
}

function markerTop(minutes: number): number {
  return (minutes / 60) * HOUR_HEIGHT
}

/** Scroll offset so `landMinutes` sits about two hour-rows below the top of the agenda. */
export function planAgendaScrollTop(landMinutes: number): number {
  return Math.max(0, markerTop(Math.max(0, landMinutes)) - 2 * HOUR_HEIGHT)
}

type MarkerTone = "now" | "sunrise" | "sunset"

const MARKER_TONE: Record<MarkerTone, { line: string; text: string }> = {
  now: { line: "#c00", text: "#c00" },
  sunrise: { line: "#b8860b", text: "#8a6500" },
  sunset: { line: "#c45c00", text: "#8a3b00" },
}

function GridTimeMarker({
  minutes,
  label,
  tone,
  title,
  zIndex,
}: {
  minutes: number
  label: string
  tone: MarkerTone
  title?: string
  zIndex: number
}) {
  const colors = MARKER_TONE[tone]
  return (
    <div
      className="agenda-marker"
      style={{ top: markerTop(minutes), zIndex }}
      title={title}
    >
      <div className="agenda-marker-line" style={{ background: colors.line }} />
      <span className="agenda-marker-label" style={{ color: colors.text }}>
        {label}
      </span>
    </div>
  )
}

interface SunTimes {
  sunriseMinutes: number
  sunsetMinutes: number
  sunriseLabel: string
  sunsetLabel: string
  cityName: string
}

interface GridItem {
  kind: "task" | "event" | "log" | "tracked" | "planned"
  id: string
  taskId?: string
  logId?: string
  event?: CalendarEvent
  planned?: PlannedAction
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
  maxHeight,
  onTaskClick,
  onEventClick,
  onCreateEvent,
  onScheduleTask,
  onScheduleHabit,
  onRescheduleEvent,
  onReschedulePlannedAction,
  onCreatePlannedAction,
  plannedActions,
  onPlannedActionClick,
  onUpdateTimeLog,
  onCreateTimeLog,
  trackedBlocks,
  onTrackedBlockClick,
  showCurrentTimeIndicator = true,
  showSunTimes = true,
  showAllDayBanners = true,
  scrollToMinutes,
}: AgendaGridProps) {
  const dragCreateStart = useRef<{ hour: number; minute: number } | null>(null)
  const dragCreateLast = useRef<{ hour: number; minute: number } | null>(null)
  const didDragCreate = useRef(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [dragHighlight, setDragHighlight] = useState<{ lo: number; hi: number } | null>(null)
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date()
    return n.getHours() * 60 + n.getMinutes()
  })
  const homeCity = useUserSettingsStore((s) => s.homeCity)
  const [sun, setSun] = useState<SunTimes | null>(null)

  const dayKey = formatLocalDateKey(date)
  const utcDayKey = formatDateKey(date)

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

  useEffect(() => {
    if (!showSunTimes) {
      setSun(null)
      return
    }
    let cancelled = false
    setSun(null)
    const city = homeCity.trim() || DEFAULT_HOME_CITY
    fetchDayClimate(city, formatLocalDateKey(date))
      .then((clim) => {
        if (cancelled || !clim?.sunrise || !clim?.sunset) return
        setSun({
          sunriseMinutes: minutesFromHhmm(clim.sunriseHhmm),
          sunsetMinutes: minutesFromHhmm(clim.sunsetHhmm),
          sunriseLabel: clim.sunrise,
          sunsetLabel: clim.sunset,
          cityName: clim.cityName || city,
        })
      })
      .catch(() => {
        if (!cancelled) setSun(null)
      })
    return () => {
      cancelled = true
    }
  }, [date, homeCity, showSunTimes])

  const dayEvents = useMemo(
    () => events.filter((event) => sameCalendarDay(event.date, date)),
    [events, date],
  )

  const timedEvents = dayEvents.filter((e) => !e.isAllDay)

  // All-day + multi-day events covering this day, rendered as banner rows above
  // the hour grid (HM1). Uses the event's full span via `endDate`.
  const bannerEvents = useMemo(
    () => (showAllDayBanners ? getBannerEvents(events, date) : []),
    [events, date, showAllDayBanners],
  )

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
      const coveredTodos = todoIdsCoveredByPlacements(plannedActions ?? [], date)
      for (const action of plannedActions ?? []) {
        if (action.date !== dayKey) continue
        items.push({
          kind: "planned",
          id: action.id,
          planned: action,
          taskId: action.source === "todo" ? action.sourceId : undefined,
          label: action.title,
          startMinutes: hhmmToMinutes(action.startTime),
          durationMinutes: plannedDurationMinutes(action),
          sublabel: action.notes || `${action.startTime}–${action.endTime}`,
        })
      }
      for (const task of tasks) {
        if (!task.scheduledTime) continue
        if (coveredTodos.has(task.id)) continue
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
          // Writers historically mixed UTC ISO keys with local calendar keys.
          if (log.date !== dayKey && log.date !== utcDayKey) continue
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
      for (const block of trackedBlocks ?? []) {
        items.push({
          kind: "tracked",
          id: block.id,
          label: block.label,
          startMinutes: block.startMinutes,
          durationMinutes: block.durationMinutes,
          color: block.color,
          sublabel: block.sublabel,
        })
      }
    }

    return items.sort((a, b) => a.startMinutes - b.startMinutes)
  }, [mode, tasks, timedEvents, dayKey, utcDayKey, trackedBlocks, plannedActions, date])

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    e.currentTarget.setAttribute("data-drop", "true")
  }

  const onDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.currentTarget.removeAttribute("data-drop")
  }

  const applyPlanPayload = useCallback(
    (payload: PlanDragPayload, hour: number, minute: number) => {
      if (payload.kind === "action" && mode === "plan" && onReschedulePlannedAction) {
        onReschedulePlannedAction(payload.id, hour, minute)
        return
      }
      if (payload.kind === "habit" && mode === "plan" && onScheduleHabit) {
        onScheduleHabit(payload.id, hour, minute)
        return
      }
      if (payload.kind === "task") {
        if (mode === "log" && onCreateTimeLog) onCreateTimeLog(payload.id, hour, minute)
        else if (mode === "plan" && onScheduleTask) onScheduleTask(payload.id, hour, minute)
        return
      }
      if (payload.kind === "event" && mode === "plan" && onRescheduleEvent) {
        onRescheduleEvent(payload.id, hour, minute)
      }
    },
    [mode, onCreateTimeLog, onRescheduleEvent, onReschedulePlannedAction, onScheduleHabit, onScheduleTask],
  )

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, hour: number) => {
    e.preventDefault()
    e.stopPropagation()
    e.currentTarget.removeAttribute("data-drop")
    const { minute } = dropPosition(e, hour)
    let logId = ""
    let logTaskId = ""
    try {
      logId = e.dataTransfer.getData("logId")
      logTaskId = e.dataTransfer.getData("logTaskId")
    } catch {
      logId = ""
      logTaskId = ""
    }

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

    const payload = readPlanDrag(e.dataTransfer)
    if (!payload) return
    applyPlanPayload(payload, hour, minute)
  }

  usePlanPointerDrop((payload, _clientX, clientY, target) => {
    const root = rootRef.current
    if (!root?.contains(target)) return
    const slot = target.closest(".agenda-slot")
    if (!(slot instanceof HTMLElement) || !root.contains(slot)) return
    const hour = Number(slot.dataset.hour)
    if (!Number.isFinite(hour)) return
    const { minute } = dropPosition({ currentTarget: slot, clientY }, hour)
    applyPlanPayload(payload, hour, minute)
  })

  const onTaskDragStart = (e: React.DragEvent, taskId: string) => {
    writePlanDrag(e.dataTransfer, "task", taskId)
  }

  const onEventDragStart = (e: React.DragEvent, eventId: string) => {
    writePlanDrag(e.dataTransfer, "event", eventId)
  }

  const onPlannedDragStart = (e: React.DragEvent, actionId: string) => {
    writePlanDrag(e.dataTransfer, "action", actionId)
  }

  const onLogDragStart = (e: React.DragEvent, taskId: string, logId: string) => {
    e.dataTransfer.setData("logId", logId)
    e.dataTransfer.setData("logTaskId", taskId)
    e.dataTransfer.effectAllowed = "move"
  }

  const itemsForHour = useCallback(
    (hour: number) => {
      const hourStart = hour * 60
      const hourEnd = hourStart + 60
      return gridItems.filter((item) => {
        const end = item.startMinutes + Math.max(1, item.durationMinutes)
        return item.startMinutes < hourEnd && end > hourStart
      })
    },
    [gridItems],
  )

  useLayoutEffect(() => {
    if (scrollToMinutes === undefined) return
    const root = rootRef.current
    if (!root) return
    root.scrollTop = planAgendaScrollTop(scrollToMinutes)
  }, [date, scrollToMinutes, bannerEvents.length])

  const showNowLine = showCurrentTimeIndicator && isToday(date)

  return (
    <div ref={rootRef} className={["agenda95", maxHeight].filter(Boolean).join(" ")}>
      {bannerEvents.length > 0 && (
        <div>
          {bannerEvents.map((event) => {
            const when = planEventTimeLabel(event)
            return (
              <div
                key={`banner-${event.id}`}
                className="agenda-banner"
                style={{ ["--plan-chip-color" as string]: resolvePlanColor(event.color) }}
                onClick={() => onEventClick?.(event)}
                title={`${when}  ${event.title}`}
              >
                <span className="agenda-banner-title">{event.title}</span>
                <span className="agenda-banner-when">{when}</span>
              </div>
            )
          })}
        </div>
      )}
      <div className="agenda-hours">
      {Array.from({ length: 24 }, (_, hour) => (
        <div key={hour} className="agenda-hour">
          <div className="agenda-gutter">{hour.toString().padStart(2, "0")}:00</div>
          <div
            className="agenda-slot"
            data-plan-drop="hour"
            data-hour={hour}
            data-drag={
              dragHighlight && hour >= dragHighlight.lo && hour <= dragHighlight.hi ? "true" : "false"
            }
            style={{ minHeight: HOUR_HEIGHT }}
            onDragEnter={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = "move"
              e.currentTarget.setAttribute("data-drop", "true")
            }}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={(e) => handleDrop(e, hour)}
            onMouseDown={(e) => {
              if (mode !== "plan") return
              if (!onCreateEvent && !onCreatePlannedAction) return
              if ((e.target as HTMLElement).closest(".agenda-block")) return
              const pos = dropPosition(e, hour)
              dragCreateStart.current = pos
              dragCreateLast.current = pos
              didDragCreate.current = false
              setDragHighlight({ lo: hour, hi: hour })
            }}
            onMouseEnter={(e) => {
              if (dragCreateStart.current !== null) {
                const pos = dropPosition(e, hour)
                if (pos.hour !== dragCreateStart.current.hour || pos.minute !== dragCreateStart.current.minute) {
                  didDragCreate.current = true
                }
                dragCreateLast.current = pos
                const lo = Math.min(dragCreateStart.current.hour, hour)
                const hi = Math.max(dragCreateStart.current.hour, hour)
                setDragHighlight({ lo, hi })
              }
            }}
            onMouseUp={() => {
              const start = dragCreateStart.current
              const last = dragCreateLast.current ?? start
              if (start && mode === "plan") {
                const startMin = start.hour * 60 + start.minute
                const endMin = last ? last.hour * 60 + last.minute : startMin
                const dragged = didDragCreate.current || Math.abs(endMin - startMin) >= SNAP_MINUTES
                if (dragged && onCreatePlannedAction) {
                  onCreatePlannedAction(date, startMin, endMin === startMin ? startMin + 60 : endMin)
                } else if (!dragged && onCreateEvent) {
                  onCreateEvent(date, start.hour)
                }
              }
              dragCreateStart.current = null
              dragCreateLast.current = null
              didDragCreate.current = false
              setDragHighlight(null)
            }}
          >
            {itemsForHour(hour)
              .filter((item) => item.kind !== "tracked")
              .map((item) => {
              const hourStart = hour * 60
              const hourEnd = hourStart + 60
              const itemEnd = item.startMinutes + Math.max(1, item.durationMinutes)
              const sliceStart = Math.max(item.startMinutes, hourStart)
              const sliceEnd = Math.min(itemEnd, hourEnd)
              const topOffset = (sliceStart - hourStart) * (HOUR_HEIGHT / 60)
              const height = Math.max(22, (sliceEnd - sliceStart) * (HOUR_HEIGHT / 60))
              const isLog = item.kind === "log"
              const isEvent = item.kind === "event"
              const isTracked = item.kind === "tracked"
              const isPlanned = item.kind === "planned"
              const draggable = !isTracked && (mode === "plan" || isLog || (mode === "log" && !!item.taskId))
              const continues = item.startMinutes < hourStart || itemEnd > hourEnd
              const chipColor = isTracked || (isEvent && !item.isGhost) ? item.color : undefined
              const isOpal = mode === "plan" && !isLog && !isTracked && !isPlanned && !item.isGhost

              return (
                <div
                  key={`${item.id}-${hour}`}
                  className={
                    isPlanned
                      ? "agenda-block agenda-block-planned"
                      : isOpal
                        ? "agenda-block agenda-block-opal"
                        : "agenda-block"
                  }
                  data-kind={item.kind}
                  style={{
                    top: topOffset,
                    height,
                    ["--plan-chip-color" as string]: isOpal
                      ? isEvent
                        ? resolvePlanColor(item.color)
                        : PLAN_TASK_COLOR
                      : undefined,
                    color: isOpal
                      ? undefined
                      : chipColor
                        ? "#fff"
                        : isLog
                          ? "#5c3b00"
                          : item.isGhost
                            ? "#404040"
                            : "#063",
                    backgroundColor: isOpal
                      ? undefined
                      : chipColor || (isLog ? "#f5e6b8" : item.isGhost ? "#f3f3f3" : "#cfe8d4"),
                    border: isOpal ? undefined : item.isGhost ? "1px dashed #808080" : "1px solid #808080",
                    zIndex: item.isGhost ? 1 : isTracked ? 12 : 10,
                  }}
                  draggable={draggable}
                  title={item.sublabel ? `${item.sublabel}  ${item.label}` : item.label}
                  onMouseDown={(e) => e.stopPropagation()}
                  onDragStart={(e) => {
                    if (isLog && item.taskId && item.logId) onLogDragStart(e, item.taskId, item.logId)
                    else if (isPlanned) onPlannedDragStart(e, item.id)
                    else if (isEvent) onEventDragStart(e, item.id)
                    else if (item.taskId) onTaskDragStart(e, item.taskId)
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (isPlanned && item.planned) onPlannedActionClick?.(item.planned)
                    else if (isTracked) onTrackedBlockClick?.(item.id)
                    else if (isEvent && item.event && (mode === "log" || !item.isGhost)) onEventClick?.(item.event)
                    else if (item.taskId && !item.isGhost) onTaskClick?.(item.taskId)
                    else if (item.taskId && item.isGhost && mode === "log") onTaskClick?.(item.taskId)
                  }}
                >
                  <div className="agenda-block-title">
                    <span>{item.label}</span>
                    {continues ? <span aria-hidden> …</span> : null}
                  </div>
                  {item.sublabel && sliceStart === item.startMinutes && (
                    <div className="agenda-block-sub">{item.sublabel}</div>
                  )}
                  {item.mustBeDoneBefore && (
                    <div className="agenda-block-sub">
                      must be done before {format(item.mustBeDoneBefore, "MMM d, h:mm a")}
                    </div>
                  )}
                  {item.location && <div className="agenda-block-sub">{item.location}</div>}
                </div>
              )
            })}
          </div>
        </div>
      ))}
      {gridItems
        .filter((item) => item.kind === "tracked")
        .map((item) => {
          const top = (item.startMinutes / 60) * HOUR_HEIGHT
          const height = Math.max(22, (Math.max(1, item.durationMinutes) / 60) * HOUR_HEIGHT)
          return (
            <button
              key={item.id}
              type="button"
              className="agenda-block agenda-span"
              style={{
                top,
                height,
                color: "#fff",
                backgroundColor: item.color || "#1e3a5c",
                border: "1px solid #808080",
              }}
              title={item.sublabel ? `${item.sublabel}  ${item.label}` : item.label}
              onClick={() => onTrackedBlockClick?.(item.id)}
            >
              <div className="agenda-block-title">{item.label}</div>
              {item.sublabel && <div className="agenda-block-sub">{item.sublabel}</div>}
            </button>
          )
        })}
      </div>

      {sun && (
        <>
          <GridTimeMarker
            minutes={sun.sunriseMinutes}
            label={`Sunrise ${sun.sunriseLabel}`}
            tone="sunrise"
            title={`Sunrise in ${sun.cityName}`}
            zIndex={18}
          />
          <GridTimeMarker
            minutes={sun.sunsetMinutes}
            label={`Sunset ${sun.sunsetLabel}`}
            tone="sunset"
            title={`Sunset in ${sun.cityName}`}
            zIndex={18}
          />
        </>
      )}
      {showNowLine && (
        <GridTimeMarker minutes={nowMinutes} label={minutesToTime(nowMinutes)} tone="now" zIndex={20} />
      )}
    </div>
  )
}
