/**
 * components/Home/Plan/day-view.tsx — Day calendar view
 *
 * Hour-by-hour day grid showing time-slotted tasks and events, the planned-tasks
 * rail (items for this day not yet given a time), and the auto-growing Day Plan
 * composer. Submit plan stamps the writing time onto an immutable entry; List /
 * Bulk / Latest choose how the log is shown (newest first). The schedule well
 * stretches with the Plan split column (matching a long rail) so it is not a
 * postage-stamp nested box over empty gray; hour rows keep 152px. The grid
 * lands on now or wake. Past hours carry a non-interactive outline of what
 * Tracking already logged for this day (the Day Log slabs). Later hours stay clear.
 *
 * Spec: §7.4 (Day View).
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { format, addDays, subDays } from "date-fns"
import type { CalendarEvent } from "@/lib/types"
import { formatLocalDateKey, isToday, toLocalCalendarDate } from "@/lib/date-utils"
import { tasksScheduledOnCalendarDay } from "@/lib/item-slices"
import { getBannerEvents } from "@/lib/event-links"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { MINUTES_PER_DAY } from "@/lib/time-entries"
import { itemTitle } from "@/lib/item-utils"
import { habitScheduleMinutes } from "@/lib/habit-time-estimate"
import {
  movePlacement,
  placementFromDragRange,
  placementFromDrop,
  type PlannedAction,
} from "@/lib/planned-actions"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { DEFAULT_WAKE_MIN, firstUnpaintedWakingHour } from "@/components/Home/Tracking/waking-scroll"
import { PlannedTasksSidebar } from "./planned-tasks-sidebar"
import { AgendaGrid } from "./agenda-grid"
import { PlanChip, planChipTooltip, planEventTimeLabel } from "./plan-chip"
import { PlanPeriodNav } from "./plan-period-nav"
import { PlanTextLog, planPeriodStampProps } from "./plan-text-log"
import { PlannedActionDialog } from "./planned-action-dialog"
import { planDayTrackedGhosts } from "./plan-tracked-ghosts"

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
  const dayTasks = useTaskStore((s) => tasksScheduledOnCalendarDay(s.tasks, currentDate))
  const updateTask = useTaskStore((s) => s.updateTask)
  const updateEvent = useEventStore((s) => s.updateEvent)
  const habits = useHabitsStore((s) => s.tasks)
  const plannedActions = usePlannedActionStore((s) => s.actions)
  const upsertSourcePlacement = usePlannedActionStore((s) => s.upsertSourcePlacement)
  const updatePlannedAction = usePlannedActionStore((s) => s.updateAction)
  const deleteForSource = usePlannedActionStore((s) => s.deleteForSource)
  const deletePlannedAction = usePlannedActionStore((s) => s.deleteAction)
  const nights = useSleepStore((s) => s.nights)
  const trackingEntries = useTimeTrackingStore((s) => s.entries)
  const trackingScopes = useTimeTrackingStore((s) => s.scopes)
  const activeScopeId = useTimeTrackingStore((s) => s.activeScopeId)
  const dayKey = formatLocalDateKey(currentDate)
  const [editingPlacement, setEditingPlacement] = useState<PlannedAction | null>(null)
  const [ghostNow, setGhostNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setGhostNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const trackedGhosts = useMemo(() => {
    const scope = trackingScopes.find((row) => row.id === activeScopeId) ?? trackingScopes[0]
    return planDayTrackedGhosts({
      entries: trackingEntries,
      scope,
      scopes: trackingScopes,
      dayKey,
      viewedDay: currentDate,
      now: ghostNow,
    })
  }, [trackingEntries, trackingScopes, activeScopeId, dayKey, currentDate, ghostNow])

  const scrollToMinutes = useMemo(() => {
    if (isToday(currentDate)) {
      const n = new Date()
      return n.getHours() * 60 + n.getMinutes()
    }
    const awake = awakeWindowFor(dayKey, currentDate)
    const hour = firstUnpaintedWakingHour({
      map: Array.from({ length: MINUTES_PER_DAY }, () => null),
      wakeMin: awake?.wake ?? DEFAULT_WAKE_MIN,
      bedMin: awake?.bed,
    })
    return hour * 60
  }, [currentDate, dayKey, nights, trackingEntries])

  const allDayEvents = getBannerEvents(events, currentDate)

  const handleScheduleTask = (taskId: string, hour: number, minute: number) => {
    const task = useTaskStore.getState().tasks.find((t) => t.id === taskId)
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
    const placed = upsertSourcePlacement(
      placementFromDrop({
        date: dayKey,
        hour,
        minute,
        durationMinutes: task.estimatedDuration ?? 30,
        source: "todo",
        sourceId: task.id,
        title: itemTitle(task),
      }),
    )
    setEditingPlacement(placed)
  }

  const handleScheduleHabit = (habitId: string, hour: number, minute: number) => {
    const habit = habits.find((row) => row.id === habitId)
    const durationMinutes = habitScheduleMinutes(habit)
    if (durationMinutes == null) return
    const placed = upsertSourcePlacement(
      placementFromDrop({
        date: dayKey,
        hour,
        minute,
        durationMinutes,
        source: "habit",
        sourceId: habitId,
        title: habit?.name ?? "Habit",
      }),
    )
    setEditingPlacement(placed)
  }

  const handleCreatePlannedAction = (date: Date, startMinutes: number, endMinutes: number) => {
    const placed = upsertSourcePlacement(
      placementFromDragRange({
        date: formatLocalDateKey(date),
        startMinutes,
        endMinutes,
      }),
    )
    setEditingPlacement(placed)
  }

  const handleReschedulePlannedAction = (actionId: string, hour: number, minute: number) => {
    const action = plannedActions.find((row) => row.id === actionId)
    if (!action) return
    const next = movePlacement(action, hour, minute)
    updatePlannedAction(next)
    if (action.source === "todo" && action.sourceId) {
      const task = useTaskStore.getState().tasks.find((t) => t.id === action.sourceId)
      if (task) {
        updateTask({
          ...task,
          scheduledDate: new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), hour, minute),
          scheduledTime: next.startTime,
        })
      }
    }
  }

  const handleUnscheduleTask = (taskId: string) => {
    const task = useTaskStore.getState().tasks.find((t) => t.id === taskId)
    if (!task) return
    updateTask({ ...task, scheduledTime: undefined })
    deleteForSource(dayKey, "todo", taskId)
  }

  const handleUnschedulePlannedAction = (actionId: string) => {
    const action = plannedActions.find((row) => row.id === actionId)
    if (!action) return
    if (action.source === "todo" && action.sourceId) handleUnscheduleTask(action.sourceId)
    else deletePlannedAction(actionId)
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
    <div className="plan-split plan-split-day">
      <PlannedTasksSidebar
        mode="day"
        currentDate={currentDate}
        onTaskClick={onTaskClick}
        onUnscheduleTask={handleUnscheduleTask}
        onUnscheduleEvent={handleUnscheduleEvent}
        onUnschedulePlannedAction={handleUnschedulePlannedAction}
      />

      <div className="plan-desktop plan-desktop-day">
        <PlanPeriodNav
          label={format(currentDate, "EEEE, MMMM d, yyyy")}
          previousLabel="Previous day"
          nextLabel="Next day"
          onPrevious={() => setCurrentDate(subDays(currentDate, 1))}
          onNext={() => setCurrentDate(addDays(currentDate, 1))}
          onToday={() => setCurrentDate(new Date())}
        />

        {allDayEvents.length > 0 && (
          <div className="plan-banners">
            {allDayEvents.map((event) => {
              const timeLabel = planEventTimeLabel(event)
              return (
                <PlanChip
                  key={event.id}
                  timeLabel={timeLabel}
                  title={event.title}
                  color={event.color}
                  tooltip={planChipTooltip(timeLabel, event.title, event.location)}
                  onClick={() => onEventClick(event)}
                  jewel
                />
              )
            })}
          </div>
        )}

        <div className="plan-schedule-well">
          <fieldset
            className="plan-group plan-group-schedule"
            data-ui-name="Day schedule"
            data-ui-help="Hour-by-hour agenda for the selected day — not the Day Plan log."
            data-ui-docs="components/Home/Plan/README.md"
            data-ui-docs-anchor="day"
            data-plan-agenda-fill="column"
          >
            <legend>Schedule</legend>
            <AgendaGrid
              date={currentDate}
              events={events}
              tasks={dayTasks}
              mode="plan"
              scrollToMinutes={scrollToMinutes}
              onTaskClick={onTaskClick}
              onEventClick={onEventClick}
              onCreateEvent={onCreateEvent}
              onCreatePlannedAction={handleCreatePlannedAction}
              onScheduleTask={handleScheduleTask}
              onScheduleHabit={handleScheduleHabit}
              onRescheduleEvent={handleRescheduleEvent}
              onReschedulePlannedAction={handleReschedulePlannedAction}
              plannedActions={plannedActions}
              onPlannedActionClick={setEditingPlacement}
              trackedGhosts={trackedGhosts}
              showCurrentTimeIndicator
              showAllDayBanners={false}
            />
          </fieldset>
        </div>

        <fieldset className="plan-group" {...planPeriodStampProps("day")}>
          <legend>Day Plan — {format(currentDate, "MMMM dd, yyyy")}</legend>
          <PlanTextLog
            period="day"
            periodKey={dayKey}
            placeholder="Write your day plan, goals, and objectives..."
            size="day"
          />
        </fieldset>
      </div>
      <PlannedActionDialog
        open={!!editingPlacement}
        onOpenChange={(open) => {
          if (!open) setEditingPlacement(null)
        }}
        action={editingPlacement}
      />
    </div>
  )
}
