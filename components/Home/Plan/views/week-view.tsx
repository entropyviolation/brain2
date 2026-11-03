/**
 * components/Home/Plan/views/week-view.tsx — Week calendar view
 *
 * Seven-day hourly grid. Elapsed columns use `data-past` gray furniture from
 * the wall clock (`useLiveToday`), the same cutoff as Month. Clicking an hour
 * still creates an event. Week Plan is the shared stamped log.
 */
"use client"

import type React from "react"

import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { useHabitsStore } from "@/lib/habits-store"
import { formatLocalDateKey, isPastLocalCalendarDay, sameCalendarDay, toLocalCalendarDate, getWeekStartDate, getWeekDates, getWeekString } from "@/lib/date-utils"
import { useLiveToday } from "@/lib/use-current-date"
import { eventCoversDay } from "@/lib/event-links"
import { format, addWeeks, subWeeks } from "date-fns"
import { tasksTimedOnDays } from "@/lib/item-slices"
import type { CalendarEvent } from "@/lib/types"
import { PlannedTasksSidebar } from "../rail/planned-tasks-sidebar"
import { PlanPeriodNav } from "./plan-period-nav"
import { PlanTextLog, planPeriodStampProps } from "../plan-text-log"
import { itemTitle } from "@/lib/item-utils"
import { habitScheduleMinutes } from "@/lib/habit-time-estimate"
import { consumePlanDragClick, readPlanDrag, writePlanDrag } from "@/lib/plan-drag"
import { usePlanPointerDrop } from "../rail/use-plan-rail-drag"
import {
  hhmmToMinutes,
  movePlacement,
  placementFromDrop,
  plannedDurationMinutes,
  todoIdsCoveredByPlacements,
  type PlannedAction,
} from "@/lib/planned-actions"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { plannedShade } from "../agenda-grid"
import {
  PLAN_TASK_COLOR,
  PLAN_WEEK_ALLDAY_LIMIT,
  PlanChip,
  PlanMore,
  planChipTooltip,
  planEventTimeLabel,
  resolvePlanColor,
} from "../plan-chip"

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

function getEventDurationMinutes(event: CalendarEvent): number {
  const [startHour, startMin] = event.startTime.split(":").map(Number)
  const [endHour, endMin] = event.endTime.split(":").map(Number)
  return endHour * 60 + endMin - (startHour * 60 + startMin)
}

const WEEK_HOUR_PX = 64

interface WeekBlock {
  key: string
  kind: "event" | "task" | "planned"
  startMinutes: number
  durationMinutes: number
  lane: number
  lanes: number
}

