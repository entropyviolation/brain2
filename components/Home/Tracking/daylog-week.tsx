/**
 * components/Home/Tracking/daylog-week.tsx — Day Log week of plan vs tracked
 *
 * Seven columns for the week containing `currentDate`. Same data rules as the
 * single-day Day Log (painted tracking, dashed plan, amber task timeLogs) —
 * not the Time Grid paint week. Date headings open that day in day mode.
 */
"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import type { CalendarEvent, Task, TimeLogEntry } from "@/lib/types"
import {
  formatDateKey,
  formatLocalDateKey,
  getWeekDates,
  getWeekStartDate,
  sameCalendarDay,
} from "@/lib/date-utils"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { displayedPen, findPen, useTimeTrackingStore, type TrackScope } from "@/lib/time-tracking-store"
import {
  assignedPenIds,
  entriesForDay,
  entryDisplayName,
  formatDuration,
  minutesToLabel,
  timeStringToMinutes,
  type TimeEntry,
} from "@/lib/time-entries"
import { useCurrentDate } from "@/lib/use-current-date"
import "./daylog-week.css"

const HOUR_H = 28
const HOURS = Array.from({ length: 24 }, (_, hour) => hour)

function logMatchesDay(logDate: string, day: Date): boolean {
  return logDate === formatLocalDateKey(day) || logDate === formatDateKey(day)
}

type TrackedChip = {
  id: string
  label: string
  startMinutes: number
  durationMinutes: number
  color?: string
  sublabel?: string
}

function trackedChipsForDay(day: Date, entries: TimeEntry[], scope: TrackScope | undefined): TrackedChip[] {
  if (!scope) return []
  const dayKey = formatLocalDateKey(day)
  return entriesForDay(entries, dayKey, scope.id).map((entry) => {
    const pen = displayedPen(scope, entry.penId) ?? findPen([scope], entry.penId)
    const leaf = findPen([scope], entry.penId)
    const assumed = entry.precision === "estimated"
    const extra = assignedPenIds(entry)
      .slice(1)
      .map((id) => findPen([scope], id)?.name)
      .filter(Boolean)
    return {
      id: entry.id,
      label: `${entryDisplayName(entry, leaf?.name || pen?.name || "Tracked")}${assumed ? " ≈" : ""}`,
      startMinutes: entry.startMin,
      durationMinutes: Math.max(1, entry.endMin - entry.startMin),
      color: pen?.color,
      sublabel: `${minutesToLabel(entry.startMin)}–${minutesToLabel(entry.endMin)} · ${formatDuration(entry.endMin - entry.startMin)}${
        leaf && leaf.id !== pen?.id ? ` · ${leaf.name}` : ""
      }${extra.length ? ` · also ${extra.join(", ")}` : ""}${assumed ? " · assumed" : ""}`,
    }
  })
}

