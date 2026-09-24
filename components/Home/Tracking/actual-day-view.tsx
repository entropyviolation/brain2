/**
 * components/Home/Tracking/actual-day-view.tsx — Plan vs what Tracking recorded
 *
 * Day mode: one hour grid. Ghosts are the Plan (scheduled tasks and events).
 * Solid colored blocks are the same painted intervals the Time Grid and Activity
 * Log use — so anything tracked there shows up here without a second input. A
 * stretch that covers several hours is **one continuous slab** (position + height
 * spanning the hour grid, title once) while remaining clickable in every hour.
 * Amber blocks are task `timeLogs`, the separate "how long did this planned
 * task take" record that Plan vs Reality / Calibration score against.
 *
 * Week mode: seven compact columns for the week of `currentDate` with the same
 * plan-vs-tracked vocabulary (not the Time Grid paint week). Date headings open
 * that day back in day mode.
 *
 * There is no nested Activity Log. That tab was a second, empty list of
 * planned hours that did not read Tracking, which made the day look blank
 * after the grid had already been painted. Clicking a painted block opens
 * the same block editor as the other two views.
 *
 * Occupancy still comes from `lib/tracking-summary.ts`. Date keys are local
 * calendar days, matching the grid — a UTC ISO key would show a different
 * (often empty) day after evening in a negative-offset zone.
 */
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useTaskStore } from "@/lib/task-store"
import { rememberWorld } from "@/lib/action-history"
import { useEventStore } from "@/lib/event-store"
import {
  formatDateKey,
  formatLocalDateKey,
  getWeekDates,
  getWeekStartDate,
  sameCalendarDay,
} from "@/lib/date-utils"
import { format, addDays, addWeeks, subDays, subWeeks } from "date-fns"
import type { CalendarEvent, Task, TimeLogEntry } from "@/lib/types"
import { AgendaGrid } from "@/components/Home/Plan/agenda-grid"
import { EntryDialog } from "@/components/Home/Tracking/entry-dialog"
import { ConfirmPlannedDialog } from "@/components/Home/Tracking/confirm-planned-dialog"
import { ScreenTimeEmptyHint } from "@/components/Home/Tracking/screentime-empty-hint"
import { TrackingPeriodNav } from "@/components/Home/Tracking/tracking-period-nav"
import { DayLogWeek } from "@/components/Home/Tracking/daylog-week"
import { displayedPen, findPen, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { assignedPenIds, entriesForDay, entryDisplayName, formatDuration, minutesToLabel, timeStringToMinutes } from "@/lib/time-entries"
import { penTotals, totalsFor } from "@/lib/tracking-summary"
import { usePenActionSync } from "@/lib/pen-action-sync"
import "./tracking-chrome.css"
import "./daylog-week.css"

function rid() {
  return `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function logMatchesDay(logDate: string, day: Date): boolean {
  return logDate === formatLocalDateKey(day) || logDate === formatDateKey(day)
}

export function ActualDayView({
  currentDate: controlledDate,
  setCurrentDate: setControlledDate,
}: {
  currentDate?: Date
  setCurrentDate?: (date: Date) => void
} = {}) {
  usePenActionSync()
  const [internalDate, setInternalDate] = useState(new Date())
  const currentDate = controlledDate ?? internalDate
  const setCurrentDate = setControlledDate ?? setInternalDate
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const events = useEventStore((s) => s.events)
  const trackingScopes = useTimeTrackingStore((s) => s.scopes)
  const trackingEntries = useTimeTrackingStore((s) => s.entries)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const dayKey = formatLocalDateKey(currentDate)

  const trackingScope = trackingScopes.find((s) => s.id === activeScopeId) ?? trackingScopes[0]
  const confirmedEventIds = useTimeTrackingStore((s) => s.confirmedEventIds)
  const paintedEntries = useMemo(
    () => (trackingScope ? entriesForDay(trackingEntries, dayKey, trackingScope.id) : []),
    [trackingEntries, dayKey, trackingScope],
  )
  const paintedTotals = useMemo(
    () => totalsFor(paintedEntries, [dayKey]),
    [paintedEntries, dayKey],
  )
  const paintedPens = useMemo(
    () => penTotals(paintedEntries, trackingScope, [dayKey]),
    [paintedEntries, trackingScope, dayKey],
  )
  const trackedBlocks = useMemo(
    () =>
      paintedEntries.map((entry) => {
        const pen = trackingScope ? displayedPen(trackingScope, entry.penId) ?? findPen([trackingScope], entry.penId) : undefined
        const leaf = trackingScope ? findPen([trackingScope], entry.penId) : undefined
        const assumed = entry.precision === "estimated"
        const extra = trackingScope
          ? assignedPenIds(entry)
              .slice(1)
              .map((id) => findPen([trackingScope], id)?.name)
              .filter(Boolean)
          : []
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
      }),
    [paintedEntries, trackingScope],
  )

  const plannedTasks = useMemo(
    () => tasks.filter((t) => !t.completed && t.scheduledDate && sameCalendarDay(t.scheduledDate, currentDate)),
    [tasks, currentDate],
  )

  const dayEvents = useMemo(
    () => events.filter((e) => sameCalendarDay(e.date, currentDate) && !confirmedEventIds.includes(e.id)),
    [events, currentDate, confirmedEventIds],
  )

  const allDayLogs = useMemo(() => {
    const logs: { task: Task; log: TimeLogEntry }[] = []
    for (const task of tasks) {
      for (const log of task.timeLogs || []) {
        if (logMatchesDay(log.date, currentDate)) logs.push({ task, log })
      }
    }
    return logs.sort((a, b) => (a.log.startTime || "").localeCompare(b.log.startTime || ""))
  }, [tasks, currentDate])

  const [loggingTaskId, setLoggingTaskId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<{
    task?: Task
    event?: CalendarEvent
    startMin: number
    endMin: number
    dateKey: string
  } | null>(null)
  const [logMinutes, setLogMinutes] = useState("30")
  const [logLocation, setLogLocation] = useState("")
  const [logNotes, setLogNotes] = useState("")
  const [openEntryId, setOpenEntryId] = useState<string | null>(null)
  const [span, setSpan] = useState<"day" | "week">("day")

  const weekStart = getWeekStartDate(currentDate)
  const weekDates = getWeekDates(weekStart)
  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekDates[6], "MMM d, yyyy")}`
  const isWeek = span === "week"

  const logActualTime = (task: Task) => {
    const mins = Number.parseInt(logMinutes) || 0
    if (mins <= 0) return
    const entry: TimeLogEntry = {
      id: rid(),
      date: dayKey,
      durationMinutes: mins,
      notes: logNotes.trim() || undefined,
      location: logLocation.trim() || undefined,
      taskId: task.id,
      activityLabel: task.description,
    }
    const logs = [...(task.timeLogs || []), entry]
    const totalActual = logs.reduce((s, l) => s + l.durationMinutes, 0)
    rememberWorld("day log")
    updateTask({ ...task, timeLogs: logs, actualDuration: totalActual })
    setLoggingTaskId(null)
    setLogMinutes("30")
    setLogLocation("")
    setLogNotes("")
  }

  const handleCreateTimeLog = (taskId: string, hour: number, minute: number) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const duration = task.estimatedDuration ?? 30
    const startTotal = hour * 60 + minute
    const endTotal = startTotal + duration
    const fmt = (m: number) =>
      `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`
    const entry: TimeLogEntry = {
      id: rid(),
      date: dayKey,
      startTime: fmt(startTotal),
      endTime: fmt(endTotal),
      durationMinutes: duration,
      taskId: task.id,
      activityLabel: task.description,
    }
    const logs = [...(task.timeLogs || []), entry]
    const totalActual = logs.reduce((s, l) => s + l.durationMinutes, 0)
    rememberWorld("day log")
    updateTask({ ...task, timeLogs: logs, actualDuration: totalActual })
  }

  const handleUpdateTimeLog = (taskId: string, logId: string, updates: Partial<TimeLogEntry>) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    const logs = (task.timeLogs || []).map((l) => (l.id === logId ? { ...l, ...updates } : l))
    const totalActual = logs.reduce((s, l) => s + l.durationMinutes, 0)
    rememberWorld("day log")
    updateTask({ ...task, timeLogs: logs, actualDuration: totalActual })
  }

  const totalLogged = allDayLogs.reduce((s, { log }) => s + log.durationMinutes, 0)
  const totalEstimated = plannedTasks.reduce((s, t) => s + (t.estimatedDuration || 0), 0)
  const openEntry = openEntryId ? trackingEntries.find((e) => e.id === openEntryId) : undefined
  const untimedTasks = plannedTasks.filter((t) => !t.scheduledTime)

  const openConfirmForTask = (task: Task, onDate: Date = currentDate) => {
    const start = timeStringToMinutes(task.scheduledTime ?? "") ?? 9 * 60
    const end = start + (task.estimatedDuration ?? 30)
    setConfirming({
      task,
      startMin: start,
      endMin: Math.min(1440, end),
      dateKey: formatLocalDateKey(onDate),
    })
  }

  const openConfirmForEvent = (event: CalendarEvent, onDate: Date = currentDate) => {
    const start = timeStringToMinutes(event.startTime) ?? 9 * 60
    const end = timeStringToMinutes(event.endTime) ?? start + 60
    setConfirming({
      event,
      startMin: start,
      endMin: end === 0 ? 1440 : end,
      dateKey: formatLocalDateKey(onDate),
    })
  }

  const openDayFromWeek = (date: Date) => {
    setCurrentDate(date)
    setSpan("day")
  }

  return (
    <div className="trk95 trk-canvas trk-daylog">
      <TrackingPeriodNav
        label={isWeek ? weekLabel : format(currentDate, "EEEE, MMMM d, yyyy")}
        previousLabel={isWeek ? "Previous week" : "Previous day"}
        nextLabel={isWeek ? "Next week" : "Next day"}
        onPrevious={() => setCurrentDate(isWeek ? subWeeks(currentDate, 1) : subDays(currentDate, 1))}
        onNext={() => setCurrentDate(isWeek ? addWeeks(currentDate, 1) : addDays(currentDate, 1))}
        onToday={() => setCurrentDate(new Date())}
        meta={`Planned ${totalEstimated}m · task logs ${totalLogged}m`}
      />

      {trackingScope && (
        <div className="trk-daylog-paint">
          <span>Painted in {trackingScope.name}</span>
          <strong>{formatDuration(paintedTotals.tracked)}</strong>
          <span>{Math.round(paintedTotals.coverage)}% of the day</span>
          {paintedPens.slice(0, 5).map((pen) => (
            <span key={pen.id} className="trk-daylog-pen">
              <span className="trk-log-pad" style={{ background: pen.color }} aria-hidden />
              {pen.name} {formatDuration(pen.minutes)}
            </span>
          ))}
        </div>
      )}

      {trackingScope && paintedTotals.tracked === 0 && (
        <ScreenTimeEmptyHint date={dayKey} scopeId={trackingScope.id} />
      )}

      <div className="trk-daylog-sheet">
        <div className="daylog-week-switch trk-span-switch" role="toolbar" aria-label="Day Log span">
          <button type="button" aria-pressed={!isWeek} onClick={() => setSpan("day")}>
            Day
          </button>
          <button type="button" aria-pressed={isWeek} onClick={() => setSpan("week")}>
            Week
          </button>
        </div>
        <p className="trk-silk">Plan vs tracked</p>
        <p className="trk-daylog-caption">
          Solid color is tracked. Dashed is planned — click to confirm it happened. Amber is time logged onto a
          planned task.
        </p>
        {isWeek ? (
          <DayLogWeek
            currentDate={currentDate}
            onOpenDay={openDayFromWeek}
            onTrackedBlockClick={setOpenEntryId}
            onTaskClick={(task, date) => openConfirmForTask(task, date)}
            onEventClick={(event, date) => openConfirmForEvent(event, date)}
          />
        ) : (
          <AgendaGrid
            date={currentDate}
            events={dayEvents}
            tasks={plannedTasks}
            mode="log"
            maxHeight="max-h-[720px]"
            trackedBlocks={trackedBlocks}
            onTrackedBlockClick={setOpenEntryId}
            onTaskClick={(id) => {
              const task = plannedTasks.find((t) => t.id === id) || tasks.find((t) => t.id === id)
              if (!task) return
              openConfirmForTask(task)
            }}
            onEventClick={openConfirmForEvent}
            onCreateTimeLog={handleCreateTimeLog}
            onUpdateTimeLog={handleUpdateTimeLog}
            showCurrentTimeIndicator
          />
        )}
      </div>

      {!isWeek && untimedTasks.length > 0 && (
        <div className="trk-aside-well trk-daylog-untimed">
          <p className="trk-silk">Untimed tasks</p>
          {untimedTasks.map((task) => (
            <div key={task.id} className="trk-daylog-untimed-row">
              <span>{task.description} (unscheduled)</span>
              <button type="button" className="trk-latch" onClick={() => setLoggingTaskId(task.id)}>
                Log time
              </button>
            </div>
          ))}
        </div>
      )}

      {!isWeek && allDayLogs.length > 0 && (
        <div className="trk-aside-well trk-daylog-tasklogs">
          <p className="trk-silk">Time logged onto tasks</p>
          {allDayLogs.map(({ task, log }) => (
            <div key={log.id} className="trk-daylog-tasklog">
              <span className="trk-log-pad" aria-hidden />
              <span className="font-medium">{log.activityLabel || task.description}</span>
              <span className="trk-daylog-tasklog-meta">
                {log.startTime && `${log.startTime}–${log.endTime || ""} · `}
                {log.durationMinutes}m
                {log.notes && ` — ${log.notes}`}
              </span>
            </div>
          ))}
        </div>
      )}

      {loggingTaskId &&
        (() => {
          const task = plannedTasks.find((t) => t.id === loggingTaskId) || tasks.find((t) => t.id === loggingTaskId)
          if (!task) return null
          return (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Log actual time — {task.description}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Actual duration (minutes)</Label>
                  <Input type="number" value={logMinutes} onChange={(e) => setLogMinutes(e.target.value)} />
                </div>
                <div>
                  <Label>Location (at time of activity — not assumed from plan)</Label>
                  <Input
                    value={logLocation}
                    onChange={(e) => setLogLocation(e.target.value)}
                    placeholder="Where were you?"
                  />
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea value={logNotes} onChange={(e) => setLogNotes(e.target.value)} rows={2} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => logActualTime(task)}>Confirm log</Button>
                  <Button variant="outline" onClick={() => setLoggingTaskId(null)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })()}

      {openEntry && <EntryDialog entry={openEntry} onClose={() => setOpenEntryId(null)} />}
      {confirming && trackingScope && (
        <ConfirmPlannedDialog
          dateKey={confirming.dateKey}
          scopeId={trackingScope.id}
          task={confirming.task}
          event={confirming.event}
          startMin={confirming.startMin}
          endMin={confirming.endMin}
          onClose={() => setConfirming(null)}
        />
      )}
    </div>
  )
}
