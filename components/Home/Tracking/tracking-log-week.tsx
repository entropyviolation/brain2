/**
 * components/Home/Tracking/tracking-log-week.tsx — Tracking log week of log lines
 *
 * Seven columns for the week containing `currentDate`. The today column follows
 * the wall clock, not the selected day. Same classify/sort rules as the day
 * shelves — not Day Log agenda week and not Time Grid paint week. Date headings
 * open that day in day mode.
 */
"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import {
  asLogEntry,
  classifyLogBookRow,
  compareLogRows,
  logClockLabel,
  switchLogCopy,
  type LogBookEntry,
  type LogBookList,
} from "@/components/Home/Tracking/tracking-log-model"
import { formatLocalDateKey, getWeekDates, getWeekStartDate, sameCalendarDay } from "@/lib/date-utils"
import { formatSpendAmount, summarizeSpend } from "@/lib/spend"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useLiveToday } from "@/lib/use-current-date"
import "./tracking-log-week.css"

const SHELF_TAG: Record<LogBookList, string> = {
  food: "Food",
  drink: "Drink",
  drug: "Drug",
  intake: "Intake",
  event: "Event",
  switch: "Switch",
  thought: "Thought",
  spend: "Spent",
}

function rowTitle(entry: LogBookEntry, penName: Map<string, string>): string {
  if (entry.list === "spend") return entry.spendOn?.trim() || entry.title?.trim() || "Untitled"
  if (entry.list === "switch") return switchLogCopy(entry, penName.get(entry.penId))
  return entry.title?.trim() || "Untitled"
}

function WeekLogRow({
  entry,
  penName,
  onOpen,
  onRemove,
}: {
  entry: LogBookEntry
  penName: Map<string, string>
  onOpen: (id: string) => void
  onRemove: (id: string) => void
}) {
  const clock = logClockLabel(entry)
  const title = rowTitle(entry, penName)
  const tag = SHELF_TAG[entry.list]
  const amount =
    entry.list === "spend" && typeof entry.spendAmount === "number" ? (
      <span className="trk-log-week-amount">{formatSpendAmount(entry.spendAmount)}</span>
    ) : null

  if (clock.badge === "Unknown") {
    return (
      <div className="trk-log-week-row is-unknown" data-entry={entry.id}>
        <span className="trk-log-week-badge">Unknown</span>
        {amount}
        <span className="trk-log-week-copy" title={title}>
          {title}
        </span>
        <span className="trk-log-week-tag">{tag}</span>
        <span className="trk-log-week-actions">
          <button type="button" onClick={() => onOpen(entry.id)}>
            Edit
          </button>
          <button type="button" onClick={() => onRemove(entry.id)}>
            Remove
          </button>
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      data-no95=""
      className="trk-log-week-row"
      data-entry={entry.id}
      onClick={() => onOpen(entry.id)}
    >
      {clock.time ? <span className="trk-log-week-when">{clock.time}</span> : null}
      {amount}
      <span className="trk-log-week-copy" title={title}>
        {title}
      </span>
      <span className="trk-log-week-tag">{tag}</span>
      {clock.badge ? <span className="trk-log-week-badge">{clock.badge}</span> : null}
    </button>
  )
}

export function TrackingLogWeek({
  currentDate,
  onOpenDay,
  onOpenEntry,
  onRemoveEntry,
}: {
  currentDate: Date
  onOpenDay: (date: Date) => void
  onOpenEntry: (id: string) => void
  onRemoveEntry: (id: string) => void
}) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const today = useLiveToday()
  const weekStart = getWeekStartDate(currentDate)
  const weekDates = getWeekDates(weekStart)
  const weekKeys = useMemo(() => new Set(weekDates.map((d) => formatLocalDateKey(d))), [weekDates])

  const penName = useMemo(() => {
    const map = new Map<string, string>()
    for (const scope of scopes) {
      for (const pen of scope.pens) map.set(pen.id, pen.name)
    }
    return map
  }, [scopes])

  const columns = useMemo(() => {
    return weekDates.map((date) => {
      const dayKey = formatLocalDateKey(date)
      const rows: LogBookEntry[] = []
      for (const entry of entries) {
        if (entry.date !== dayKey) continue
        const row = classifyLogBookRow(asLogEntry(entry), penName.get(entry.penId))
        if (row) rows.push(row)
      }
      rows.sort(compareLogRows)
      return {
        date,
        dayKey,
        rows,
        isToday: sameCalendarDay(date, today),
        isSelected: sameCalendarDay(date, currentDate),
      }
    })
  }, [weekDates, entries, penName, today, currentDate])

  const weekSpend = useMemo(() => {
    const spend: LogBookEntry[] = []
    for (const entry of entries) {
      if (!weekKeys.has(entry.date)) continue
      const row = classifyLogBookRow(asLogEntry(entry), penName.get(entry.penId))
      if (row?.list === "spend") spend.push(row)
    }
    return summarizeSpend(spend)
  }, [entries, weekKeys, penName])

  return (
    <div className="trk-log-week" data-testid="tracking-log-week">
      {weekSpend.total > 0 ? (
        <div className="trk-log-week-ledger" aria-label="Spent this week">
          <p>
            <span className="trk-log-week-spent-total">{formatSpendAmount(weekSpend.total)}</span> spent this
            week
          </p>
          <p>{weekSpend.bySource.map((row) => `${row.label} ${formatSpendAmount(row.amount)}`).join(" · ")}</p>
        </div>
      ) : null}

      <div className="trk-log-week-board">
        {columns.map((col) => (
          <div
            key={col.dayKey}
            className="trk-log-week-col"
            data-day={col.dayKey}
            data-today={col.isToday ? "true" : "false"}
            data-selected={col.isSelected ? "true" : "false"}
          >
            <button
              type="button"
              data-no95=""
              className="trk-log-week-head"
              data-day={col.dayKey}
              data-today={col.isToday ? "true" : "false"}
              aria-label={`Open ${format(col.date, "EEEE, MMM d")}`}
              onClick={() => onOpenDay(col.date)}
            >
              <span className="trk-log-week-head-dow">{format(col.date, "EEE")}</span>
              <span className="trk-log-week-head-dom">{format(col.date, "d")}</span>
            </button>
            <div className="trk-log-week-rows" aria-label={`Log for ${format(col.date, "EEEE, MMM d")}`}>
              {col.rows.length === 0 ? (
                <p className="trk-log-week-empty" aria-hidden>
                  —
                </p>
              ) : (
                col.rows.map((entry) => (
                  <WeekLogRow
                    key={entry.id}
                    entry={entry}
                    penName={penName}
                    onOpen={onOpenEntry}
                    onRemove={onRemoveEntry}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
