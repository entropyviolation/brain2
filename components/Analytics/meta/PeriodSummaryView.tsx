/**
 * components/Analytics/meta/PeriodSummaryView.tsx — Data → Meta → Summary
 *
 * The period summary for the shared window. When the window is exactly one
 * week, month, season, or year it shows that period's written summary, its
 * children's summaries, and the plates (`components/PeriodSummary/`). A custom
 * range shows the plates with no written summary. **Past summaries** lists
 * every period that has anything written or kept; a row moves the window
 * there. The ritual summary step edits the same records.
 */
"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { getDayNotesPersist, summaryProse, subscribeDayNotesPersist, type DayNotesMap } from "@/lib/day-notes-persist"
import {
  childSummaryWindows,
  pastSummaryWindows,
  periodWindowForRange,
  type SummaryPeriodWindow,
} from "@/lib/period-summary"
import { usePeriodSummary, usePeriodSummaryStore } from "@/lib/period-summary-store"
import { SummaryEditor } from "@/components/Home/Tracking/day-summary/tracking-summaries"
import { PeriodSummaryPlates } from "@/components/PeriodSummary/period-summary-plates"
import { useAnalyticsRange } from "../chrome/analytics-range-store"
import "@/components/PeriodSummary/period-summary.css"

const PERIOD_WORD: Record<SummaryPeriodWindow["period"], string> = {
  day: "day",
  week: "week",
  month: "month",
  season: "season",
  year: "year",
}

function useWrittenSummaries(): DayNotesMap {
  return useSyncExternalStore(subscribeDayNotesPersist, getDayNotesPersist, getDayNotesPersist)
}

function WrittenSummary({ window, notes }: { window: SummaryPeriodWindow; notes: DayNotesMap }) {
  const text = summaryProse(notes[window.key])
  const [writing, setWriting] = useState(false)
  const children = childSummaryWindows(window)
    .map((child) => ({ child, text: summaryProse(notes[child.key]).trim() }))
    .filter((row) => row.text)

  return (
    <section className="ps-plate" aria-label={`${window.label} written summary`}>
      <h4 className="ps-plate-title">{window.label}</h4>
      {text.trim() && !writing ? (
        <p className="ps-written">{text}</p>
      ) : writing ? (
        <div className="trk95">
          <SummaryEditor
            storageKey={window.key}
            label={`${window.label} summary`}
            period={window.period}
            rows={5}
          />
        </div>
      ) : (
        <p className="ps-empty">
          No {PERIOD_WORD[window.period]} summary yet. Write it in the end-of-{PERIOD_WORD[window.period]} ritual, or{" "}
          <button type="button" className="ps-key" onClick={() => setWriting(true)}>
            write it here
          </button>
        </p>
      )}
      {text.trim() && !writing ? (
        <button type="button" className="ps-key" onClick={() => setWriting(true)}>
          Edit
        </button>
      ) : null}
      {children.length ? (
        <ol className="ps-rows" style={{ marginTop: 10 }}>
          {children.map(({ child, text: childText }) => (
            <li key={child.key} style={{ display: "block" }}>
              <span className="ps-song-title">{child.label}</span>
              <p className="ps-song-note">{childText}</p>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  )
}

export function PeriodSummaryView() {
  const { dateKeys, fromKey, toKey, label, setCustomRange } = useAnalyticsRange()
  const notes = useWrittenSummaries()
  const records = usePeriodSummaryStore((s) => s.byKey)
  const [showDays, setShowDays] = useState(true)

  const window = useMemo(
    () => (fromKey && toKey ? periodWindowForRange(fromKey, toKey) : null),
    [fromKey, toKey],
  )
  const record = usePeriodSummary(window?.key ?? "")

  const past = useMemo(() => {
    const written = Object.keys(notes).filter((key) => summaryProse(notes[key]).trim())
    return pastSummaryWindows(written, Object.keys(records), showDays)
  }, [notes, records, showDays])

  return (
    <div className="an-canvas an-stack" data-testid="period-summary-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Summary</p>
          <p className="an-canvas-kicker">
            {window ? window.label : label} · what the period held. Edit it in the end-of-period ritual.
          </p>
        </div>
      </header>

      {window ? (
        <WrittenSummary window={window} notes={notes} />
      ) : (
        <p className="ps-empty">
          This is a custom range, so there is no written summary. Pick This week, This month, or This season, or open
          a past summary below.
        </p>
      )}

      <PeriodSummaryPlates dateKeys={dateKeys} record={record} window={window} />

      <section className="ps-plate" aria-label="Past summaries">
        <h4 className="ps-plate-title">Past summaries · {past.length}</h4>
        <label className="ps-label" style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <input type="checkbox" checked={showDays} onChange={(e) => setShowDays(e.target.checked)} />
          <span>Include days</span>
        </label>
        {past.length ? (
          <ol className="ps-archive">
            {past.map((row) => (
              <li key={row.key}>
                <button
                  type="button"
                  aria-pressed={row.key === window?.key}
                  onClick={() => setCustomRange(row.from, row.to)}
                >
                  <span className="ps-archive-kind">{row.period}</span>
                  <span>{row.label}</span>
                  <span className="ps-archive-text">{summaryProse(notes[row.key]).trim()}</span>
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="ps-empty">Nothing written yet. Summaries you write in rituals or Tracking land here.</p>
        )}
      </section>
    </div>
  )
}
