/**
 * components/Home/Tracking/cycle-log-section.tsx — Cycle on the Tracking log
 *
 * Hidden entirely when Enable cycle tracking is off. While that feature is on,
 * `cycleDetailsOpen` (default closed) still conceals the phase line, mark
 * toggles, and Cycle detail. Show cycle / Hide cycle is that latch. Toggles
 * write through `toggleCycleFlag` on `lib/cycle-marks.ts`. The phase line is
 * `phaseForDate`. Cycle detail opens the three-lens reading. Phase is not stored.
 */
"use client"

import { useEffect, useState } from "react"
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
  const detailsOpen = useTimeTrackingStore((s) => s.cycleDetailsOpen)
  const setDetailsOpen = useTimeTrackingStore((s) => s.setCycleDetailsOpen)
  const marks = useCycleMarksStore((s) => s.marks)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!detailsOpen) setOpen(false)
  }, [detailsOpen])

  if (!enabled) return null

  const mark = detailsOpen ? marks[date] : undefined
  const phase = detailsOpen ? phaseForDate(date, marks) : null

  return (
    <section className="trk-aside-well" aria-label="Cycle">
      <button
        type="button"
        className="trk-cycle-privacy"
        aria-expanded={detailsOpen}
        onClick={() => setDetailsOpen(!detailsOpen)}
      >
        {detailsOpen ? "Hide cycle" : "Show cycle"}
      </button>
      {detailsOpen ? (
        <>
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
          <div className="trk-span-switch trk-cycle-quiet" role="group" aria-label="Private marks">
            <button
              type="button"
              aria-label="O"
              aria-pressed={mark?.o === true}
              onClick={() => useCycleMarksStore.getState().setPrivate(date, { o: mark?.o !== true })}
            >
              O
            </button>
            <button
              type="button"
              aria-label="Intimacy"
              aria-pressed={mark?.intimacy === true}
              onClick={() => useCycleMarksStore.getState().setPrivate(date, { intimacy: mark?.intimacy !== true })}
            >
              Intimacy
            </button>
          </div>
          {mark?.intimacy ? (
            <input
              key={date}
              className="trk-cycle-quiet-note"
              aria-label="Intimacy note"
              placeholder="note (optional)"
              defaultValue={mark.intimacyNote ?? ""}
              onBlur={(event) => useCycleMarksStore.getState().setPrivate(date, { intimacyNote: event.target.value })}
            />
          ) : null}
          <button type="button" className="trk-cycle-open" onClick={() => setOpen(true)}>
            Cycle detail
          </button>
          {open ? <CycleDetailDialog date={date} onClose={() => setOpen(false)} /> : null}
        </>
      ) : null}
    </section>
  )
}
