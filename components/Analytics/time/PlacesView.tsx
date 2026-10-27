/**
 * components/Analytics/PlacesView.tsx — Location-scope time mosaic
 *
 * Time at each Location pen, plus the repeated GPS pins (`gps-places.ts`)
 * so a place seen more than once can be named. Depth uses the Location
 * scope's own rungs (country → park). This is not a map.
 */
"use client"

import { useMemo, useState, useSyncExternalStore } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatDuration } from "@/lib/time-entries"
import { DepthControl } from "@/components/Home/Tracking/depth-control"
import { entriesInRange, penTotalsAtDepth } from "@/lib/tracking-summary"
import type { DisplayDepth } from "@/lib/pen-tree"
import { adoptGpsPlaceName } from "@/lib/ingest/apply-gps"
import {
  GPS_CLUSTER_RADIUS_M,
  getGpsPlacesServerSnapshot,
  getGpsPlacesSnapshot,
  setGpsPlaceName,
  subscribeGpsPlaces,
  type GpsPlace,
} from "@/lib/ingest/gps-places"
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
            {label} · Location pens as a mosaic. Repeated GPS pins can be named below. This is time-at-pen, not a map.
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
            <section className="an-plate">
              <p className="an-canvas-title">Time at pen</p>
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
            </section>
          )}
        </>
      )}
      <RepeatedPlaces />
    </div>
  )
}

function coordLabel(place: GpsPlace): string {
  return `${place.lat.toFixed(5)}, ${place.lon.toFixed(5)}`
}

function RepeatedPlaces() {
  const places = useSyncExternalStore(subscribeGpsPlaces, getGpsPlacesSnapshot, getGpsPlacesServerSnapshot)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  return (
    <section className="an-plate" data-testid="repeated-places">
      <p className="an-canvas-title">Repeated coordinates</p>
      <p className="an-n">
        A pin joins a place when it is within {GPS_CLUSTER_RADIUS_M} meters of that place&apos;s center. A place
        appears here after a second visit. Naming it makes the next pin there that Location pen. A blank name leaves
        the coordinates unnamed.
      </p>
      {places.length === 0 ? (
        <p className="an-n">No place has shown up twice yet.</p>
      ) : (
        <ul className="an-stack" style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {places.map((place) => {
            const key = coordLabel(place)
            const draft = drafts[key] ?? place.name
            return (
              <li key={key} className="an-find-field">
                <label className="an-find-label">
                  {key} · {place.count} pins
                  <input
                    aria-label={`Name for ${key}`}
                    value={draft}
                    placeholder="Name this place"
                    title="This name becomes the Location pen the next time a pin lands here."
                    onChange={(event) => setDrafts((prev) => ({ ...prev, [key]: event.target.value }))}
                  />
                </label>
                <button
                  type="button"
                  className="an-open-lists"
                  onClick={() => {
                    const name = draft.trim()
                    setGpsPlaceName(place, name)
                    if (name) adoptGpsPlaceName(name, place)
                    setDrafts((prev) => {
                      const next = { ...prev }
                      delete next[key]
                      return next
                    })
                  }}
                >
                  Save name
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
