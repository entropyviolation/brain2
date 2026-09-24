/**
 * components/Analytics/CircadianView.tsx — Hour × day occupancy atlas
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { HourDayHeatmap, StudioSelect } from "./studio-kit"
import { CyclePlot } from "./studio-plots"
import { buildHourDayGrid, buildWeekdayHourCycle } from "./hour-day"

export function CircadianView() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const { dateKeys, label } = useAnalyticsRange()
  const activity = scopes.find((s) => s.name === "Activity") ?? scopes[0]
  const mood = scopes.find((s) => s.name === "Mood")
  const [scopeId, setScopeId] = useState(activity?.id ?? "")
  const scope = scopes.find((s) => s.id === scopeId) ?? activity

  const grid = useMemo(
    () => (scope ? buildHourDayGrid(entries, dateKeys, scope.id) : null),
    [entries, dateKeys, scope],
  )
  const cycle = useMemo(
    () => (scope ? buildWeekdayHourCycle(entries, dateKeys, scope.id) : { mean: [], days: [], max: 0 }),
    [entries, dateKeys, scope],
  )

  return (
    <div className="an-canvas an-stack" data-testid="circadian-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Circadian</p>
          <p className="an-canvas-kicker">{label} · hour × day occupancy. Instants have no duration and stay off the heat.</p>
        </div>
        {scopes.length > 0 && (
          <StudioSelect label="Scope" value={scope?.id ?? ""} onChange={setScopeId}>
            {scopes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </StudioSelect>
        )}
      </header>
      {!grid || grid.observedDays === 0 ? (
        <ChartFrame empty emptySentence={`Nothing painted in ${scope?.name ?? "this scope"} in the ${label}.`} />
      ) : (
        <>
          <p className="an-n">
            n = {grid.observedDays} days with paint
            {mood && scope?.id === mood.id ? " · Mood field" : ""}
            {grid.instants.length > 0 ? ` · ${grid.instants.length} instants listed below` : ""}
          </p>
          <div style={{ ["--an-cols" as string]: String(Math.max(dateKeys.length, 1)) }}>
            <HourDayHeatmap grid={grid} hue={scope?.name === "Mood" ? 312 : 188} />
          </div>
          <CyclePlot
            mean={cycle.mean}
            title="Weekday cycle"
            help="Cleveland (1993) cycle plot: mean occupancy by hour, one row per weekday. Only days with paint enter the mean — a blank Tuesday is not a 0-work Tuesday. Empty hours stay gray."
            empty={`Nothing painted in ${scope?.name ?? "this scope"} in the ${label}.`}
          />
          {grid.instants.length > 0 && (
            <p className="an-canvas-hint">
              {grid.instants.length} instant{grid.instants.length === 1 ? "" : "s"} (no duration) in this window.
            </p>
          )}
        </>
      )}
    </div>
  )
}
