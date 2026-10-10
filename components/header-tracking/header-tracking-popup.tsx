/**
 * Now popup body. Current moment is the top. Tracking and Plan switch under it.
 * The Home → Tracking desk is a different screen.
 */
"use client"

import { lazy, Suspense, useState } from "react"
import { MachineLoading } from "@/components/machine-loading"
import { CurrentMomentDeck } from "@/components/header-tracking/current-moment"
import "./header-tracking.css"

const TrackingPane = lazy(() =>
  import("@/components/header-tracking/tracking-pane").then((mod) => ({ default: mod.TrackingPane })),
)
const PlanPane = lazy(() =>
  import("@/components/header-tracking/plan-pane").then((mod) => ({ default: mod.PlanPane })),
)

export function HeaderTrackingPopup({
  pane: paneProp,
  onPane,
}: {
  pane?: "tracking" | "plan"
  onPane?: (pane: "tracking" | "plan") => void
} = {}) {
  const [inner, setInner] = useState<"tracking" | "plan">("tracking")
  const pane = paneProp ?? inner

  function choose(next: "tracking" | "plan") {
    setInner(next)
    onPane?.(next)
  }

  return (
    <div className="htk-body" data-ui-name="Now" data-ui-docs="components/header-tracking/README.md">
      <CurrentMomentDeck />
      <div className="htk-panes" role="tablist" aria-label="Now">
        <button
          type="button"
          role="tab"
          id="htk-tab-tracking"
          aria-selected={pane === "tracking"}
          aria-controls="htk-panel"
          onClick={() => choose("tracking")}
        >
          Tracking
        </button>
        <button
          type="button"
          role="tab"
          id="htk-tab-plan"
          aria-selected={pane === "plan"}
          aria-controls="htk-panel"
          onClick={() => choose("plan")}
        >
          Plan
        </button>
      </div>
      <div className="htk-scroll" id="htk-panel">
        <Suspense fallback={<MachineLoading />}>
          {pane === "tracking" ? <TrackingPane /> : <PlanPane onOpenTracking={() => choose("tracking")} />}
        </Suspense>
      </div>
    </div>
  )
}
