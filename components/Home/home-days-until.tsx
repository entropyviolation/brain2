/**
 * components/Home/home-days-until.tsx — Days Until live countdown
 *
 * Caption, a CRT countdown, and what you are counting toward. Optional
 * clock time and unit/decimal format live in the detail view; the compact
 * card shows the chosen form and ticks while open.
 */
"use client"

import { useEffect, useState } from "react"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { daysUntilLiveFace, daysUntilRemainingMs } from "@/lib/home-widgets"
import {
  useHomeDaysUntilStore,
  type DaysUntilFormat,
} from "@/lib/home-days-until-store"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell } from "@/components/Home/home-widget-dialog"

export function DaysUntilTile({
  currentDate: _currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  void _currentDate
  const label = useHomeDaysUntilStore((s) => s.label)
  const date = useHomeDaysUntilStore((s) => s.date)
  const time = useHomeDaysUntilStore((s) => s.time)
  const format = useHomeDaysUntilStore((s) => s.format)
  const setCountdown = useHomeDaysUntilStore((s) => s.setCountdown)
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 15_000)
    return () => window.clearInterval(id)
  }, [])

  const remainingMs = daysUntilRemainingMs(date, time, now)
  const face = daysUntilLiveFace({
    remainingMs,
    label,
    format,
    hasTime: Boolean(time),
  })

  return (
    <>
      <div className="home-tile is-daysuntil" data-widget="daysuntil" data-testid="home-daysuntil-tile">
        <TileHide id="daysuntil" onHide={onHide} />
        <TileOpen label="Days Until" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Days Until</span>
          </div>
          <div className="hab-score-readout home-daysuntil-count" data-centered="true" suppressHydrationWarning>
            {face.crt}
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{face.footer}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Days Until">
        <WidgetWell label={face.footer || "Countdown"} tone="nixie">
          <span suppressHydrationWarning>{face.crt}</span>
        </WidgetWell>
        <label className="home-widget-field">
          Label
          <input
            value={label}
            maxLength={40}
            onChange={(event) => setCountdown({ label: event.target.value })}
          />
        </label>
        <label className="home-widget-field">
          Date
          <input
            type="date"
            value={date}
            onChange={(event) => setCountdown({ date: event.target.value })}
          />
        </label>
        <label className="home-widget-field">
          Time <span className="home-widget-optional">(optional)</span>
          <ClockPicker value={time} onChange={(next) => setCountdown({ time: next })} />
        </label>
        {time ? (
          <button
            type="button"
            className="home-review-key"
            onClick={() => setCountdown({ time: "" })}
          >
            Clear time
          </button>
        ) : null}
        <fieldset className="home-widget-fieldset">
          <legend>Display</legend>
          <label className="home-widget-choice">
            <input
              type="radio"
              name="daysuntil-format"
              checked={format === "unit"}
              onChange={() => setCountdown({ format: "unit" satisfies DaysUntilFormat })}
            />
            Units — <code>01 day 3 hours</code> / <code>03 hours 30 min</code>
          </label>
          <label className="home-widget-choice">
            <input
              type="radio"
              name="daysuntil-format"
              checked={format === "decimal"}
              onChange={() => setCountdown({ format: "decimal" })}
            />
            Decimal — <code>1.25 days</code> / <code>3.5 hours</code>
          </label>
        </fieldset>
      </HomeWidgetDialog>
    </>
  )
}
