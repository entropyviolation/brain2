/**
 * Now → Tracking pane. The day Time Grid and the day notes log.
 * Current moment (Working on, Events, Thought process, Update state)
 * sits above the pane switch and is shared with Plan.
 */
"use client"

import { lazy, Suspense } from "react"
import { MachineLoading } from "@/components/machine-loading"
import { TrackingDayNotes } from "@/components/Home/Tracking/tracking-day-notes"

const TimeGrid = lazy(() =>
  import("@/components/Home/Tracking/time-grid").then((mod) => ({ default: mod.TimeGrid })),
)

export function TrackingPane() {
  return (
    <div className="htk-pane" role="tabpanel" aria-label="Tracking">
      <div className="htk-grid">
        <Suspense fallback={<MachineLoading />}>
          <TimeGrid />
        </Suspense>
      </div>
      <TrackingDayNotes currentDate={new Date()} forceOpen />
    </div>
  )
}
