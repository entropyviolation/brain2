/**
 * components/Home/Plan/plan-gem-day-body.tsx — Past-day gem-mode cell body
 *
 * Month view only. Events stay Plan chips. Completed habits/list items become
 * clickable gems/orbs (same assets as Habits + Lists). Incomplete scheduled
 * tasks stay chips. Empty past days keep the numbered rectangle.
 */
"use client"

import { useMemo } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { sameCalendarDay } from "@/lib/date-utils"
import { eventCoversDay, isMultiDayEvent } from "@/lib/event-links"
import { itemTitle } from "@/lib/item-utils"
import type { CalendarEvent } from "@/lib/types"
import { HabitGemImg } from "@/components/Home/Habits/habit-gems"
import {
  PLAN_MONTH_CHIP_LIMIT,
  PLAN_TASK_COLOR,
  PlanChip,
  PlanMore,
  planChipTooltip,
  planEventTimeLabel,
} from "./plan-chip"
import { planGemChipTaskIds, planGemTokensForDay } from "./plan-gem-day"
import "./plan-gem-mode.css"

function timeToMinutes(time?: string): number {
  if (!time) return 0
  const [h, m] = time.split(":").map(Number)
  return (h || 0) * 60 + (m || 0)
}

type BodyChip = {
  id: string
  timeLabel: string
  title: string
  color?: string
  tooltip: string
  sortMinutes: number
  onClick: () => void
}

export function PlanGemDayBody({
  date,
  events,
  onTaskClick,
  onEventClick,
}: {
  date: Date
  events: CalendarEvent[]
  onTaskClick: (taskId: string) => void
  onEventClick: (event: CalendarEvent) => void
}) {
  const tasks = useTaskStore((s) => s.tasks)
  const habits = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)

  const tokens = useMemo(
    () => planGemTokensForDay({ date, habits, weeklyData, tasks }),
    [date, habits, weeklyData, tasks],
  )
  const hideTaskIds = useMemo(() => planGemChipTaskIds(tokens, tasks, date), [tokens, tasks, date])

  const chips = useMemo(() => {
    const next: BodyChip[] = []
    for (const event of events) {
      const covers =
        event.isAllDay || isMultiDayEvent(event)
          ? eventCoversDay(event, date)
          : sameCalendarDay(event.date, date)
      if (!covers) continue
      const timeLabel = planEventTimeLabel(event)
      next.push({
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
      if (hideTaskIds.has(task.id)) continue
      const timeLabel = task.scheduledTime ? `${task.scheduledTime}` : ""
      const title = itemTitle(task)
      next.push({
        id: `task-${task.id}`,
        timeLabel,
        title,
        color: PLAN_TASK_COLOR,
        tooltip: planChipTooltip(timeLabel, title),
        sortMinutes: timeToMinutes(task.scheduledTime),
        onClick: () => onTaskClick(task.id),
      })
    }
    next.sort((a, b) => a.sortMinutes - b.sortMinutes || a.title.localeCompare(b.title))
    return next
  }, [date, events, tasks, hideTaskIds, onEventClick, onTaskClick])

  const visible = chips.slice(0, PLAN_MONTH_CHIP_LIMIT)
  const hidden = chips.slice(PLAN_MONTH_CHIP_LIMIT)

  return (
    <div className="plan-gem-day" data-plan-day-body="gems">
      {visible.length > 0 || hidden.length > 0 ? (
        <div className="plan-chips">
          {visible.map((chip) => (
            <PlanChip
              key={chip.id}
              timeLabel={chip.timeLabel}
              title={chip.title}
              color={chip.color}
              tooltip={chip.tooltip}
              onClick={chip.onClick}
            />
          ))}
          <PlanMore hidden={hidden} />
        </div>
      ) : null}
      {tokens.length > 0 ? (
        <div className="plan-gem-day-icons">
          {tokens.map((token) => (
            <button
              key={token.id}
              type="button"
              className="plan-gem-day-token"
              data-no95=""
              title={token.title}
              aria-label={token.title}
              onClick={(e) => {
                e.stopPropagation()
                onTaskClick(token.openTaskId)
              }}
            >
              {token.kind === "habit" ? (
                <HabitGemImg src={token.src} width={16} height={16} title={token.title} />
              ) : (
                <img src={token.src} alt="" width={16} height={16} draggable={false} />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
