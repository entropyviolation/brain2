/**
 * components/Home/Plan/phone/plan-phone-cal.tsx — Phone month, week strip, season
 *
 * Month keeps the desktop Sunday columns. Week keeps Monday (`getWeekDates`).
 * A tap selects the day. A second tap on a month cell opens Day, and so does
 * the agenda’s Open day key. Season days open Day; a month title opens Month.
 */
"use client"

import { useMemo } from "react"
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  format,
  isSameMonth,
  startOfMonth,
} from "date-fns"
import { HabitGemImg } from "@/components/Home/Habits/habit-gems"
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  isPastLocalCalendarDay,
  sameCalendarDay,
  startOfLocalToday,
  getWeekDates,
  getWeekStartDate,
} from "@/lib/date-utils"
import { eventCoversDay, isMultiDayEvent } from "@/lib/event-links"
import { useHabitsStore } from "@/lib/habits-store"
import { taskOnPlanCalendarDay, tasksForGemDay, tasksForPlanCalendar } from "@/lib/item-slices"
import { usePlannedActionStore } from "@/lib/planned-action-store"
import {
  monthKeysInQuarter,
  quarterKey,
  quarterStartDate,
  seasonOfDate,
  seasonSlug,
} from "@/lib/seasons"
import { useTaskStore } from "@/lib/task-store"
import type { CalendarEvent } from "@/lib/types"
import { PLAN_TASK_COLOR, resolvePlanColor } from "../plan-chip"
import { planGemTokensForDay } from "../gem/plan-gem-day"

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

function eventOnDay(event: CalendarEvent, date: Date): boolean {
  return event.isAllDay || isMultiDayEvent(event) ? eventCoversDay(event, date) : sameCalendarDay(event.date, date)
}

function PhoneGemMarks({ date }: { date: Date }) {
  const tasks = useTaskStore((s) => tasksForGemDay(s.tasks, date))
  const habits = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const tokens = useMemo(
    () => planGemTokensForDay({ date, habits, weeklyData, tasks }).slice(0, 3),
    [date, habits, weeklyData, tasks],
  )
  if (tokens.length === 0) return null
  return (
    <span className="plan-phone-gems" aria-hidden>
      {tokens.map((token) => (
        <HabitGemImg key={token.id} src={token.src} title={token.title} width={12} height={12} />
      ))}
    </span>
  )
}

