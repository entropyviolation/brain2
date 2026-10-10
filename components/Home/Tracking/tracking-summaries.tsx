/**
 * components/Home/Tracking/tracking-summaries.tsx — Retrospective period summaries
 *
 * What actually happened, written after the fact. Not the Plan text, and not
 * the painted tracking blocks. A day is one editor. A week shows a truncated
 * day summary under each day (open it for the full day) and a week summary
 * beneath them. Month, season, and year follow the same step: truncated
 * children, then that period’s own summary.
 */
"use client"

import { useEffect, useState } from "react"
import { format } from "date-fns"
import { summaryProse, useDayNote } from "@/lib/day-notes-persist"
import { formatLocalDateKey } from "@/lib/date-utils"
import { seasonOfDate } from "@/lib/seasons"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  daysOfWeek,
  monthSummaryKeyFromDate,
  monthsOfSeason,
  seasonSummaryKey,
  seasonsOfYear,
  weekSummaryKey,
  weeksTouchingMonth,
  yearSummaryKey,
  type SummaryPeriod,
} from "@/lib/tracking-summaries"

const PLACEHOLDER: Record<SummaryPeriod, string> = {
  day: "What actually happened — where you went, who you were with, how the day went. This is the day as it was, not the plan and not each tracking block.",
  week: "What actually happened this week — the shape of the days together, beyond each day’s summary.",
  month: "What actually happened this month — the stretch of weeks, not the plan.",
  season: "What actually happened this season — the months as they went, not the plan.",
  year: "What actually happened this year — the seasons as they went, not the plan.",
}

export function SummaryEditor({
  storageKey,
  label,
  period,
  rows = 6,
}: {
  storageKey: string
  label: string
  period: SummaryPeriod
  rows?: number
}) {
  const stored = useDayNote(storageKey)
  const prose = summaryProse(stored)
  const setDayNotes = useTimeTrackingStore((s) => s.setDayNotes)

  useEffect(() => {
    if (stored && stored !== prose) setDayNotes(storageKey, prose)
  }, [stored, prose, storageKey, setDayNotes])

  return (
    <label className="trk-summary-parent">
      <span className="trk-summary-kicker">{label}</span>
      <textarea
        className="trk-summary-field"
        aria-label={label}
        placeholder={PLACEHOLDER[period]}
        rows={rows}
        value={prose}
        onChange={(event) => setDayNotes(storageKey, event.target.value)}
      />
    </label>
  )
}

function SummaryPreview({
  storageKey,
  label,
  pressed,
  onOpen,
}: {
  storageKey: string
  label: string
  pressed?: boolean
  onOpen: () => void
}) {
  const text = summaryProse(useDayNote(storageKey))
  return (
    <button
      type="button"
      className="trk-summary-preview"
      aria-label={label}
      aria-pressed={pressed}
      onClick={onOpen}
    >
      <span className="trk-summary-preview-kicker">{label}</span>
      <span className="trk-summary-preview-text">{text.trim() || "No summary yet"}</span>
    </button>
  )
}

function dayLabel(day: Date): string {
  return `Day summary · ${format(day, "EEE, MMM d")}`
}

export function WeekSummaryNest({
  anchor,
  gutter = "none",
}: {
  anchor: Date
  /** Match a week board’s hour gutter so previews sit under the day columns. */
  gutter?: "none" | "time" | "daylog"
}) {
  const days = daysOfWeek(anchor)
  const [openDay, setOpenDay] = useState<string | null>(null)
  const open = openDay ? days.find((day) => formatLocalDateKey(day) === openDay) : undefined
  const range = `${format(days[0], "MMM d")} – ${format(days[6], "MMM d")}`

  return (
    <section className="trk-summary-nest" aria-label={`Week summary ${range}`} data-period="week">
      <div className="trk-summary-children" data-gutter={gutter}>
        {gutter !== "none" ? <div className="trk-summary-gutter" aria-hidden /> : null}
        {days.map((day) => {
          const key = formatLocalDateKey(day)
          return (
            <SummaryPreview
              key={key}
              storageKey={key}
              label={dayLabel(day)}
              pressed={openDay === key}
              onOpen={() => setOpenDay((current) => (current === key ? null : key))}
            />
          )
        })}
      </div>
      {open ? (
        <SummaryEditor storageKey={formatLocalDateKey(open)} label={dayLabel(open)} period="day" rows={5} />
      ) : null}
      <SummaryEditor
        storageKey={weekSummaryKey(anchor)}
        label={`Week summary · ${range}`}
        period="week"
        rows={3}
      />
    </section>
  )
}

