/**
 * components/Home/Plan/week-view.tsx — Week calendar view
 *
 * Seven-day hourly grid. Elapsed columns use `data-past` gray furniture.
 * Clicking an hour still creates an event. Week Plan is the shared stamped log.
 */
"use client"

import type React from "react"

import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { useHabitsStore } from "@/lib/habits-store"
import { formatLocalDateKey, sameCalendarDay, toLocalCalendarDate, getWeekStartDate, getWeekDates, getWeekString } from "@/lib/date-utils"
import { useCurrentDate } from "@/lib/use-current-date"
import { eventCoversDay } from "@/lib/event-links"
import { format, addWeeks, subWeeks } from "date-fns"
import type { CalendarEvent } from "@/lib/types"
import { PlannedTasksSidebar } from "./planned-tasks-sidebar"
import { PlanTextLog, planPeriodStampProps } from "./plan-text-log"
import { itemTitle } from "@/lib/item-utils"
import { consumePlanDragClick, readPlanDrag, writePlanDrag } from "@/lib/plan-drag"
import { usePlanPointerDrop } from "./use-plan-rail-drag"
import { hhmmToMinutes, movePlacement, placementFromDrop, type PlannedAction } from "@/lib/planned-actions"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import {
  PLAN_TASK_COLOR,
  PLAN_WEEK_ALLDAY_LIMIT,
  PlanChip,
  PlanMore,
  planChipTooltip,
  planEventTimeLabel,
  resolvePlanColor,
} from "./plan-chip"

interface WeekViewProps {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  onTaskClick: (taskId: string) => void
  onEventClick: (event: CalendarEvent) => void
  onCreateEvent: (date: Date, hour?: number) => void
  onPlannedActionClick?: (action: PlannedAction) => void
}

function isElapsedPlanDay(date: Date, today: Date) {
  return toLocalCalendarDate(date).getTime() < toLocalCalendarDate(today).getTime()
}

function getEventDurationMinutes(event: CalendarEvent): number {
  const [startHour, startMin] = event.startTime.split(":").map(Number)
  const [endHour, endMin] = event.endTime.split(":").map(Number)
  return endHour * 60 + endMin - (startHour * 60 + startMin)
}

