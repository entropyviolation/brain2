/**
 * components/Home/Plan/day-view.tsx — Day calendar view
 *
 * Hour-by-hour day grid showing time-slotted tasks and events, the planned-tasks
 * rail (items for this day not yet given a time), and the auto-growing Day Plan
 * composer. Submit plan stamps the writing time onto an immutable entry; List /
 * Bulk / Latest choose how the log is shown (newest first). The schedule well
 * stretches with the Plan split column (matching a long rail) so it is not a
 * postage-stamp nested box over empty gray; hour rows keep 152px. The grid
 * lands on now or wake.
 *
 * Spec: §7.4 (Day View).
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { format, addDays, subDays } from "date-fns"
import type { CalendarEvent } from "@/lib/types"
import { formatLocalDateKey, isToday, sameCalendarDay, toLocalCalendarDate } from "@/lib/date-utils"
import { getBannerEvents } from "@/lib/event-links"
import { awakeWindowFor } from "@/lib/sleep-sync"
import { MINUTES_PER_DAY } from "@/lib/time-entries"
import { itemTitle } from "@/lib/item-utils"
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
import { PlanTextLog, planPeriodStampProps } from "./plan-text-log"
import { PlannedActionDialog } from "./planned-action-dialog"

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
  const habits = useHabitsStore((s) => s.tasks)
  const plannedActions = usePlannedActionStore((s) => s.actions)
  const upsertSourcePlacement = usePlannedActionStore((s) => s.upsertSourcePlacement)
  const updatePlannedAction = usePlannedActionStore((s) => s.updateAction)
  const deleteForSource = usePlannedActionStore((s) => s.deleteForSource)
  const deletePlannedAction = usePlannedActionStore((s) => s.deleteAction)
  const nights = useSleepStore((s) => s.nights)
  const trackingEntries = useTimeTrackingStore((s) => s.entries)
  const dayKey = formatLocalDateKey(currentDate)
  const [editingPlacement, setEditingPlacement] = useState<PlannedAction | null>(null)

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

  const getScheduledTasks = (date: Date) => {
    return tasks.filter((task) => {
      if (!task.scheduledDate) return false
      return sameCalendarDay(task.scheduledDate, date)
    })
  }

  const dayTasks = getScheduledTasks(currentDate)
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
    const placed = upsertSourcePlacement(
      placementFromDrop({
        date: dayKey,
        hour,
        minute,
        durationMinutes: habit?.timeEstimate?.minutes ?? 30,
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
      const task = tasks.find((t) => t.id === action.sourceId)
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
    const task = tasks.find((t) => t.id === taskId)
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
        <div className="plan-period">
          <button type="button" className="plan-period-chev" aria-label="Previous day" onClick={() => setCurrentDate(subDays(currentDate, 1))}>
            &lt;
          </button>
          <h3>{format(currentDate, "EEEE, MMMM d, yyyy")}</h3>
          <button type="button" className="plan-period-chev" aria-label="Next day" onClick={() => setCurrentDate(addDays(currentDate, 1))}>
            &gt;
          </button>
          <button type="button" className="plan-period-today" onClick={() => setCurrentDate(new Date())}>
            Today
          </button>
        </div>

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
