/**
 * components/Analytics/cycle-phase-concealed.tsx — Time → Cycle phase, closed
 *
 * The studio shell mounts this instead of `CyclePhaseView` when cycle tracking
 * is on and `cycleDetailsOpen` is false. The concealed sentence lives only
 * here. It does not import that view. Feature off keeps today's canvas: this
 * gate stays false.
 */
"use client"

import { useTimeTrackingStore } from "@/lib/time-tracking-store"

/** True only when the feature is on and the privacy latch is closed. */
export function cycleDetailsConcealed(enabled: boolean, open: boolean): boolean {
  return enabled && !open
}

export function CyclePhaseConcealed() {
  const setOpen = useTimeTrackingStore((s) => s.setCycleDetailsOpen)
  return (
    <div className="an-chart-frame" data-testid="cycle-phase-concealed">
      <p className="an-chart-empty">Cycle details are concealed.</p>
      <button type="button" className="an-open-lists" onClick={() => setOpen(true)}>
        Show cycle
      </button>
    </div>
  )
}
