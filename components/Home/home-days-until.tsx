/**
 * components/Home/home-days-until.tsx — Days Until countdown
 *
 * Caption, a CRT count, and "Days Until {label}". Click sets the date and
 * the label. The count is calendar days from the selected Home day.
 */
"use client"

import { useState } from "react"
import { daysUntilCount, daysUntilFace } from "@/lib/home-widgets"
import { useHomeDaysUntilStore } from "@/lib/home-days-until-store"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell } from "@/components/Home/home-widget-dialog"

export function DaysUntilTile({
  currentDate,
  onHide,
}: {
  currentDate: Date
  onHide: () => void
}) {
  const label = useHomeDaysUntilStore((s) => s.label)
  const date = useHomeDaysUntilStore((s) => s.date)
  const setCountdown = useHomeDaysUntilStore((s) => s.setCountdown)
  const [open, setOpen] = useState(false)
  const face = daysUntilFace(daysUntilCount(date, currentDate), label)

  return (
    <>
      <div className="home-tile is-daysuntil" data-widget="daysuntil" data-testid="home-daysuntil-tile">
        <TileHide id="daysuntil" onHide={onHide} />
        <TileOpen label="Days Until" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Days Until</span>
          </div>
          <div className="hab-score-readout home-daysuntil-count" data-centered="true">
            {face.crt}
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{face.footer}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Days Until">
        <WidgetWell label={face.footer || "Days"} tone="nixie">{face.crt}</WidgetWell>
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
      </HomeWidgetDialog>
    </>
  )
}
