/**
 * components/Home/Plan/month-view.tsx — Month calendar view
 *
 * Gray month grid inside the Plan window: event/task chips, drag-and-drop onto
 * a date, click a cell to open Day view, the Planned Tasks rail, and the
 * persisted Month Plan log (submit-stamped entries). Days before local today
 * (`isPastLocalCalendarDay`, not the selected/viewed date) use `data-past`.
 * Local today uses `data-today` plus a number-row mark, distinct from `data-selected`.
 * Month cells stay compact (numbered squares + small chips) so a 6-week grid does not balloon.
 * Optional `gemMode` swaps past-of-today chips for gems/orbs; today/future stay chips. Default off.
 *
 * Spec: §7.4 (Month View).
 */
"use client"

import type React from "react"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useEventStore } from "@/lib/event-store"
import { formatLocalDateKey, formatLocalMonthKey, isPastLocalCalendarDay, sameCalendarDay, startOfLocalToday, toLocalCalendarDate } from "@/lib/date-utils"
import { eventCoversDay, isMultiDayEvent } from "@/lib/event-links"
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  addDays,
} from "date-fns"
import type { CalendarEvent } from "@/lib/types"
import { consumePlanDragClick, readPlanDrag } from "@/lib/plan-drag"
import { usePlanPointerDrop } from "./use-plan-rail-drag"
import { hhmmToMinutes, placementFromDrop, type PlannedAction } from "@/lib/planned-actions"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import { useHabitsStore } from "@/lib/habits-store"
import { PlannedTasksSidebar } from "./planned-tasks-sidebar"
import { PlanTextLog, planPeriodStampProps } from "./plan-text-log"
import { itemTitle } from "@/lib/item-utils"
import {
  PLAN_MONTH_CHIP_LIMIT,
  PLAN_TASK_COLOR,
  PlanChip,
  PlanMore,
  planChipTooltip,
  planEventTimeLabel,
} from "./plan-chip"
import { PlanGemDayBody } from "./plan-gem-day-body"

interface MonthViewProps {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  events: CalendarEvent[]
  setEvents: (events: CalendarEvent[]) => void
  onTaskClick: (taskId: string) => void
  onEventClick: (event: CalendarEvent) => void
  onOpenDay: (date: Date) => void
  onPlannedActionClick?: (action: PlannedAction) => void
  /** Past days show gems/orbs for completed work. Default off. */
  gemMode?: boolean
}

type DayChip = {
  id: string
  timeLabel: string
  title: string
  color?: string
  tooltip: string
  sortMinutes: number
  onClick: () => void
  kind?: "planned"
}

