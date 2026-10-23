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
import "./analytics-boards.css"
import { useAnalyticsRange } from "./analytics-range-store"
import { CanvasTitle, SliceMosaic, StudioReadout } from "./studio-kit"
import { HOURS, buildHourPenRows, hourLabel } from "./hour-day"
import { shannonEntropy } from "@/lib/metrics"
import { effectiveCount, topShare } from "./time-views-stats"

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
  const clock = useMemo(
    () => (location ? buildHourPenRows(entries, dateKeys, location.id, location.pens, 24) : { rows: [], max: 0 }),
    [location, entries, dateKeys],
  )
  const [find, setFind] = useState("")
  const minutes = slices.map((s) => s.minutes)
  const total = minutes.reduce((s, m) => s + m, 0)
  const top = [...slices].sort((a, b) => b.minutes - a.minutes)[0]
  const placeBits = shannonEntropy(minutes)
  const clockRows = clock.rows.filter((r) => r.name.toLowerCase().includes(find.trim().toLowerCase()))

  return (
    <div className="an-canvas an-stack" data-testid="places-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Places</p>
          <p className="an-canvas-kicker">
            {label} · Time at each Location pen. Not a map.
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
            <>
            <section className="an-plate">
              <div className="an-readouts">
                <StudioReadout label="Places" value={`${slices.length}`} note={label} tip="Location pens with any painted minute in this window, at the chosen detail." />
                <StudioReadout label="Time placed" value={formatDuration(total)} note={`${formatDuration(Math.round(total / Math.max(1, dateKeys.length)))} / day`} tip="Painted Location minutes in this window." />
                <StudioReadout label="Top place" value={`${Math.round(topShare(minutes) * 100)}%`} note={top?.name ?? "—"} tip="Share of placed time spent at the single biggest place." />
                <StudioReadout label="Spread" value={`≈ ${effectiveCount(placeBits).toFixed(1)}`} note={`${placeBits.toFixed(2)} bits`} tip="Shannon entropy of place shares, shown as the number of equally used places it equals (2^H). 1 = one place." />
              </div>
            </section>
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
              <ul className="an-cover-bars an-places-ranked" aria-label="Places ranked by time">
                {[...slices]
                  .sort((a, b) => b.minutes - a.minutes)
                  .map((s) => (
                    <li key={s.id} className="is-in">
                      <span className="an-anchor-label">{s.name}</span>
                      <span className="an-anchor-track" aria-hidden>
                        <span style={{ width: `${(s.minutes / Math.max(1, top?.minutes ?? 1)) * 100}%`, background: s.color }} />
                      </span>
                      <span className="an-anchor-value">
                        {formatDuration(s.minutes)} · {Math.round((s.minutes / Math.max(1, total)) * 100)}%
                      </span>
                    </li>
                  ))}
              </ul>
            </section>
            <section className="an-plate" data-testid="places-clock">
              <CanvasTitle
                title="Place clock"
                help="One row per Location pen (finest level), one cell per hour of the day. Darker = more minutes there in that hour, summed over the window. Shows where each hour of your day usually happens."
              />
              {clock.rows.length > 6 ? (
                <label className="an-studio-field an-find-inline">
                  <span>Find a place</span>
                  <input value={find} onChange={(e) => setFind(e.target.value)} placeholder="Type a name" aria-label="Find a place" />
                </label>
              ) : null}
              <div className="an-digit-grid" role="table" aria-label="Minutes per place per hour">
                <div className="an-digit-row is-head" role="row">
                  <span role="columnheader" />
                  {HOURS.map((h) => (
                    <span key={h} role="columnheader">{h % 6 === 0 ? hourLabel(h) : ""}</span>
                  ))}
                </div>
                {clockRows.map((row) => (
                  <div key={row.id} className="an-digit-row" role="row">
                    <span role="rowheader" title={`${row.name} · ${formatDuration(row.total)}`}>{row.name}</span>
                    {row.hours.map((m, h) => (
                      <span
                        key={h}
                        role="cell"
                        title={`${row.name} · ${hourLabel(h)} · ${formatDuration(m)}`}
                        style={{ background: row.color, opacity: m ? 0.15 + 0.85 * (m / Math.max(1, clock.max)) : 0.04 }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              {clockRows.length === 0 ? <p className="an-n">No place matches “{find}”.</p> : null}
            </section>
            </>
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
  const [unnamedOnly, setUnnamedOnly] = useState(false)
  const shown = [...places].filter((p) => !unnamedOnly || !p.name).sort((a, b) => b.count - a.count)

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
        <>
        <label className="an-places-toggle">
          <input type="checkbox" checked={unnamedOnly} onChange={(e) => setUnnamedOnly(e.target.checked)} />
          Unnamed only · most pins first
        </label>
        <ul className="an-places-list">
          {shown.map((place) => {
            const key = coordLabel(place)
            const draft = drafts[key] ?? place.name
            return (
              <li key={key} className="an-find-field an-places-row">
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
        </>
      )}
    </section>
  )
}
