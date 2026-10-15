/**
 * components/Home/Tracking/tracking-period-nav.tsx — Date toolbar for Tracking
 *
 * Period nameplate date with metal prev/next/today keys (Plan kin). Time Grid
 * (day and week), Activity Log, and Day Log all use this so the three tabs
 * share one navigator. Optional meta sits under the date; optional trailing
 * keys (Clear day, Log activity, week cell size) stay at the end.
 * `variant="crt"` is the Home Tracking desk: ‹ [DATE in a CRT] › TODAY as
 * one group, then small CRT readouts (tracked, %, days) on the right.
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
  variant = "plate",
  readouts,
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
  variant?: "plate" | "crt"
  /** CRT readouts beside the date (desk). */
  readouts?: ReactNode
}) {
  if (variant === "crt") {
    return (
      <div className="trk-period-crt" data-locked={locked ? "true" : "false"}>
        <div className="trk-pgroup">
          {locked ? null : (
            <button type="button" className="trk-period-chev" aria-label={previousLabel} onClick={onPrevious}>
              ‹
            </button>
          )}
          <div className="trk-scope-crt" title={typeof meta === "string" ? meta : undefined}>
            <h3>{label}</h3>
          </div>
          {locked ? null : (
            <button type="button" className="trk-period-chev" aria-label={nextLabel} onClick={onNext}>
              ›
            </button>
          )}
          {locked ? null : (
            <button type="button" className="trk-period-today" onClick={onToday}>
              {todayLabel}
            </button>
          )}
        </div>
        {readouts ? <div className="trk-readouts">{readouts}</div> : null}
        {trailing ? <div className="trk-period-trailing">{trailing}</div> : null}
      </div>
    )
  }
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
