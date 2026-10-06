/**
 * components/Home/Tracking/tracking-period-nav.tsx — Date toolbar for Tracking
 *
 * Period nameplate date with metal prev/next/today keys (Plan kin). Time Grid
 * (day and week), Activity Log, and Day Log all use this so the three tabs
 * share one navigator. Optional meta sits under the date; optional trailing
 * keys (Clear day, Log activity, week cell size) stay at the end.
 */
"use client"

import type { ReactNode } from "react"

export function TrackingPeriodNav({
  label,
  onPrevious,
  onNext,
  onToday,
  previousLabel,
  nextLabel,
  todayLabel = "Today",
  meta,
  trailing,
  locked = false,
}: {
  label: string
  onPrevious: () => void
  onNext: () => void
  onToday: () => void
  previousLabel: string
  nextLabel: string
  todayLabel?: string
  meta?: ReactNode
  trailing?: ReactNode
  /** Hide day-stepping. The label stays so a ritual can pin one date. */
  locked?: boolean
}) {
  return (
    <div className="trk-period" data-trailing={trailing ? "true" : "false"} data-locked={locked ? "true" : "false"}>
      {locked ? (
        <span className="trk-period-chev" aria-hidden />
      ) : (
      <button type="button" className="trk-period-chev" aria-label={previousLabel} onClick={onPrevious}>
        &lt;
      </button>
      )}
      <div className="trk-period-title">
        <h3>{label}</h3>
        {meta ? <p className="trk-period-meta">{meta}</p> : null}
      </div>
      {locked ? (
        <span className="trk-period-chev" aria-hidden />
      ) : (
      <button type="button" className="trk-period-chev" aria-label={nextLabel} onClick={onNext}>
        &gt;
      </button>
      )}
      {locked ? null : (
      <button type="button" className="trk-period-today" onClick={onToday}>
        {todayLabel}
      </button>
      )}
      {trailing ? <div className="trk-period-trailing">{trailing}</div> : null}
    </div>
  )
}