export function PhoneMonth({
  currentDate,
  events,
  gemMode,
  onSelect,
  onOpenDay,
}: {
  currentDate: Date
  events: CalendarEvent[]
  gemMode: boolean
  onSelect: (date: Date) => void
  onOpenDay: (date: Date) => void
}) {
  const today = startOfLocalToday()
  const monthKey = formatLocalMonthKey(currentDate)
  const calendarDays = useMemo(() => {
    const [year, month] = monthKey.split("-").map(Number)
    const monthStart = startOfMonth(new Date(year, month - 1, 1))
    const monthEnd = endOfMonth(monthStart)
    return eachDayOfInterval({
      start: addDays(monthStart, -monthStart.getDay()),
      end: addDays(monthEnd, 6 - monthEnd.getDay()),
    })
  }, [monthKey])
  const tasks = useTaskStore((s) => tasksForPlanCalendar(s.tasks, calendarDays, today))
  const actions = usePlannedActionStore((s) => s.actions)

  const marks = useMemo(() => {
    const map = new Map<string, string[]>()
    for (const date of calendarDays) {
      const key = formatLocalDateKey(date)
      const colors: string[] = []
      for (const event of events) {
        if (!eventOnDay(event, date)) continue
        colors.push(resolvePlanColor(event.color))
      }
      for (const task of tasks) {
        if (!taskOnPlanCalendarDay(task, date, today)) continue
        colors.push(PLAN_TASK_COLOR)
      }
      for (const action of actions) {
        if (action.date !== key) continue
        colors.push("#c4b49a")
      }
      map.set(key, colors)
    }
    return map
  }, [calendarDays, events, tasks, actions, today])

  return (
    <div
      className="plan-phone-month"
      data-ui-name="Month calendar"
      data-ui-help="Month of days. A tap selects the day. Open day switches to the day agenda."
      data-ui-docs="components/Home/Plan/README.md"
      data-ui-docs-anchor="month"
    >
      <div className="plan-phone-weekdays">
        {WEEKDAY_LABELS.map((name) => (
          <span key={name} aria-hidden>
            {name.slice(0, 1)}
          </span>
        ))}
      </div>
      <div className="plan-phone-month-grid" role="grid" aria-label={format(currentDate, "MMMM yyyy")}>
        {calendarDays.map((date) => {
          const key = formatLocalDateKey(date)
          const colors = marks.get(key) ?? []
          const past = isPastLocalCalendarDay(date, today)
          const isTodayCell = sameCalendarDay(date, today)
          const selected = sameCalendarDay(date, currentDate)
          const outside = !isSameMonth(date, currentDate)
          return (
            <div key={key} className="plan-phone-cell" role="gridcell" data-outside={outside ? "true" : "false"}>
              <button
                type="button"
                className="plan-phone-cell-hit"
                aria-current={isTodayCell ? "date" : undefined}
                aria-pressed={selected}
                data-past={past ? "true" : "false"}
                data-today={isTodayCell ? "true" : "false"}
                data-selected={selected ? "true" : "false"}
                aria-label={`${format(date, "EEEE, MMMM d, yyyy")}${colors.length ? `, ${colors.length} items` : ""}`}
                onClick={() => onSelect(date)}
                onDoubleClick={() => onOpenDay(date)}
              >
                <span className="plan-phone-num">{format(date, "d")}</span>
                {gemMode && past ? <PhoneGemMarks date={date} /> : null}
                {colors.length > 0 ? (
                  <span className="plan-phone-dots" aria-hidden>
                    {colors.slice(0, 3).map((color, index) => (
                      <i key={`${key}-${index}`} style={{ background: color }} />
                    ))}
                  </span>
                ) : (
                  <span className="plan-phone-dots" aria-hidden />
                )}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function PhoneWeekStrip({
  currentDate,
  onSelect,
}: {
  currentDate: Date
  onSelect: (date: Date) => void
}) {
  const today = startOfLocalToday()
  const days = getWeekDates(getWeekStartDate(currentDate))
  return (
    <div className="plan-phone-week" role="group" aria-label="This week" data-ui-name="Week calendar">
      {days.map((date) => {
        const selected = sameCalendarDay(date, currentDate)
        const isTodayCell = sameCalendarDay(date, today)
        return (
          <button
            key={formatLocalDateKey(date)}
            type="button"
            aria-pressed={selected}
            aria-current={isTodayCell ? "date" : undefined}
            data-past={isPastLocalCalendarDay(date, today) ? "true" : "false"}
            data-today={isTodayCell ? "true" : "false"}
            onClick={() => onSelect(date)}
          >
            <span>{format(date, "EEE")}</span>
            <span className="plan-phone-week-num">{format(date, "d")}</span>
          </button>
        )
      })}
    </div>
  )
}

function SeasonMonth({
  month,
  events,
  onOpenDay,
  onOpenMonth,
}: {
  month: Date
  events: CalendarEvent[]
  onOpenDay: (date: Date) => void
  onOpenMonth: (date: Date) => void
}) {
  const today = startOfLocalToday()
  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(monthStart)
  const days = eachDayOfInterval({
    start: addDays(monthStart, -monthStart.getDay()),
    end: addDays(monthEnd, 6 - monthEnd.getDay()),
  })
  const marked = useMemo(() => {
    const set = new Set<string>()
    for (const date of days) {
      if (!isSameMonth(date, month)) continue
      if (events.some((event) => eventOnDay(event, date))) set.add(formatLocalDateKey(date))
    }
    return set
  }, [days, events, month])

  return (
    <section className="plan-phone-season-month">
      <button type="button" className="plan-phone-season-title" onClick={() => onOpenMonth(monthStart)}>
        {format(month, "MMMM")}
      </button>
      <div className="plan-phone-weekdays" aria-hidden>
        {WEEKDAY_LABELS.map((name) => (
          <span key={name}>{name.slice(0, 1)}</span>
        ))}
      </div>
      <div className="plan-phone-month-grid">
        {days.map((date) => {
          const outside = !isSameMonth(date, month)
          const key = formatLocalDateKey(date)
          if (outside) {
            return <span key={key} className="plan-phone-cell" data-outside="true" />
          }
          const isTodayCell = sameCalendarDay(date, today)
          return (
            <button
              key={key}
              type="button"
              className="plan-phone-cell-hit"
              data-today={isTodayCell ? "true" : "false"}
              data-past={isPastLocalCalendarDay(date, today) ? "true" : "false"}
              aria-current={isTodayCell ? "date" : undefined}
              aria-label={format(date, "EEEE, MMMM d")}
              onClick={() => onOpenDay(date)}
            >
              <span className="plan-phone-num">{format(date, "d")}</span>
              {marked.has(key) ? (
                <span className="plan-phone-dots" aria-hidden>
                  <i />
                </span>
              ) : (
                <span className="plan-phone-dots" aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function PhoneSeason({
  currentDate,
  events,
  onOpenDay,
  onOpenMonth,
}: {
  currentDate: Date
  events: CalendarEvent[]
  onOpenDay: (date: Date) => void
  onOpenMonth: (date: Date) => void
}) {
  const anchor = quarterStartDate(currentDate)
  const key = quarterKey(anchor)
  const season = seasonSlug(seasonOfDate(anchor))
  const months = monthKeysInQuarter(key).map((monthKey) => {
    const [y, m] = monthKey.split("-").map(Number)
    return new Date(y, m - 1, 1)
  })
  return (
    <div
      className="plan-phone-season"
      data-season={season}
      data-ui-name="Season calendar"
      data-ui-help="Three months of this season. A day opens Day view. A month name opens that month."
      data-ui-docs="components/Home/Plan/README.md"
      data-ui-docs-anchor="season"
    >
      {months.map((month) => (
        <SeasonMonth
          key={formatLocalMonthKey(month)}
          month={month}
          events={events}
          onOpenDay={onOpenDay}
          onOpenMonth={onOpenMonth}
        />
      ))}
    </div>
  )
}

export function monthDays(date: Date): Date[] {
  return eachDayOfInterval({ start: startOfMonth(date), end: endOfMonth(date) })
}

export function weekDays(date: Date): Date[] {
  return getWeekDates(getWeekStartDate(date))
}
