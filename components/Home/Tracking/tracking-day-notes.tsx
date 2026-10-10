/**
 * components/Home/Tracking/tracking-day-notes.tsx — Day summary well
 *
 * Sits under Time Grid, Activity Log, Day Log, and Tracking log. The header
 * Now popup opens the same well (`forceOpen`) without flipping Expand.
 *
 * This used to be an append log of stamped jots. It is now the retrospective
 * summary of what actually happened: one editable day summary, and — when the
 * well is open — Week, Month, Season, and Year. Those higher periods have no
 * tracking grid of their own (Tracking’s boards are day and week). Week boards
 * also show truncated day summaries under each day. Plan text is a different
 * store and is not shown here.
 *
 * Collapsed is the Day summary legend and Expand. Expand
 * (`notesWellExpanded`) opens the editor. Storage is `brain2-tracking-day-notes`.
 */
"use client"

import { useState, useSyncExternalStore } from "react"
import { format } from "date-fns"
import { DAY_NOTES_PERSIST_KEY } from "@/lib/day-notes-persist"
import { persistKeyFailed, subscribePersistStatus } from "@/lib/persist-storage"
import { formatLocalDateKey } from "@/lib/date-utils"
import { SUMMARY_PERIODS, type SummaryPeriod } from "@/lib/tracking-summaries"
import { setTrackingViewPrefs, useTrackingViewPrefs } from "./tracking-view-prefs"
import {
  MonthSummaryNest,
  SeasonSummaryNest,
  SummaryEditor,
  WeekSummaryNest,
  YearSummaryNest,
} from "./tracking-summaries"

const notesUnsaved = () => persistKeyFailed(DAY_NOTES_PERSIST_KEY)

const PERIOD_WORD: Record<SummaryPeriod, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
  season: "Season",
  year: "Year",
}

export function TrackingDayNotes({
  currentDate,
  forceOpen = false,
}: {
  currentDate: Date
  /** Show the summary without changing the desk's Expand preference. */
  forceOpen?: boolean
}) {
  const unsaved = useSyncExternalStore(subscribePersistStatus, notesUnsaved, () => false)
  const notesPrefOpen = useTrackingViewPrefs().notesWellExpanded
  const notesOpen = forceOpen || notesPrefOpen
  const [period, setPeriod] = useState<SummaryPeriod>("day")
  const dayKey = formatLocalDateKey(currentDate)
  const legend =
    period === "day" ? `Day summary · ${format(currentDate, "EEE, MMM d")}` : `${PERIOD_WORD[period]} summary`

  return (
    <div
      id={forceOpen ? undefined : "trk-day-notes"}
      className={notesOpen ? "trk-notes trk-notes-open trk-summary" : "trk-notes trk-summary"}
      data-summary-period={notesOpen ? period : undefined}
    >
      <div className="trk-notes-head">
        <p className="trk-silk trk-notes-legend">{notesOpen ? legend : "Day summary"}</p>
        {forceOpen ? null : (
          <button
            type="button"
            className="trk-notes-fold"
            aria-expanded={notesOpen}
            aria-controls={notesOpen ? "trk-day-summary" : undefined}
            onClick={() => setTrackingViewPrefs({ notesWellExpanded: !notesOpen })}
          >
            {notesOpen ? "Collapse" : "Expand"}
          </button>
        )}
      </div>
      {unsaved && (
        <p className="trk-notes-unsaved" role="alert">
          This summary is only in memory — storage is full. Export a backup in Settings, then refresh.
        </p>
      )}
      {notesOpen && (
        <div id={forceOpen ? "htk-day-summary" : "trk-day-summary"}>
          <div className="trk-span-switch trk-summary-periods" role="toolbar" aria-label="Summary period">
            {SUMMARY_PERIODS.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={period === option}
                onClick={() => setPeriod(option)}
              >
                {PERIOD_WORD[option]}
              </button>
            ))}
          </div>
          {period === "day" ? (
            <SummaryEditor storageKey={dayKey} label={legend} period="day" rows={8} />
          ) : period === "week" ? (
            <WeekSummaryNest anchor={currentDate} />
          ) : period === "month" ? (
            <MonthSummaryNest anchor={currentDate} />
          ) : period === "season" ? (
            <SeasonSummaryNest anchor={currentDate} />
          ) : (
            <YearSummaryNest year={currentDate.getFullYear()} />
          )}
        </div>
      )}
    </div>
  )
}
