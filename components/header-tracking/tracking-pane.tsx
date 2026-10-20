/**
 * Now → Tracking pane. The same three-bay desk as Home → Tracking: the pen
 * rack, the Time Grid screen, and the time recorder. The day summary sits
 * under it in the same lace frame, inside the `.trk95` chassis its styles
 * are scoped to. Current moment (Working on, lanes, Events, Thought process)
 * sits above the pane switch and is shared with Plan.
 */
"use client"

import { lazy, Suspense, useState } from "react"
import { MachineLoading } from "@/components/machine-loading"
import { TrackingDayNotes } from "@/components/Home/Tracking/tracking-day-notes"
import { TrackingDeskSlotsContext } from "@/components/Home/Tracking/tracking-desk-slots"
import { PenPalette } from "@/components/Home/Tracking/pen-palette"
import { PenModeDeck } from "@/components/Home/Tracking/pen-mode-bar"

const TimeGrid = lazy(() =>
  import("@/components/Home/Tracking/time-grid").then((mod) => ({ default: mod.TimeGrid })),
)

export function TrackingPane() {
  const [summarySlot, setSummarySlot] = useState<HTMLDivElement | null>(null)

  return (
    <div className="htk-pane" role="tabpanel" aria-label="Tracking">
      <div className="trk95 htk-desk">
        <TrackingDeskSlotsContext.Provider value={{ fillSlot: null, summarySlot }}>
          <div className="trk-desk" data-rack="true">
            <PenPalette variant="rack" />
            <div className="trk-desk-main trk-desktop">
              <Suspense fallback={<MachineLoading />}>
                <TimeGrid showPalette={false} desk deck={<PenModeDeck ghostLeds />} />
              </Suspense>
            </div>
          </div>
          <section className="trk-lace htk-lace" aria-label="Summaries">
            <div className="trk-lace-paper">
              <div ref={setSummarySlot} className="trk-summary-slot" />
              <TrackingDayNotes currentDate={new Date()} forceOpen />
            </div>
          </section>
        </TrackingDeskSlotsContext.Provider>
      </div>
    </div>
  )
}
