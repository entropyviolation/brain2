/**
 * components/Home/Plan/season-view.tsx — Season (quarter) calendar
 *
 * Three months of the calendar quarter, named as a season, plus the written
 * season plan. A day click opens Day view. Padding cells from the neighboring
 * month stay numbered and do not repeat that day's chips. The plan log is
 * `quarterPlan-*`.
 */
"use client"

import { useMemo } from "react"
import { format, startOfMonth, endOfMonth, eachDayOfInterval, addDays, isSameMonth } from "date-fns"
import type { CalendarEvent } from "@/lib/types"
import { formatLocalDateKey, sameCalendarDay, startOfLocalToday } from "@/lib/date-utils"
import { eventCoversDay, isMultiDayEvent } from "@/lib/event-links"
import {
  monthKeysInQuarter,
  quarterKey,
  quarterLabel,
  quarterStartDate,
  seasonOfDate,
  seasonSlug,
  shiftQuarter,
} from "@/lib/seasons"
import { PlanPeriodNav } from "./plan-period-nav"
import { PlanTextLog, planPeriodStampProps } from "./plan-text-log"
import { PlanChip, planEventTimeLabel } from "./plan-chip"

interface SeasonViewProps {
  currentDate: Date
  setCurrentDate: (date: Date) => void
  events: CalendarEvent[]
  onOpenDay: (date: Date) => void
  onOpenMonth: (date: Date) => void
  onEventClick: (event: CalendarEvent) => void
}

export function SeasonView({
  currentDate,
  setCurrentDate,
  events,
  onOpenDay,
  onOpenMonth,
  onEventClick,
}: SeasonViewProps) {
  const today = startOfLocalToday()
  const anchor = quarterStartDate(currentDate)
  const key = quarterKey(anchor)
  const season = seasonOfDate(anchor)
  const months = monthKeysInQuarter(key).map((monthKey) => {
    const [y, m] = monthKey.split("-").map(Number)
    return new Date(y, m - 1, 1)
  })

  const chipsByDay = useMemo(() => {
    const map = new Map<string, { id: string; title: string; time: string }[]>()
    for (const event of events) {
      for (const month of months) {
        const start = startOfMonth(month)
        const end = endOfMonth(month)
        const cursor = new Date(start)
        while (cursor <= end) {
          const covers =
            event.isAllDay || isMultiDayEvent(event)
              ? eventCoversDay(event, cursor)
              : sameCalendarDay(event.date, cursor)
          if (covers) {
            const dayKey = formatLocalDateKey(cursor)
            const row = map.get(dayKey) ?? []
            row.push({ id: event.id, title: event.title, time: planEventTimeLabel(event) })
            map.set(dayKey, row)
          }
          cursor.setDate(cursor.getDate() + 1)
        }
      }
    }
    return map
  }, [events, key])

  return (
    <div className="plan-desktop season-board" data-season={seasonSlug(season)}>
      <PlanPeriodNav
        label={quarterLabel(key)}
        previousLabel="Previous season"
        nextLabel="Next season"
        todayLabel="This season"
        onPrevious={() => setCurrentDate(shiftQuarter(anchor, -1))}
        onNext={() => setCurrentDate(shiftQuarter(anchor, 1))}
        onToday={() => setCurrentDate(new Date())}
      />

      <div
        className="season-months"
        data-ui-name="Season calendar"
        data-ui-help="Three months of this season. Click a day for Day view, or the month name for Month view. The written season plan is below."
        data-ui-docs="components/Home/Plan/README.md"
        data-ui-docs-anchor="season"
      >
        {months.map((month) => {
          const monthStart = startOfMonth(month)
          const monthEnd = endOfMonth(month)
          const gridStart = addDays(monthStart, -monthStart.getDay())
          const gridEnd = addDays(monthEnd, 6 - monthEnd.getDay())
          const days = eachDayOfInterval({ start: gridStart, end: gridEnd })
          return (
            <section key={formatLocalDateKey(month)} className="season-month">
              <button type="button" className="season-month-title" onClick={() => onOpenMonth(month)}>
                {format(month, "MMMM")}
              </button>
              <div className="season-weekdays">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <span key={`${d}-${i}`}>{d}</span>
                ))}
              </div>
              <div className="season-month-grid">
                {days.map((date) => {
                  const dayKey = formatLocalDateKey(date)
                  const chips = chipsByDay.get(dayKey) ?? []
                  const outside = !isSameMonth(date, month)
                  return (
                    <div
                      key={dayKey}
                      className="season-day"
                      role="button"
                      tabIndex={outside ? -1 : 0}
                      data-outside={outside ? "true" : "false"}
                      data-today={sameCalendarDay(date, today) ? "true" : "false"}
                      onClick={() => {
                        if (!outside) onOpenDay(date)
                      }}
                      onKeyDown={(event) => {
                        if (outside) return
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault()
                          onOpenDay(date)
                        }
                      }}
                    >
                      <span>{date.getDate()}</span>
                      {!outside && chips.slice(0, 2).map((chip) => (
                        <span key={chip.id} onClick={(event) => event.stopPropagation()}>
                          <PlanChip
                            timeLabel={chip.time}
                            title={chip.title}
                            tooltip={chip.title}
                            onClick={() => {
                              const found = events.find((row) => row.id === chip.id)
                              if (found) onEventClick(found)
                            }}
                          />
                        </span>
                      ))}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <fieldset className="plan-group" {...planPeriodStampProps("quarter")}>
        <legend>Season plan — {quarterLabel(key)}</legend>
        <PlanTextLog
          period="quarter"
          periodKey={key}
          placeholder="Write this season's plan — what the quarter is for..."
        />
      </fieldset>
    </div>
  )
}
