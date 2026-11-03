/**
 * components/Reviews/end/RitualSummaryStep.tsx — Review rituals edit the Tracking summaries
 *
 * Night edits that day's summary. Week shows every day's summary (open one to
 * edit) and the week summary. Month shows its weeks, and a week opens to its
 * days. Season shows its months, and a month opens to its weeks. Year shows its
 * seasons. These are the same stores and nests as Tracking → Day summary
 * (`lib/day-notes-persist.ts`), so a note written here is the note there. Each
 * field saves as you type; leaving the ritual and coming back finds it.
 */
"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { summaryProse, useDayNote } from "@/lib/day-notes-persist"
import { periodWindowForRitual, windowDateKeys, type SummaryPeriodWindow } from "@/lib/period-summary"
import { usePeriodSummary } from "@/lib/period-summary-store"
import { PeriodSummaryPlates } from "@/components/PeriodSummary/period-summary-plates"
import { PeriodSummaryFields } from "@/components/PeriodSummary/period-summary-fields"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import {
  MonthSummaryNest,
  SeasonSummaryNest,
  SummaryEditor,
  WeekSummaryNest,
  YearSummaryNest,
} from "@/components/Home/Tracking/day-summary/tracking-summaries"
import type { ReviewPeriod } from "@/lib/types"
import "@/components/Home/Tracking/tracking-chrome.css"

/** Week and longer: the read plates, then the playlist, palette, symbols, and cover fields. */
function RitualPeriodExtras({ window }: { window: SummaryPeriodWindow }) {
  const record = usePeriodSummary(window.key)
  const dateKeys = useMemo(() => windowDateKeys(window), [window])
  return (
    <div className="rv-period-extras">
      <p className="mr-lede">
        {window.label}: what else the period held. The same plates show on Data → Summary.
      </p>
      <PeriodSummaryPlates dateKeys={dateKeys} record={record} window={window} />
      <PeriodSummaryFields window={window} dateKeys={dateKeys} />
    </div>
  )
}

const LEDE: Record<ReviewPeriod, string> = {
  day: "What actually happened today. This is the same Day summary as on Tracking.",
  week: "Open a day to edit its summary, then write the week.",
  month: "Open a week to see and edit its days, then write the month.",
  quarter: "Open a month, and a week inside it, to edit them, then write the season.",
  year: "Open a season to edit its months and weeks, then write the year.",
}

export function RitualSummaryStep({
  period,
  periodKey,
  anchor,
  summaryKey,
  legacy,
  onLegacyMoved,
}: {
  period: ReviewPeriod
  periodKey: string
  anchor: Date
  summaryKey: string
  /** A note an earlier version of this ritual kept in the review itself. */
  legacy: string
  onLegacyMoved: () => void
}) {
  const shared = summaryProse(useDayNote(summaryKey))
  const setDayNotes = useTimeTrackingStore((s) => s.setDayNotes)
  const showLegacy = !!legacy.trim() && !shared.trim()
  const window = useMemo(() => periodWindowForRitual(period, anchor), [period, anchor])

  return (
    <section className="space-y-2">
      <p className="mr-lede">{LEDE[period]}</p>
      {showLegacy ? (
        <div className="rv-shared">
          <span className="rv-shared-label">Earlier note</span>
          <span className="text-sm">{legacy}</span>
          <button
            type="button"
            className="rv-delete"
            style={{ marginLeft: 0 }}
            onClick={() => {
              setDayNotes(summaryKey, legacy.trim())
              onLegacyMoved()
            }}
          >
            Use it as the summary
          </button>
        </div>
      ) : null}
      <div className="trk95 rv-summary-host">
        {period === "day" ? (
          <SummaryEditor
            storageKey={summaryKey}
            label={`Day summary · ${format(anchor, "EEE, MMM d")}`}
            period="day"
            rows={8}
          />
        ) : period === "week" ? (
          <WeekSummaryNest anchor={anchor} />
        ) : period === "month" ? (
          <MonthSummaryNest anchor={anchor} />
        ) : period === "quarter" ? (
          <SeasonSummaryNest anchor={anchor} />
        ) : (
          <YearSummaryNest year={anchor.getFullYear()} />
        )}
      </div>
      {window && period !== "day" ? <RitualPeriodExtras window={window} /> : null}
    </section>
  )
}