export function MonthSummaryNest({ anchor }: { anchor: Date }) {
  const weeks = weeksTouchingMonth(anchor.getFullYear(), anchor.getMonth())
  const [openWeek, setOpenWeek] = useState<string | null>(null)
  const title = format(anchor, "MMMM yyyy")

  return (
    <section className="trk-summary-nest" aria-label={`Month summary ${title}`} data-period="month">
      <div className="trk-summary-stack">
        {weeks.map((week) => {
          const key = weekSummaryKey(week)
          const days = daysOfWeek(week)
          const range = `${format(days[0], "MMM d")} – ${format(days[6], "MMM d")}`
          const label = `Week summary · ${range}`
          const open = openWeek === key
          return (
            <div key={key} className="trk-summary-branch">
              <SummaryPreview storageKey={key} label={label} pressed={open} onOpen={() => setOpenWeek(open ? null : key)} />
              {open ? <WeekSummaryNest anchor={week} /> : null}
            </div>
          )
        })}
      </div>
      <SummaryEditor storageKey={monthSummaryKeyFromDate(anchor)} label={`Month summary · ${title}`} period="month" rows={3} />
    </section>
  )
}

export function SeasonSummaryNest({ anchor }: { anchor: Date }) {
  const months = monthsOfSeason(anchor)
  const [openMonth, setOpenMonth] = useState<string | null>(null)
  const title = `${seasonOfDate(anchor)} ${anchor.getFullYear()}`

  return (
    <section className="trk-summary-nest" aria-label={`Season summary ${title}`} data-period="season">
      <div className="trk-summary-stack">
        {months.map((month) => {
          const key = monthSummaryKeyFromDate(month)
          const label = `Month summary · ${format(month, "MMMM yyyy")}`
          const open = openMonth === key
          return (
            <div key={key} className="trk-summary-branch">
              <SummaryPreview
                storageKey={key}
                label={label}
                pressed={open}
                onOpen={() => setOpenMonth(open ? null : key)}
              />
              {open ? <MonthSummaryNest anchor={month} /> : null}
            </div>
          )
        })}
      </div>
      <SummaryEditor storageKey={seasonSummaryKey(anchor)} label={`Season summary · ${title}`} period="season" rows={3} />
    </section>
  )
}

export function YearSummaryNest({ year }: { year: number }) {
  const seasons = seasonsOfYear(year)
  const [openSeason, setOpenSeason] = useState<string | null>(null)

  return (
    <section className="trk-summary-nest" aria-label={`Year summary ${year}`} data-period="year">
      <div className="trk-summary-stack">
        {seasons.map((season) => {
          const open = openSeason === season.storageKey
          const label = `Season summary · ${season.label}`
          return (
            <div key={season.storageKey} className="trk-summary-branch">
              <SummaryPreview
                storageKey={season.storageKey}
                label={label}
                pressed={open}
                onOpen={() => setOpenSeason(open ? null : season.storageKey)}
              />
              {open ? <SeasonSummaryNest anchor={season.anchor} /> : null}
            </div>
          )
        })}
      </div>
      <SummaryEditor storageKey={yearSummaryKey(year)} label={`Year summary · ${year}`} period="year" rows={3} />
    </section>
  )
}
