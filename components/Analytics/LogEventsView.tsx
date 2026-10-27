/**
 * components/Analytics/LogEventsView.tsx — Time → Log
 *
 * Day bars, kind counts, and a clock scatter of exact and estimated times.
 * Unknown clocks are a count. The phase strip reads cycle marks over this
 * window. Filter by the kind string; there is no preset list of events.
 * Adds a unit grid (one square per event, by clock certainty) and a rhythm
 * table (circular mean time, regularity, median gap).
 * Docs: `docs/analytics/time-log.md`.
 */
"use client"

import { Fragment, useMemo, useState } from "react"
import { ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { minutesToLabel } from "@/lib/time-entries"
import { parseLocalDate } from "@/lib/date-utils"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { CanvasTitle, StudioReadout, STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP } from "./studio-kit"
import {
  asLogEntry,
  classifyLogInstant,
  useLogCycleMarks,
} from "@/components/Home/Tracking/tracking-log-model"
import { kindRhythms } from "./time-flow-stats"
import "./time-flow.css"
import { countLogEventsByDay, countLogEventsByKind, logClockScatter, logPhaseStrip, type LogEventPoint } from "./log-event-stats"

const LOG_FILL = "#1a6b5c"
const KIND_COLORS = ["#1a6b5c", "#c2410c", "#7c3aed", "#b45309", "#0f766e", "#be185d", "#4d7c0f", "#475569"]

function gapLabel(hours: number | null): string {
  if (hours == null) return "—"
  if (hours < 1) return `${Math.round(hours * 60)}m`
  if (hours < 48) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

function dayLabel(key: string): string {
  const d = parseLocalDate(key)
  if (!d) return key
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })
}