/** Side-by-side lanes for blocks that overlap in time within one day. */
function packLanes<T extends { startMinutes: number; durationMinutes: number }>(
  items: T[],
): (T & { lane: number; lanes: number })[] {
  const sorted = [...items].sort((x, y) => x.startMinutes - y.startMinutes)
  const out: (T & { lane: number; lanes: number })[] = []
  let cluster: (T & { lane: number; lanes: number })[] = []
  let laneEnds: number[] = []
  let clusterEnd = -1
  const flush = () => {
    for (const row of cluster) row.lanes = Math.max(1, laneEnds.length)
    out.push(...cluster)
    cluster = []
    laneEnds = []
  }
  for (const item of sorted) {
    const end = item.startMinutes + Math.max(15, item.durationMinutes)
    if (cluster.length && item.startMinutes >= clusterEnd) flush()
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= item.startMinutes)
    if (lane < 0) lane = laneEnds.length
    laneEnds[lane] = end
    clusterEnd = Math.max(clusterEnd, end)
    cluster.push({ ...item, lane, lanes: 1 })
  }
  flush()
  return out
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
  const today = useLiveToday()
  const weekStart = getWeekStartDate(currentDate)
  const weekDates = getWeekDates(weekStart)
  const tasks = useTaskStore((s) => tasksTimedOnDays(s.tasks, weekDates))
  const updateTask = useTaskStore((s) => s.updateTask)
  const updateEvent = useEventStore((s) => s.updateEvent)
  const habits = useHabitsStore((s) => s.tasks)
  const plannedActions = usePlannedActionStore((s) => s.actions)
  const upsertSourcePlacement = usePlannedActionStore((s) => s.upsertSourcePlacement)
  const updatePlannedAction = usePlannedActionStore((s) => s.updateAction)

  const weekKey = getWeekString(currentDate)

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const applyDrop = (payload: { kind: string; id: string }, date: Date, hour: number) => {
    if (payload.kind === "task") {
      const task = useTaskStore.getState().tasks.find((t) => t.id === payload.id)
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
      const durationMinutes = habitScheduleMinutes(habit)
      if (durationMinutes == null) return
      upsertSourcePlacement(
        placementFromDrop({
          date: formatLocalDateKey(date),
          hour,
          minute: 0,
          durationMinutes,
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
    const task = useTaskStore.getState().tasks.find((t) => t.id === taskId)
    if (!task) return
    updateTask({
      ...task,
      scheduledDate: undefined,
      scheduledTime: undefined,
      scheduledWeek: getWeekString(currentDate),
    })
  }

  const getAllDayEventsForDate = (date: Date) => {
    return events.filter((event) => event.isAllDay && eventCoversDay(event, date))
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
        <PlanPeriodNav
          label={`${format(weekStart, "MMM d")} - ${format(weekDates[6], "MMM d, yyyy")}`}
          previousLabel="Previous week"
          nextLabel="Next week"
          onPrevious={() => setCurrentDate(subWeeks(currentDate, 1))}
          onNext={() => setCurrentDate(addWeeks(currentDate, 1))}
          onToday={() => setCurrentDate(new Date())}
        />

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
                  data-past={isPastLocalCalendarDay(date, today) ? "true" : "false"}
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

            <div className="plan-week-body">
              <div className="plan-week-gutters">
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className="plan-week-gutter" style={{ height: WEEK_HOUR_PX }}>
                    {hour.toString().padStart(2, "0")}:00
                  </div>
                ))}
              </div>
              {weekDates.map((date) => {
                const dayKey = formatLocalDateKey(date)
                const covered = todoIdsCoveredByPlacements(plannedActions, date)
                const pastAttr = isPastLocalCalendarDay(date, today) ? "true" : "false"
                const todayAttr = sameCalendarDay(date, today) ? "true" : "false"
                const blocks = packLanes<Omit<WeekBlock, "lane" | "lanes">>([
                  ...events
                    .filter((event) => !event.isAllDay && sameCalendarDay(event.date, date))
                    .map((event) => ({
                      key: `e-${event.id}`,
                      kind: "event" as const,
                      startMinutes: hhmmToMinutes(event.startTime),
                      durationMinutes: getEventDurationMinutes(event),
                    })),
                  ...tasks
                    .filter(
                      (task) =>
                        task.scheduledDate &&
                        task.scheduledTime &&
                        sameCalendarDay(task.scheduledDate, date) &&
                        !covered.has(task.id),
                    )
                    .map((task) => ({
                      key: `t-${task.id}`,
                      kind: "task" as const,
                      startMinutes: hhmmToMinutes(task.scheduledTime),
                      durationMinutes: task.estimatedDuration ?? 30,
                    })),
                  ...plannedActions
                    .filter((action) => action.date === dayKey)
                    .map((action) => ({
                      key: `p-${action.id}`,
                      kind: "planned" as const,
                      startMinutes: hhmmToMinutes(action.startTime),
                      durationMinutes: plannedDurationMinutes(action),
                    })),
                ])
                return (
                  <div key={dayKey} className="plan-week-col" data-past={pastAttr} data-today={todayAttr}>
                    {Array.from({ length: 24 }, (_, hour) => (
                      <div
                        key={hour}
                        className="plan-week-cell"
                        style={{ height: WEEK_HOUR_PX }}
                        data-plan-drop="week"
                        data-hour={hour}
                        data-date={dayKey}
                        data-past={pastAttr}
                        data-today={todayAttr}
                        onDragOver={onDragOver}
                        onDrop={(e) => onDrop(e, date, hour)}
                        onClick={() => {
                          if (consumePlanDragClick()) return
                          onCreateEvent(date, hour)
                        }}
                      />
                    ))}
                    {blocks.map((block) => {
                      const width = 100 / block.lanes
                      const style: React.CSSProperties = {
                        top: (block.startMinutes / 60) * WEEK_HOUR_PX + 1,
                        height: Math.max(22, (block.durationMinutes / 60) * WEEK_HOUR_PX - 2),
                        left: `calc(${block.lane * width}% + 2px)`,
                        width: `calc(${width}% - 4px)`,
                      }
                      if (block.kind === "event") {
                        const event = events.find((row) => `e-${row.id}` === block.key)
                        if (!event) return null
                        return (
                          <div
                            key={block.key}
                            className="plan-chip plan-week-block"
                            style={{ ...style, ["--plan-chip-color" as string]: resolvePlanColor(event.color) }}
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
                        )
                      }
                      if (block.kind === "task") {
                        const task = tasks.find((row) => `t-${row.id}` === block.key)
                        if (!task) return null
                        return (
                          <div
                            key={block.key}
                            className="plan-chip plan-week-block"
                            style={{ ...style, ["--plan-chip-color" as string]: PLAN_TASK_COLOR }}
                            draggable
                            onDragStart={(e) => onTaskDragStart(e, task.id)}
                            onClick={(e) => {
                              e.stopPropagation()
                              onTaskClick(task.id)
                            }}
                            title={planChipTooltip(task.scheduledTime || "", itemTitle(task))}
                          >
                            <span className="plan-chip-time">
                              {task.scheduledTime}
                              {(task.estimatedDuration ?? 0) > 0 ? ` · ${task.estimatedDuration}m` : ""}
                            </span>
                            <span className="plan-chip-title">{itemTitle(task)}</span>
                          </div>
                        )
                      }
                      const action = plannedActions.find((row) => `p-${row.id}` === block.key)
                      if (!action) return null
                      return (
                        <div
                          key={block.key}
                          className="plan-chip plan-week-block"
                          data-kind="planned"
                          data-shade={plannedShade(action)}
                          style={style}
                          draggable
                          onDragStart={(e) => writePlanDrag(e.dataTransfer, "action", action.id)}
                          onClick={(e) => {
                            e.stopPropagation()
                            onPlannedActionClick?.(action)
                          }}
                          title={planChipTooltip(`${action.startTime}–${action.endTime}`, action.title, action.notes)}
                        >
                          <span className="plan-chip-time">
                            {action.startTime}–{action.endTime}
                          </span>
                          <span className="plan-chip-title">{action.title}</span>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
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
