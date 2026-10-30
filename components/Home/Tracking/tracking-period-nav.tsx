/**
 * components/Home/Tracking/tracking-period-nav.tsx — Date toolbar for Tracking
 *
 * Period nameplate date with short keycap prev / next / today keys. Time Grid
 * (day and week), Activity Log, Day Log, and Tracking log share this navigator.
 * Optional meta sits under the date; optional trailing keys (Clear day, Log
 * activity, week cell size) stay at the end. Double-click the date to open
 * the date picker (`date` + `onPickDate`; hidden while `locked`).
 * `variant="crt"` is the Home Tracking desk: ‹ [DATE in a CRT] › TODAY as
 * one group, then small CRT readouts (tracked, %, days) on the right.
 */
"use client"

import { useRef, type ReactNode } from "react"
import { dateInputValue, parseLocalDate } from "@/lib/date-utils"

function openDatePicker(input: HTMLInputElement | null) {
  if (!input) return
  const show = input.showPicker?.bind(input)
  if (show) {
    try {
      show()
      return
    } catch {
      /* showPicker throws when the gesture is not trusted, such as in tests. */
    }
  }
  input.focus()
}

function PeriodDate({
  className,
  label,
  meta,
  date,
  onPickDate,
  locked,
}: {
  className: string
  label: string
  meta?: ReactNode
  date?: Date
  onPickDate?: (date: Date) => void
  locked: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const canPick = Boolean(date && onPickDate) && !locked
  const hint = canPick ? "Double-click to choose a date" : undefined
  const title = hint && typeof meta === "string" ? `${hint}. ${meta}` : hint ?? (typeof meta === "string" ? meta : undefined)
  return (
    <div
      className={className}
      data-pick={canPick ? "true" : undefined}
      title={title}
      onDoubleClick={(event) => {
        if (!canPick) return
        event.preventDefault()
        openDatePicker(inputRef.current)
      }}
    >
      <h3>{label}</h3>
      {className === "trk-period-title" && meta ? <p className="trk-period-meta">{meta}</p> : null}
      {canPick ? (
        <input
          ref={inputRef}
          type="date"
          className="trk-period-pick"
          aria-label="Choose a date"
          tabIndex={-1}
          value={dateInputValue(date)}
          onChange={(event) => {
            const next = parseLocalDate(event.target.value)
            if (next) onPickDate?.(next)
          }}
        />
      ) : null}
    </div>
  )
}

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
  date,
  onPickDate,
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
  /** Selected day. With `onPickDate`, a double-click on the date opens a picker. */
  date?: Date
  onPickDate?: (date: Date) => void
}) {
  const step = (className: string, aria: string, glyph: string, onClick: () => void) => (
    <button type="button" className={`trk-keycap ${className}`} data-no95="" aria-label={aria} onClick={onClick}>
      {glyph}
    </button>
  )
  if (variant === "crt") {
    return (
      <div className="trk-period-crt" data-locked={locked ? "true" : "false"}>
        <div className="trk-pgroup">
          {locked ? null : step("trk-period-chev", previousLabel, "‹", onPrevious)}
          <PeriodDate className="trk-scope-crt" label={label} meta={meta} date={date} onPickDate={onPickDate} locked={locked} />
          {locked ? null : step("trk-period-chev", nextLabel, "›", onNext)}
          {locked ? null : (
            <button type="button" className="trk-keycap trk-period-today" data-no95="" onClick={onToday}>
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
        step("trk-period-chev", previousLabel, "‹", onPrevious)
      )}
      <PeriodDate className="trk-period-title" label={label} meta={meta} date={date} onPickDate={onPickDate} locked={locked} />
      {locked ? (
        <span className="trk-period-chev" aria-hidden />
      ) : (
        step("trk-period-chev", nextLabel, "›", onNext)
      )}
      {locked ? null : (
        <button type="button" className="trk-keycap trk-period-today" data-no95="" onClick={onToday}>
          {todayLabel}
        </button>
      )}
      {trailing ? <div className="trk-period-trailing">{trailing}</div> : null}
    </div>
  )
}