export function LogEventsView() {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const { dateKeys, keySet, label } = useAnalyticsRange()
  const { marksByDate } = useLogCycleMarks()
  const [kindFilter, setKindFilter] = useState("")

  const penName = useMemo(() => {
    const map = new Map<string, string>()
    for (const scope of scopes) {
      for (const pen of scope.pens) map.set(pen.id, pen.name)
    }
    return map
  }, [scopes])

  const classified = useMemo(() => {
    const rows = []
    for (const entry of entries) {
      if (!keySet.has(entry.date)) continue
      const row = classifyLogInstant(asLogEntry(entry), penName.get(entry.penId))
      if (row) rows.push(row)
    }
    return rows
  }, [entries, keySet, penName])

  const filter = kindFilter.trim().toLowerCase()
  const shown = filter ? classified.filter((row) => row.kindKey.toLowerCase().includes(filter)) : classified
  const allKinds = useMemo(() => countLogEventsByKind(classified), [classified])
  const colorOfKind = (kind: string) => {
    const i = allKinds.findIndex((k) => k.kind === kind)
    return KIND_COLORS[(i < 0 ? 0 : i) % KIND_COLORS.length]
  }
  const points: LogEventPoint[] = shown.map((row) => ({
    id: row.id,
    date: row.date,
    startMin: row.startMin,
    kindKey: row.kindKey,
    clockCertainty: row.clockCertainty,
  }))

  const byDay = countLogEventsByDay(points, dateKeys).map((row) => ({
    ...row,
    label: dayLabel(row.date),
  }))
  const byKind = countLogEventsByKind(points)
  const scatter = logClockScatter(points)
  const scatterRows = [...scatter.points]
    .sort((x, y) => x.date.localeCompare(y.date))
    .map((pt) => ({ ...pt, day: dayLabel(pt.date) }))
  const rhythms = kindRhythms(points)
  const ordered = [...shown].sort((a, b) => a.date.localeCompare(b.date) || a.startMin - b.startMin)
  const certainty = {
    exact: points.filter((p) => !p.clockCertainty || p.clockCertainty === "exact").length,
    estimated: points.filter((p) => p.clockCertainty === "estimated").length,
  }
  const strip = logPhaseStrip(dateKeys, marksByDate)
  const phaseLabeled = strip.some((cell) => cell.phase !== "unknown")

  return (
    <div className="an-canvas an-stack tf-view" data-testid="log-events-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Log"
            help="Food, drink, drug, bare intake, and any event phrase. Counts by day and by kind. Exact and estimated clocks are plotted; unknown clocks are a count, not a point. The phase strip is labeled from bleed days and ovulation marks — not a medical prediction. Spotting does not change the phase."
          />
          <p className="an-canvas-kicker">{label}</p>
        </div>
      </header>

      <label className="an-studio-field">
        <span>Kind</span>
        <input
          aria-label="Kind"
          value={kindFilter}
          placeholder="intake.food, left room"
          onChange={(event) => setKindFilter(event.target.value)}
        />
      </label>
      {allKinds.length > 1 ? (
        <div className="tf-tools" role="group" aria-label="Kinds">
          {allKinds.slice(0, 10).map((k) => (
            <button
              key={k.kind}
              type="button"
              className="an-chip"
              aria-pressed={filter === k.kind.toLowerCase()}
              onClick={() => setKindFilter(filter === k.kind.toLowerCase() ? "" : k.kind)}
            >
              {k.kind} · {k.count}
            </button>
          ))}
        </div>
      ) : null}

      {shown.length === 0 ? (
        <ChartFrame
          empty
          emptySentence={
            filter
              ? `No log instants with kind “${kindFilter.trim()}” in the ${label}.`
              : `No log instants in the ${label}. Food, drink, drug, and event phrases such as left room land here.`
          }
        />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="Events" value={shown.length} note={filter || "all kinds"} />
            <StudioReadout label="Exact" value={certainty.exact} note="clock known" />
            <StudioReadout label="Estimated" value={certainty.estimated} note="~ clock" />
            <StudioReadout label="Unknown clocks" value={scatter.unknownCount} note="not plotted" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byDay}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} minTickGap={12} />
              <YAxis allowDecimals={false} fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Bar dataKey="count" name="Events" fill={LOG_FILL} />
            </BarChart>
          </ResponsiveContainer>
          <section className="an-plate" aria-label="Every event">
            <CanvasTitle
              title="Every event, one square"
              help="Unit grid: one square per log instant, grouped by kind, oldest first. Solid = exact clock, hatched = estimated (~), hollow = unknown clock. The row label is the count."
            />
            <div className="tf-units">
              {byKind.map((row) => (
                <Fragment key={row.kind}>
                  <span className="tf-name" title={row.kind}>
                    {row.kind} <span className="an-n">{row.count}</span>
                  </span>
                  <span className="tf-unit-row">
                    {ordered
                      .filter((e) => e.kindKey === row.kind)
                      .map((e) => (
                        <i
                          key={e.id}
                          className={`tf-unit${e.clockCertainty === "estimated" ? " is-est" : e.clockCertainty === "unknown" ? " is-unknown" : ""}`}
                          title={`${e.title?.trim() || row.kind} · ${e.date}${e.clockCertainty === "unknown" ? "" : ` ${e.clockCertainty === "estimated" ? "~" : ""}${minutesToLabel(e.startMin)}`}`}
                          style={{ background: colorOfKind(row.kind) }}
                        />
                      ))}
                  </span>
                </Fragment>
              ))}
            </div>
          </section>
          <section className="an-plate" aria-label="Rhythm by kind">
            <CanvasTitle
              title="Rhythm by kind"
              help="Typical time is the circular mean of known clocks, so 23:50 and 0:10 average to midnight, not noon. Regularity is the mean resultant length r: 1 = always the same time, 0 = spread round the clock. Gap is the median time between one event of a kind and the next. Unknown clocks are left out of all three."
            />
            <div className="an-matrix-wrap">
              <table className="an-phase-table">
                <thead>
                  <tr>
                    <th>Kind</th>
                    <th>n</th>
                    <th>Typical time</th>
                    <th>Regularity</th>
                    <th>Every</th>
                  </tr>
                </thead>
                <tbody>
                  {rhythms.map((r) => (
                    <tr key={r.kind}>
                      <td>{r.kind}</td>
                      <td>{r.count}</td>
                      <td>{r.clock ? minutesToLabel(r.clock.meanMin) : "—"}</td>
                      <td title={r.clock ? `r = ${r.clock.r.toFixed(2)}` : ""}>
                        {r.clock && r.count - r.unknown > 1 ? `${Math.round(r.clock.r * 100)}%` : "—"}
                      </td>
                      <td>{gapLabel(r.medianGapH)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          {scatter.points.length > 0 ? (
            <>
              <p className="an-canvas-title">Clock</p>
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart>
                  <CartesianGrid stroke={STUDIO_GRID} />
                  <XAxis dataKey="day" type="category" allowDuplicatedCategory={false} fontSize={11} stroke={STUDIO_AXIS} minTickGap={12} />
                  <YAxis
                    dataKey="minute"
                    type="number"
                    domain={[0, 1439]}
                    ticks={[0, 360, 720, 1080]}
                    tickFormatter={(value: number) => minutesToLabel(value)}
                    fontSize={11}
                    stroke={STUDIO_AXIS}
                  />
                  <Tooltip
                    contentStyle={STUDIO_TOOLTIP}
                    formatter={(value, name) => {
                      if (name === "minute" && typeof value === "number") return [minutesToLabel(value), "Time"]
                      return [value, name]
                    }}
                  />
                  <Scatter data={scatterRows} fill={LOG_FILL} />
                </ScatterChart>
              </ResponsiveContainer>
            </>
          ) : (
            <p className="an-chart-empty">Unknown clocks are counted, not plotted.</p>
          )}
        </>
      )}

      {phaseLabeled || shown.length > 0 ? (
        <details className="tf-fold" aria-label="Phase from bleed days and ovulation marks">
          <summary>
            Phase <span className="an-n">{strip.length} days</span>
          </summary>
          <p className="an-caveat">Labeled from bleed days and ovulation marks. Not a medical prediction. Spotting does not change the phase.</p>
          <ol className="an-log-phase">
            {strip.map((cell) => (
              <li key={cell.date} data-phase={cell.phase}>
                <span>{cell.date.slice(5)}</span>
                <span>{cell.phase}</span>
              </li>
            ))}
          </ol>
        </details>
      ) : null}
    </div>
  )
}
