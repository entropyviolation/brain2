/**
 * components/Analytics/CircadianView.tsx — Hour × day occupancy atlas
 *
 * Added (docs/analytics/time-circadian.md): weekday / weekend filter, rhythm
 * numbers (IS, IV, M10, L5, RA), a 24-hour wheel, and the instants listed.
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { HourDayHeatmap, StudioReadout, StudioSelect } from "./studio-kit"
import { CyclePlot } from "./studio-plots"
import { buildHourDayGrid, buildWeekdayHourCycle, hourLabel } from "./hour-day"
import { filterDays, rhythmStats, type DayFilter } from "./circadian-rhythm"
import "./time-rhythms.css"

const RING_ORDER = [1, 2, 3, 4, 5, 6, 0] as const
const RING_NAME = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  const p = (r: number, a: number) => `${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`
  return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`
}

/**
 * 24-hour wheel: one ring per weekday (Monday inside, Sunday outside), one
 * wedge per hour, midnight at the top. Darker = more of that hour painted.
 */
function DayWheel({ mean, days, hue }: { mean: number[][]; days: number[]; hue: number }) {
  const C = 160
  const R0 = 34
  const RW = 17
  return (
    <div className="an-tr-wheel">
    <svg className="an-tr-svg" viewBox="0 0 320 320" role="img" aria-label="24-hour wheel by weekday">
      {RING_ORDER.map((wd, ring) =>
        Array.from({ length: 24 }, (_, h) => {
          const a0 = ((h * 15 - 90) * Math.PI) / 180
          const a1 = (((h + 1) * 15 - 90) * Math.PI) / 180
          const v = days[wd] ? (mean[wd]?.[h] ?? 0) / 60 : 0
          return (
            <path
              key={`${wd}-${h}`}
              d={arcPath(C, C, R0 + ring * RW, R0 + (ring + 1) * RW - 1, a0, a1)}
              fill={days[wd] ? `hsl(${hue} 60% ${92 - v * 62}%)` : "transparent"}
              stroke="var(--at-paper-hi)"
              strokeWidth={0.75}
            >
              <title>{`${RING_NAME[wd]} ${hourLabel(h)} · ${days[wd] ? `${Math.round(v * 60)} min avg over ${days[wd]} days` : "no painted days"}`}</title>
            </path>
          )
        }),
      )}
      {[0, 6, 12, 18].map((h) => {
        const a = ((h * 15 - 90) * Math.PI) / 180
        const r = R0 + 7 * RW + 10
        return (
          <text key={h} x={C + r * Math.cos(a)} y={C + r * Math.sin(a) + 3} textAnchor="middle">
            {hourLabel(h)}
          </text>
        )
      })}
      <text x={C} y={C - 2} textAnchor="middle">Mon</text>
      <text x={C} y={C + 10} textAnchor="middle">inside</text>
    </svg>
    </div>
  )
}

const FILTERS: { id: DayFilter; label: string }[] = [
  { id: "all", label: "All days" },
  { id: "weekdays", label: "Weekdays" },
  { id: "weekend", label: "Weekend" },
]