function timeToMinutes(time?: string): number {
  if (!time) return 0
  const [h, m] = time.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function MonthView({
  currentDate,
  setCurrentDate,
  events,
  onTaskClick,
  onEventClick,
  onOpenDay,
  onPlannedActionClick,
  gemMode = false,
}: MonthViewProps) {
  const todayStart = startOfLocalToday()
  const tasks = useTaskStore((s) => s.tasks)
  const updateTask = useTaskStore((s) => s.updateTask)
  const updateEvent = useEventStore((s) => s.updateEvent)
  const habits = useHabitsStore((s) => s.tasks)
  const plannedActions = usePlannedActionStore((s) => s.actions)
  const upsertSourcePlacement = usePlannedActionStore((s) => s.upsertSourcePlacement)
  const monthKey = formatLocalMonthKey(currentDate)

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const startDate = addDays(monthStart, -monthStart.getDay())
  const endDate = addDays(monthEnd, 6 - monthEnd.getDay())
  const calendarDays = eachDayOfInterval({ start: startDate, end: endDate })

  const chipsByDay = useMemo(() => {
    const map = new Map<string, DayChip[]>()
    for (const date of calendarDays) {
      const key = format(date, "yyyy-MM-dd")
      const chips: DayChip[] = []
      for (const event of events) {
        const covers =
          event.isAllDay || isMultiDayEvent(event)
            ? eventCoversDay(event, date)
            : sameCalendarDay(event.date, date)
        if (!covers) continue
        const timeLabel = planEventTimeLabel(event)
        chips.push({
          id: `event-${event.id}`,
          timeLabel,
          title: event.title,
          color: event.color,
          tooltip: planChipTooltip(timeLabel, event.title, event.location),
          sortMinutes: event.isAllDay || isMultiDayEvent(event) ? -1 : timeToMinutes(event.startTime),
          onClick: () => onEventClick(event),
        })
      }
      for (const task of tasks) {
        if (!task.scheduledDate || !sameCalendarDay(task.scheduledDate, date)) continue
        const timeLabel = task.scheduledTime ? `${task.scheduledTime}` : ""
        const title = itemTitle(task)
        chips.push({
          id: `task-${task.id}`,
          timeLabel,
          title,
          color: PLAN_TASK_COLOR,
          tooltip: planChipTooltip(timeLabel, title),
          sortMinutes: timeToMinutes(task.scheduledTime),
          onClick: () => onTaskClick(task.id),
        })
      }
      const dayKey = formatLocalDateKey(date)
      for (const action of plannedActions) {
        if (action.date !== dayKey) continue
        const timeLabel = `${action.startTime}–${action.endTime}`
        chips.push({
          id: `plan-${action.id}`,
          timeLabel,
          title: action.title,
          tooltip: planChipTooltip(timeLabel, action.title, action.notes),
          sortMinutes: hhmmToMinutes(action.startTime),
          onClick: () => onPlannedActionClick?.(action),
          kind: "planned",
        })
      }
      chips.sort((a, b) => a.sortMinutes - b.sortMinutes || a.title.localeCompare(b.title))
      map.set(key, chips)
    }
    return map
  }, [calendarDays, events, tasks, plannedActions, onEventClick, onTaskClick, onPlannedActionClick])

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }

  const applyDrop = (payload: { kind: string; id: string }, date: Date) => {
    if (payload.kind === "task") {
      const task = tasks.find((t) => t.id === payload.id)
      if (task) updateTask({ ...task, scheduledDate: toLocalCalendarDate(date) })
      return
    }
    if (payload.kind === "event") {
      const event = events.find((ev) => ev.id === payload.id)
      if (event) updateEvent({ ...event, date: toLocalCalendarDate(date) })
      return
    }
    if (payload.kind === "habit") {
      const habit = habits.find((row) => row.id === payload.id)
      upsertSourcePlacement(
        placementFromDrop({
          date: formatLocalDateKey(date),
          hour: 9,
          minute: 0,
          durationMinutes: habit?.timeEstimate?.minutes ?? 30,
          source: "habit",
          sourceId: payload.id,
          title: habit?.name ?? "Habit",
        }),
      )
    }
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>, date: Date) => {
    e.preventDefault()
    const payload = readPlanDrag(e.dataTransfer)
    if (payload) applyDrop(payload, date)
  }

  usePlanPointerDrop((payload, _x, _y, target) => {
    if (target.dataset.planDrop !== "day") return
    const raw = target.dataset.date
    if (!raw) return
    applyDrop(payload, new Date(`${raw}T12:00:00`))
  })

  const handleUnscheduleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task) return
    updateTask({
      ...task,
      scheduledDate: undefined,
      scheduledTime: undefined,
      scheduledWeek: undefined,
      scheduledMonth: monthKey,
    })
  }

  return (
    <div className="plan-split">
      <PlannedTasksSidebar
        mode="month"
        currentDate={currentDate}
        onTaskClick={onTaskClick}
        onUnscheduleTask={handleUnscheduleTask}
      />

      <div className="plan-desktop">
        <div className="plan-period">
          <button type="button" className="plan-period-chev" aria-label="Previous month" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
            &lt;
          </button>
          <h3>{format(currentDate, "MMMM yyyy")}</h3>
          <button type="button" className="plan-period-chev" aria-label="Next month" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
            &gt;
          </button>
          <button type="button" className="plan-period-today" onClick={() => setCurrentDate(new Date())}>
            Today
          </button>
        </div>

        <div
          className="plan-cal"
          data-ui-name="Month calendar"
          data-ui-help="Month grid of days. Event chips live here — the written Month Plan is the cabinet below."
          data-ui-docs="components/Home/Plan/README.md"
          data-ui-docs-anchor="month"
        >
          <div className="plan-weekdays">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="plan-month-grid">
            {calendarDays.map((date) => {
              const key = format(date, "yyyy-MM-dd")
              const chips = chipsByDay.get(key) ?? []
              const visible = chips.slice(0, PLAN_MONTH_CHIP_LIMIT)
              const hidden = chips.slice(PLAN_MONTH_CHIP_LIMIT)
              const isPastDay = isPastLocalCalendarDay(date, todayStart)
              const isTodayCell = sameCalendarDay(date, todayStart)
              const isSelectedDay = sameCalendarDay(date, currentDate)
              return (
                <div
                  key={key}
                  className="plan-day"
                  role="button"
                  tabIndex={0}
                  aria-label={`Open ${format(date, "MMMM d, yyyy")} in Day view`}
                  aria-current={isTodayCell ? "date" : undefined}
                  data-outside={!isSameMonth(date, currentDate) ? "true" : "false"}
                  data-past={isPastDay ? "true" : "false"}
                  data-today={isTodayCell ? "true" : "false"}
                  data-selected={isSelectedDay ? "true" : "false"}
                  data-plan-drop="day"
                  data-date={key}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, date)}
                  onClick={() => {
                    if (consumePlanDragClick()) return
                    onOpenDay(date)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault()
                      onOpenDay(date)
                    }
                  }}
                >
                  <span className="plan-day-num">
                    {format(date, "d")}
                    {isTodayCell ? (
                      <span className="plan-day-today-mark" title="Today">
                        today
                      </span>
                    ) : null}
                  </span>
                  {gemMode && isPastDay ? (
                    <PlanGemDayBody
                      date={date}
                      events={events}
                      onTaskClick={onTaskClick}
                      onEventClick={onEventClick}
                    />
                  ) : (
                    <div className="plan-chips" data-plan-day-body="chips">
                      {visible.map((chip) => (
                        <PlanChip
                          key={chip.id}
                          timeLabel={chip.timeLabel}
                          title={chip.title}
                          color={chip.color}
                          tooltip={chip.tooltip}
                          onClick={chip.onClick}
                          kind={chip.kind}
                        />
                      ))}
                      <PlanMore hidden={hidden} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <fieldset className="plan-group" {...planPeriodStampProps("month")}>
          <legend>Month Plan — {format(currentDate, "MMMM yyyy")}</legend>
          <PlanTextLog
            period="month"
            periodKey={monthKey}
            placeholder="Write your month plan, goals, and objectives..."
          />
        </fieldset>
      </div>
    </div>
  )
}