export function DayLogWeek({
  currentDate,
  onOpenDay,
  onTrackedBlockClick,
  onTaskClick,
  onEventClick,
}: {
  currentDate: Date
  onOpenDay: (date: Date) => void
  onTrackedBlockClick: (id: string) => void
  onTaskClick: (task: Task, date: Date) => void
  onEventClick: (event: CalendarEvent, date: Date) => void
}) {
  const { currentDate: today } = useCurrentDate()
  const tasks = useTaskStore((s) => s.tasks)
  const events = useEventStore((s) => s.events)
  const trackingScopes = useTimeTrackingStore((s) => s.scopes)
  const trackingEntries = useTimeTrackingStore((s) => s.entries)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const confirmedEventIds = useTimeTrackingStore((s) => s.confirmedEventIds)
  const trackingScope = trackingScopes.find((s) => s.id === activeScopeId) ?? trackingScopes[0]

  const weekStart = getWeekStartDate(currentDate)
  const weekDates = getWeekDates(weekStart)

  const columns = useMemo(() => {
    return weekDates.map((date) => {
      const planned = tasks.filter((t) => !t.completed && t.scheduledDate && sameCalendarDay(t.scheduledDate, date))
      const dayEvents = events.filter((e) => sameCalendarDay(e.date, date) && !confirmedEventIds.includes(e.id))
      const tracked = trackedChipsForDay(date, trackingEntries, trackingScope)
      const logs: { task: Task; log: TimeLogEntry }[] = []
      for (const task of tasks) {
        for (const log of task.timeLogs || []) {
          if (logMatchesDay(log.date, date)) logs.push({ task, log })
        }
      }
      return {
        date,
        dayKey: formatLocalDateKey(date),
        plannedTimed: planned.filter((t) => t.scheduledTime),
        plannedUntimed: planned.filter((t) => !t.scheduledTime),
        dayEvents,
        tracked,
        logs,
        isToday: sameCalendarDay(date, today),
      }
    })
  }, [weekDates, tasks, events, confirmedEventIds, trackingEntries, trackingScope, today])

  return (
    <div className="daylog-week" data-testid="daylog-week">
      <div className="daylog-week-head-row">
        <div className="daylog-week-corner" aria-hidden />
        {columns.map((col) => (
          <button
            key={`head-${col.dayKey}`}
            type="button"
            className="daylog-week-head"
            data-day={col.dayKey}
            data-today={col.isToday ? "true" : "false"}
            aria-label={`Open ${format(col.date, "EEEE, MMM d")}`}
            onClick={() => onOpenDay(col.date)}
          >
            <span className="daylog-week-head-dow">{format(col.date, "EEE")}</span>
            <span className="daylog-week-head-dom">{format(col.date, "d")}</span>
          </button>
        ))}
      </div>

      <div className="daylog-week-untimed-row">
        <div className="daylog-week-corner" aria-hidden />
        {columns.map((col) => (
          <div key={`untimed-${col.dayKey}`} className="daylog-week-untimed" data-day={col.dayKey}>
            {col.plannedUntimed.map((task) => (
              <button
                key={task.id}
                type="button"
                className="daylog-week-chip daylog-week-chip--planned"
                title={task.description}
                onClick={() => onTaskClick(task, col.date)}
              >
                {task.description}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="daylog-week-body">
        <div className="daylog-week-hours" aria-hidden>
          {HOURS.map((hour) => (
            <div key={hour} className="daylog-week-gutter" style={{ height: HOUR_H }}>
              {hour.toString().padStart(2, "0")}:00
            </div>
          ))}
        </div>

        {columns.map((col) => (
          <div
            key={`plot-${col.dayKey}`}
            className="daylog-week-plot"
            data-day={col.dayKey}
            data-today={col.isToday ? "true" : "false"}
            style={{ height: 24 * HOUR_H }}
          >
            {HOURS.map((hour) => (
              <div key={hour} className="daylog-week-hour" style={{ height: HOUR_H }} aria-hidden />
            ))}

            {col.tracked.map((block) => (
              <button
                key={block.id}
                type="button"
                className="daylog-week-block daylog-week-block--tracked"
                title={`${block.label}${block.sublabel ? ` · ${block.sublabel}` : ""}`}
                style={{
                  top: (block.startMinutes / 60) * HOUR_H,
                  height: Math.max(10, (block.durationMinutes / 60) * HOUR_H),
                  background: block.color || "#808080",
                }}
                onClick={() => onTrackedBlockClick(block.id)}
              >
                <span className="daylog-week-block-title">{block.label}</span>
                {block.sublabel ? <span className="daylog-week-block-sub">{block.sublabel}</span> : null}
              </button>
            ))}

            {col.dayEvents.map((event) => {
              const start = timeStringToMinutes(event.startTime) ?? 9 * 60
              const end = timeStringToMinutes(event.endTime) ?? start + 60
              const duration = Math.max(1, (end === 0 ? 1440 : end) - start)
              return (
                <button
                  key={event.id}
                  type="button"
                  className="daylog-week-block daylog-week-block--planned"
                  title={`${event.startTime}–${event.endTime} ${event.title}`}
                  style={{
                    top: (start / 60) * HOUR_H,
                    height: Math.max(10, (duration / 60) * HOUR_H),
                  }}
                  onClick={() => onEventClick(event, col.date)}
                >
                  <span className="daylog-week-block-title">{event.title}</span>
                  <span className="daylog-week-block-sub">
                    {event.startTime}–{event.endTime}
                  </span>
                </button>
              )
            })}

            {col.plannedTimed.map((task) => {
              const start = timeStringToMinutes(task.scheduledTime ?? "") ?? 9 * 60
              const duration = task.estimatedDuration ?? 30
              return (
                <button
                  key={task.id}
                  type="button"
                  className="daylog-week-block daylog-week-block--planned"
                  title={`${task.scheduledTime} ${task.description}`}
                  style={{
                    top: (start / 60) * HOUR_H,
                    height: Math.max(10, (duration / 60) * HOUR_H),
                  }}
                  onClick={() => onTaskClick(task, col.date)}
                >
                  <span className="daylog-week-block-title">{task.description}</span>
                  {(task.estimatedDuration ?? 0) > 0 ? (
                    <span className="daylog-week-block-sub">{task.estimatedDuration}m</span>
                  ) : null}
                </button>
              )
            })}

            {col.logs.map(({ task, log }) => {
              const start =
                timeStringToMinutes(log.startTime || "") ??
                timeStringToMinutes(task.scheduledTime ?? "") ??
                12 * 60
              const duration = Math.max(1, log.durationMinutes)
              return (
                <button
                  key={log.id}
                  type="button"
                  className="daylog-week-block daylog-week-block--log"
                  title={`${log.activityLabel || task.description} · ${duration}m`}
                  style={{
                    top: (start / 60) * HOUR_H,
                    height: Math.max(10, (duration / 60) * HOUR_H),
                  }}
                  onClick={() => onTaskClick(task, col.date)}
                >
                  <span className="daylog-week-block-title">{log.activityLabel || task.description}</span>
                  <span className="daylog-week-block-sub">{duration}m</span>
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}
