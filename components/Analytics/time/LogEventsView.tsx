/**
 * components/Analytics/time/LogEventsView.tsx — Time → Log
 *
 * Day bars, kind counts, and a clock scatter of exact and estimated times.
 * Unknown clocks are a count. The phase strip reads cycle marks over this
 * window. Filter by the kind string; there is no preset list of events.
 */
"use client"

import { useMemo, useState } from "react"
import { ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { SHOWER_COUNT_ID, useCountStatusesStore } from "@/lib/count-statuses"
import { minutesToLabel } from "@/lib/time-entries"
import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import { showerGapStats } from "./shower-stats"
import { ChartFrame } from "../studio/chart-frame"
import { useAnalyticsRange } from "../chrome/analytics-range-store"
import { CanvasTitle, StudioReadout, STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP } from "../studio/studio-kit"
import {
  asLogEntry,
  classifyLogInstant,
  isBareTextLogNote,
  useLogCycleMarks,
} from "@/components/Home/Tracking/tracking-log-model"
import { countLogEventsByDay, countLogEventsByKind, logClockScatter, logPhaseStrip, type LogEventPoint } from "./log-event-stats"

function dayLabel(key: string): string {
  const d = parseLocalDate(key)
  if (!d) return key
  return d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" })
}

function ShowerPlate({ dateKeys }: { dateKeys: readonly string[] }) {
  const ticks = useCountStatusesStore((state) => state.counts.find((count) => count.id === SHOWER_COUNT_ID)?.ticks ?? [])
  const today = formatLocalDateKey(new Date())
  const stats = showerGapStats(ticks, dateKeys, today)
  return (
    <section aria-label="Shower" data-testid="shower-plate">
      <h3 className="an-canvas-kicker">Shower</h3>
      {stats.daysSince == null ? (
        <ChartFrame empty emptySentence="No shower logged." />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="Days since last shower" value={stats.daysSince} note="as of today" />
            <StudioReadout label="Showers in this window" value={stats.showersInWindow} />
            <StudioReadout label="Still open" value={stats.daysSince} note="not inside the mean" />
          </div>
          {stats.gapCount < 2 ? (
            <ChartFrame thin thinSentence={`n = ${stats.gapCount}. Not a finding.`} />
          ) : (
            <div className="an-readouts">
              <StudioReadout label="Average gap" value={stats.averageGapDays ?? 0} note={`days · n = ${stats.gapCount}`} />
              <StudioReadout label="Longest gap" value={stats.longestGapDays ?? 0} note="days" />
              <StudioReadout
                label="Mean hours"
                value={stats.averageGapHours ?? 0}
                note={stats.hourGapCount ? `n = ${stats.hourGapCount} · apart from the day mean` : "no clocks"}
              />
            </div>
          )}
        </>
      )}
    </section>
  )
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
      const logged = asLogEntry(entry)
      const name = penName.get(entry.penId)
      if (isBareTextLogNote(logged, name)) continue
      const row = classifyLogInstant(logged, name)
      if (row) rows.push(row)
    }
    return rows
  }, [entries, keySet, penName])

  const filter = kindFilter.trim().toLowerCase()
  const shown = filter ? classified.filter((row) => row.kindKey.toLowerCase() === filter) : classified
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
  const strip = logPhaseStrip(dateKeys, marksByDate)
  const phaseLabeled = strip.some((cell) => cell.phase !== "unknown")

  return (
    <div className="an-canvas an-stack" data-testid="log-events-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Log"
            help="Food, drink, drug, bare intake, and any event phrase. A Text log note with no event kind is not counted. Counts by day and by kind. Exact and estimated clocks are plotted; unknown clocks are a count, not a point. The phase strip is labeled from bleed days and ovulation marks — not a medical prediction. Spotting does not change the phase."
          />
          <p className="an-canvas-kicker">{label}</p>
        </div>
      </header>

      <ShowerPlate dateKeys={dateKeys} />

      <label className="an-studio-field">
        <span>Kind</span>
        <input
          aria-label="Kind"
          value={kindFilter}
          placeholder="intake.food, left room"
          onChange={(event) => setKindFilter(event.target.value)}
        />
      </label>

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
            <StudioReadout label="Unknown clocks" value={scatter.unknownCount} note="not plotted" />
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={byDay}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
              <YAxis allowDecimals={false} fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Bar dataKey="count" name="Events" fill="#5b8def" />
            </BarChart>
          </ResponsiveContainer>
          <ul className="an-list" aria-label="Count by kind">
            {byKind.map((row) => (
              <li key={row.kind} className="an-list-row">
                <span className="truncate">{row.kind}</span>
                <span className="an-n">{row.count}</span>
              </li>
            ))}
          </ul>
          {scatter.points.length > 0 ? (
            <>
              <p className="an-canvas-title">Clock</p>
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart>
                  <CartesianGrid stroke={STUDIO_GRID} />
                  <XAxis dataKey="date" type="category" allowDuplicatedCategory fontSize={11} stroke={STUDIO_AXIS} />
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
                  <Scatter data={scatter.points} fill="#34d399" />
                </ScatterChart>
              </ResponsiveContainer>
            </>
          ) : (
            <p className="an-chart-empty">Unknown clocks are counted, not plotted.</p>
          )}
        </>
      )}

      {phaseLabeled || shown.length > 0 ? (
        <section aria-label="Phase from bleed days and ovulation marks">
          <p className="an-canvas-title">Phase</p>
          <p className="an-caveat">Labeled from bleed days and ovulation marks. Not a medical prediction. Spotting does not change the phase.</p>
          <ol className="an-log-phase">
            {strip.map((cell) => (
              <li key={cell.date} data-phase={cell.phase}>
                <span>{cell.date.slice(5)}</span>
                <span>{cell.phase}</span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  )
}