export function CircadianView() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const { dateKeys: rangeKeys, label } = useAnalyticsRange()
  const [dayFilter, setDayFilter] = useState<DayFilter>("all")
  const dateKeys = useMemo(() => filterDays(rangeKeys, dayFilter), [rangeKeys, dayFilter])
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
  const rhythm = useMemo(() => (grid ? rhythmStats(grid) : null), [grid])
  const hue = scope?.name === "Mood" ? 312 : 188
  const penName = useMemo(() => new Map((scope?.pens ?? []).map((p) => [p.id, p.name])), [scope])

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
      <div className="an-tr-controls" role="group" aria-label="Days">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className="an-chip" aria-pressed={dayFilter === f.id} onClick={() => setDayFilter(f.id)}>
            {f.label}
          </button>
        ))}
      </div>
      {!grid || grid.observedDays === 0 ? (
        <ChartFrame empty emptySentence={`Nothing painted in ${scope?.name ?? "this scope"} in the ${label}.`} />
      ) : (
        <>
          <p className="an-n">
            n = {grid.observedDays} days with paint
            {mood && scope?.id === mood.id ? " · Mood field" : ""}
            {grid.instants.length > 0 ? ` · ${grid.instants.length} instants listed below` : ""}
          </p>
          <section className="an-plate">
            <p className="an-canvas-title">Hour × day</p>
            <div className="an-plot-well">
              <HourDayHeatmap grid={grid} hue={hue} />
            </div>
          </section>
          <section className="an-plate" data-testid="circadian-rhythm">
            <p className="an-canvas-title">Rhythm</p>
            {rhythm ? (
              <>
                <p className="an-tr-lede">
                  {`Your busiest ten hours start at ${hourLabel(rhythm.m10Start)}, your quietest five at ${hourLabel(rhythm.l5Start)}. `}
                  {rhythm.is >= 0.6
                    ? "Days look much alike."
                    : rhythm.is >= 0.35
                      ? "Days share a shape, loosely."
                      : "Days differ a lot from each other."}
                </p>
                <div className="an-readouts">
                  <StudioReadout
                    label="Interdaily stability"
                    value={rhythm.is.toFixed(2)}
                    note="0 = no shared shape · 1 = identical days"
                    tip="IS (Van Someren 1999): variance of the mean day over total variance. Healthy adult actigraphy is often 0.5–0.8."
                  />
                  <StudioReadout
                    label="Intradaily variability"
                    value={rhythm.iv.toFixed(2)}
                    note="higher = more broken up hour to hour"
                    tip="IV (Van Someren 1999): mean squared hour-to-hour change over total variance. Near 0 is one smooth block, near 2 is noise."
                  />
                  <StudioReadout
                    label="M10 / L5"
                    value={`${Math.round(rhythm.m10)} / ${Math.round(rhythm.l5)} min`}
                    note={`from ${hourLabel(rhythm.m10Start)} / from ${hourLabel(rhythm.l5Start)} · per hour`}
                  />
                  <StudioReadout
                    label="Relative amplitude"
                    value={rhythm.ra.toFixed(2)}
                    note="(M10 − L5) / (M10 + L5)"
                    tip="RA near 1 means a strong day/night contrast in this scope."
                  />
                </div>
                <p className="an-n">n = {rhythm.days} painted days. Methods from actigraphy, here on painted minutes, so they describe your log.</p>
              </>
            ) : (
              <p className="an-canvas-hint">Needs 3 painted days with some change across the day.</p>
            )}
          </section>
          <section className="an-plate" data-testid="circadian-wheel">
            <p className="an-canvas-title">24-hour wheel</p>
            <p className="an-canvas-kicker">
              Midnight at the top, clockwise. One ring per weekday, Monday inside, Sunday outside. Darker is more of
              that hour painted on an average day.
            </p>
            <DayWheel mean={cycle.mean} days={cycle.days} hue={hue} />
          </section>
          <section className="an-plate">
            <CyclePlot
              mean={cycle.mean}
              title="Weekday cycle"
              help="Cleveland (1993) cycle plot: mean occupancy by hour, one row per weekday. Only days with paint enter the mean — a blank Tuesday is not a 0-work Tuesday. Empty hours stay opaque white."
              empty={`Nothing painted in ${scope?.name ?? "this scope"} in the ${label}.`}
            />
          </section>
        </>
      )}
      {grid && grid.instants.length > 0 && (
        <details className="an-tr-fold">
          <summary>
            {grid.instants.length} instant{grid.instants.length === 1 ? "" : "s"} (no duration) in this window
          </summary>
          <ul className="an-stack text-xs">
            {[...grid.instants]
              .sort((a, b) => (a.date === b.date ? b.startMin - a.startMin : a.date < b.date ? 1 : -1))
              .slice(0, 200)
              .map((e) => (
                <li key={e.id}>
                  <span className="tabular-nums">
                    {e.date} {String(Math.floor(e.startMin / 60)).padStart(2, "0")}:{String(e.startMin % 60).padStart(2, "0")}
                  </span>
                  {" · "}
                  {penName.get(e.penId) ?? "unnamed pen"}
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  )
}
