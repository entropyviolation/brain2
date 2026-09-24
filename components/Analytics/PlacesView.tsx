/**
 * components/Analytics/PlacesView.tsx — Location-scope time mosaic
 *
 * Not a geo map — pens have names, not lat/lng. Depth uses the Location
 * scope's own rungs (country → park).
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatDuration } from "@/lib/time-entries"
import { DepthControl } from "@/components/Home/Tracking/depth-control"
import { entriesInRange, penTotalsAtDepth } from "@/lib/tracking-summary"
import type { DisplayDepth } from "@/lib/pen-tree"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SliceMosaic } from "./studio-kit"

export function PlacesView() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const { dateKeys, label } = useAnalyticsRange()
  const location = scopes.find((s) => s.name === "Location") ?? scopes.find((s) => /location/i.test(s.name))
  const [depth, setDepth] = useState<DisplayDepth | null>(location?.displayDepth ?? null)

  const slices = useMemo(() => {
    if (!location) return []
    const scoped = entriesInRange(entries, dateKeys, location.id)
    return penTotalsAtDepth(scoped, location, dateKeys, depth)
  }, [location, entries, dateKeys, depth])

  return (
    <div className="an-canvas an-stack" data-testid="places-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Places</p>
          <p className="an-canvas-kicker">
            {label} · Location pens as a mosaic. No coordinates are stored — this is time-at-pen, not a map.
          </p>
        </div>
      </header>
      {!location ? (
        <ChartFrame empty emptySentence="No Location scope yet." />
      ) : (
        <>
          <DepthControl
            pens={location.pens}
            labels={location.depthLabels}
            value={depth}
            onChange={setDepth}
            ariaLabel="Location analytics detail"
          />
          {slices.length === 0 ? (
            <ChartFrame empty emptySentence={`Nothing painted in Location in the ${label}.`} />
          ) : (
            <SliceMosaic
              slices={slices.map((s) => ({
                id: s.id,
                name: s.name,
                color: s.color,
                minutes: s.minutes,
                label: formatDuration(s.minutes),
              }))}
              max={Math.max(...slices.map((s) => s.minutes), 1)}
            />
          )}
        </>
      )}
    </div>
  )
}