export function WeekView({
  currentDate,
  setCurrentDate,
  events,
  onTaskClick,
  onEventClick,
  onCreateEvent,
  onPlannedActionClick,
}: WeekViewProps) {
  const { currentDate: today } = useCurrentDate()
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const updateEvent = useEventStore((s) => s.updateEvent)
  const habits = useHabitsStore((s) => s.tasks)
  const plannedActions = usePlannedActionStore((s) => s.actions)
  const upsertSourcePlacement = usePlannedActionStore((s) => s.upsertSourcePlacement)
  const updatePlannedAction = usePlannedActionStore((s) => s.updateAction)

  const weekStart = getWeekStartDate(currentDate)
  const weekDates = getWeekDates(weekStart)
  const weekKey = getWeekString(currentDate)

  const getScheduledTasks = (date: Date) => {
    return tasks.filter((task) => task.scheduledDate && sameCalendarDay(task.scheduledDate, date))
  }

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const applyDrop = (payload: { kind: string; id: string }, date: Date, hour: number) => {
    if (payload.kind === "task") {
      const task = tasks.find((t) => t.id === payload.id)
      if (!task) return
      const scheduledDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour)
      updateTask({
        ...task,
        scheduledDate,
        scheduledTime: `${hour.toString().padStart(2, "0")}:00`,
        scheduledWeek: undefined,
        scheduledMonth: undefined,
        scheduledYear: undefined,
      })
      upsertSourcePlacement(
        placementFromDrop({
          date: formatLocalDateKey(date),
          hour,
          minute: 0,
          durationMinutes: task.estimatedDuration ?? 30,
          source: "todo",
          sourceId: task.id,
          title: itemTitle(task),
        }),
      )
      return
    }
    if (payload.kind === "habit") {
      const habit = habits.find((row) => row.id === payload.id)
      upsertSourcePlacement(
        placementFromDrop({
          date: formatLocalDateKey(date),
          hour,
          minute: 0,
          durationMinutes: habit?.timeEstimate?.minutes ?? 30,
          source: "habit",
          sourceId: payload.id,
          title: habit?.name ?? "Habit",
        }),
      )
      return
    }
    if (payload.kind === "action") {
      const action = plannedActions.find((row) => row.id === payload.id)
      if (!action) return
      const next = { ...movePlacement(action, hour, 0), date: formatLocalDateKey(date) }
      updatePlannedAction(next)
      return
    }
    if (payload.kind === "event") {
      const event = events.find((ev) => ev.id === payload.id)
      if (event && !event.isAllDay) {
        const durationMin = getEventDurationMinutes(event)
        const endTotal = hour * 60 + durationMin
        updateEvent({
          ...event,
          date: toLocalCalendarDate(date),
          startTime: `${hour.toString().padStart(2, "0")}:00`,
          endTime: `${Math.floor(endTotal / 60)
            .toString()
            .padStart(2, "0")}:${(endTotal % 60).toString().padStart(2, "0")}`,
        })
      }
    }
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>, date: Date, hour: number) => {
    e.preventDefault()
    const payload = readPlanDrag(e.dataTransfer)
    if (payload) applyDrop(payload, date, hour)
  }

  usePlanPointerDrop((payload, _x, _y, target) => {
    if (target.dataset.planDrop !== "week") return
    const hour = Number(target.dataset.hour)
    const dateRaw = target.dataset.date
    if (!dateRaw || !Number.isFinite(hour)) return
    applyDrop(payload, new Date(`${dateRaw}T12:00:00`), hour)
  })

  const onTaskDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    writePlanDrag(e.dataTransfer, "task", taskId)
  }

  const onEventDragStart = (e: React.DragEvent<HTMLDivElement>, eventId: string) => {
    writePlanDrag(e.dataTransfer, "event", eventId)
  }

  const handleUnscheduleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    updateTask({
      ...task,
      scheduledDate: undefined,
      scheduledTime: undefined,
      scheduledWeek: getWeekString(currentDate),
    })
  }

  const getEventHeight = (event: CalendarEvent) => {
    const durationMinutes = getEventDurationMinutes(event)
    return Math.max(48, (durationMinutes / 60) * 72)
  }

  const getTaskHeight = (task: { estimatedDuration?: number }) => {
    const mins = task.estimatedDuration ?? 30
    return Math.max(48, (mins / 60) * 72)
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
    <div className="plan-split">
      <PlannedTasksSidebar
        mode="week"
        currentDate={currentDate}
        onTaskClick={onTaskClick}
        onUnscheduleTask={handleUnscheduleTask}
      />

      <div className="plan-desktop">
        <div className="plan-period">
          <button type="button" className="plan-period-chev" aria-label="Previous week" onClick={() => setCurrentDate(subWeeks(currentDate, 1))}>
            &lt;
          </button>
          <h3>
            {format(weekStart, "MMM d")} - {format(weekDates[6], "MMM d, yyyy")}
          </h3>
          <button type="button" className="plan-period-chev" aria-label="Next week" onClick={() => setCurrentDate(addWeeks(currentDate, 1))}>
            &gt;
          </button>
          <button type="button" className="plan-period-today" onClick={() => setCurrentDate(new Date())}>
            Today
          </button>
        </div>

        <div
          className="plan-week"
          data-ui-name="Week calendar"
          data-ui-help="Seven-day hourly grid — not the Week Plan log."
          data-ui-docs="components/Home/Plan/README.md"
          data-ui-docs-anchor="week"
        >
          <div className="plan-week-grid">
            <div className="plan-week-head">Time</div>
            {weekDates.map((date) => {
              const allDay = getAllDayEventsForDate(date)
              const visible = allDay.slice(0, PLAN_WEEK_ALLDAY_LIMIT)
              const hidden = allDay.slice(PLAN_WEEK_ALLDAY_LIMIT).map((event) => ({
                timeLabel: planEventTimeLabel(event),
                title: event.title,
              }))
              return (
                <div
                  key={date.toISOString()}
                  className="plan-week-head"
                  data-past={isElapsedPlanDay(date, today) ? "true" : "false"}
                  data-today={sameCalendarDay(date, today) ? "true" : "false"}
                >
                  <div>
                    {format(date, "EEE")} {format(date, "d")}
                  </div>
                  <div className="plan-allday">
                    {visible.map((event) => {
                      const timeLabel = planEventTimeLabel(event)
                      return (
                        <PlanChip
                          key={event.id}
                          timeLabel={timeLabel}
                          title={event.title}
                          color={event.color}
                          tooltip={planChipTooltip(timeLabel, event.title, event.location)}
                          onClick={() => onEventClick(event)}
                        />
                      )
                    })}
                    <PlanMore hidden={hidden} />
                  </div>
                </div>
              )
            })}

            {Array.from({ length: 24 }, (_, hour) => (
              <div key={hour} className="contents">
                <div className="plan-week-gutter">{hour.toString().padStart(2, "0")}:00</div>
                {weekDates.map((date, dayIndex) => {
                  const dayEvents = getTimedEventsForSlot(date, hour)
                  return (
                    <div
                      key={`${hour}-${dayIndex}`}
                      className="plan-week-cell"
                      data-plan-drop="week"
                      data-hour={hour}
                      data-date={formatLocalDateKey(date)}
                      data-past={isElapsedPlanDay(date, today) ? "true" : "false"}
                      data-today={sameCalendarDay(date, today) ? "true" : "false"}
                      onDragOver={onDragOver}
                      onDrop={(e) => onDrop(e, date, hour)}
                      onClick={() => {
                        if (consumePlanDragClick()) return
                        onCreateEvent(date, hour)
                      }}
                    >
                      {dayEvents.map((event) => (
                        <div
                          key={event.id}
                          className="plan-chip"
                          style={{
                            ["--plan-chip-color" as string]: resolvePlanColor(event.color),
                            position: "absolute",
                            inset: 4,
                            height: `${getEventHeight(event)}px`,
                          }}
                          draggable
                          onDragStart={(e) => onEventDragStart(e, event.id)}
                          onClick={(e) => {
                            e.stopPropagation()
                            onEventClick(event)
                          }}
                          title={planChipTooltip(planEventTimeLabel(event), event.title, event.location)}
                        >
                          <span className="plan-chip-time">
                            {event.startTime}–{event.endTime}
                          </span>
                          <span className="plan-chip-title">{event.title}</span>
                        </div>
                      ))}

                      {getScheduledTasks(date)
                        .filter((task) => task.scheduledTime && Number.parseInt(task.scheduledTime.split(":")[0]) === hour)
                        .map((task, idx) => (
                        <div
                          key={task.id}
                          className="plan-chip"
                          style={{
                            ["--plan-chip-color" as string]: PLAN_TASK_COLOR,
                            position: "absolute",
                            left: 4,
                            right: 4,
                            height: `${getTaskHeight(task)}px`,
                            top: `${dayEvents.length * 56 + idx * 6 + 4}px`,
                          }}
                          draggable
                          onDragStart={(e) => onTaskDragStart(e, task.id)}
                          onClick={(e) => {
                            e.stopPropagation()
                            onTaskClick(task.id)
                          }}
                          title={planChipTooltip(task.scheduledTime || "", itemTitle(task))}
                        >
                          <span className="plan-chip-title">{itemTitle(task)}</span>
                          {(task.estimatedDuration ?? 0) > 0 && (
                            <span className="plan-chip-time">{task.estimatedDuration}m</span>
                          )}
                        </div>
                      ))}

                      {plannedActions
                        .filter((action) => action.date === formatLocalDateKey(date) && Math.floor(hhmmToMinutes(action.startTime) / 60) === hour)
                        .map((action) => (
                          <PlanChip
                            key={action.id}
                            kind="planned"
                            timeLabel={`${action.startTime}–${action.endTime}`}
                            title={action.title}
                            tooltip={planChipTooltip(`${action.startTime}–${action.endTime}`, action.title, action.notes)}
                            onClick={() => onPlannedActionClick?.(action)}
                          />
                        ))}
                    </div>
                  )
                })}
              </div>
            ))}
          </div>
        </div>

        <fieldset className="plan-group" {...planPeriodStampProps("week")}>
          <legend>
            Week Plan — {format(weekStart, "MMM d")} to {format(weekDates[6], "MMM d")}
          </legend>
          <PlanTextLog
            period="week"
            periodKey={weekKey}
            placeholder="Write your week plan, priorities, and focus areas..."
          />
        </fieldset>
      </div>
    </div>
  )
}
