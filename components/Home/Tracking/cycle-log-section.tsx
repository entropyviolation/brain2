/**
 * components/Home/Tracking/cycle-log-section.tsx — Cycle on the Tracking log
 *
 * Hidden entirely when Enable cycle tracking is off. Toggles write through
 * `toggleCycleFlag` on `lib/cycle-marks.ts`. The phase line is `phaseForDate`.
 * Cycle detail opens the three-lens reading. Phase is not stored.
 */
"use client"

import { useState } from "react"
import { CycleDetailDialog } from "@/components/Home/Tracking/cycle-detail-dialog"
import { toggleCycleFlag, useCycleMarksStore, type CycleFlag } from "@/lib/cycle-marks"
import { phaseForDate } from "@/lib/cycle-phase"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import "./tracking-chrome.css"

const TOGGLES: { flag: CycleFlag; label: string }[] = [
  { flag: "bleeding", label: "Bleeding" },
  { flag: "spotting", label: "Spotting" },
  { flag: "ovulation", label: "Ovulation" },
]

export function CycleLogSection({ date }: { date: string }) {
  const enabled = useTimeTrackingStore((s) => s.enableCycleTracking)
  const marks = useCycleMarksStore((s) => s.marks)
  const [open, setOpen] = useState(false)
  if (!enabled) return null

  const mark = marks[date]
  const phase = phaseForDate(date, marks)

  return (
    <section className="trk-aside-well" aria-label="Cycle">
      <h3 className="trk-logbook-heading">Cycle</h3>
      <p data-testid="tracking-log-phase">Phase: {phase}</p>
      <p className="trk-logbook-note">Labeled from bleed days and ovulation marks. Not a medical prediction.</p>
      <p className="trk-logbook-note">Spotting is recorded and does not change the phase.</p>
      <div className="trk-span-switch" role="group" aria-label="Cycle marks">
        {TOGGLES.map((row) => (
          <button
            key={row.flag}
            type="button"
            aria-pressed={mark?.[row.flag] === true}
            onClick={() => toggleCycleFlag(date, row.flag)}
          >
            {row.label}
          </button>
        ))}
      </div>
      <button type="button" className="trk-cycle-open" onClick={() => setOpen(true)}>
        Cycle detail
      </button>
      {open ? <CycleDetailDialog date={date} onClose={() => setOpen(false)} /> : null}
    </section>
  )
}
