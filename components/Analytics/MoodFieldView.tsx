/**
 * components/Analytics/MoodFieldView.tsx — Painted Mood + wellbeing overlay
 *
 * Spec §15 cognitive-state trends: Mood pens over the range, plus the five
 * logged metrics when n allows.
 */
"use client"

import { useMemo } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useMetricsStore, METRIC_DEFINITIONS } from "@/lib/metrics-store"
import { formatDuration } from "@/lib/time-entries"
import { entriesInRange, penTotalsAtDepth } from "@/lib/tracking-summary"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { dateKeyOf } from "./analytics-range"
import { HourDayHeatmap, SliceMosaic, StudioReadout } from "./studio-kit"
import { buildHourDayGrid } from "./hour-day"

export function MoodFieldView() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const datapoints = useMetricsStore((s) => s.datapoints)
  const { dateKeys, keySet, label } = useAnalyticsRange()
  const mood = scopes.find((s) => s.name === "Mood")

  const slices = useMemo(() => {
    if (!mood) return []
    return penTotalsAtDepth(entriesInRange(entries, dateKeys, mood.id), mood, dateKeys, mood.displayDepth ?? null)
  }, [mood, entries, dateKeys])

  const grid = useMemo(
    () => (mood ? buildHourDayGrid(entries, dateKeys, mood.id) : null),
    [mood, entries, dateKeys],
  )

  const metricReadings = useMemo(() => {
    return METRIC_DEFINITIONS.map((def) => {
      const values = datapoints
        .filter((dp) => dp.values[def.key] !== undefined && keySet.has(dateKeyOf(dp.at) ?? ""))
        .map((dp) => dp.values[def.key] as number)
      const avg = values.length ? values.reduce((s, n) => s + n, 0) / values.length : null
      return { name: def.name, n: values.length, avg }
    })
  }, [datapoints, keySet])

  return (
    <div className="an-canvas an-stack" data-testid="mood-field">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Mood field</p>
          <p className="an-canvas-kicker">{label} · painted Mood pens, with logged joy / suffering / alignment when present.</p>
        </div>
      </header>
      {!mood ? (
        <ChartFrame empty emptySentence="No Mood scope yet." />
      ) : slices.length === 0 && (grid?.observedDays ?? 0) === 0 ? (
        <ChartFrame empty emptySentence={`Nothing painted in Mood in the ${label}.`} />
      ) : (
        <>
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
          {grid && grid.observedDays > 0 && (
            <div style={{ ["--an-cols" as string]: String(Math.max(dateKeys.length, 1)) }}>
              <HourDayHeatmap grid={grid} hue={312} />
            </div>
          )}
        </>
      )}
      <div className="an-readouts">
        {metricReadings.map((m) => (
          <StudioReadout
            key={m.name}
            label={m.name}
            value={m.avg === null ? "—" : Math.round(m.avg)}
            note={m.n === 0 ? "no readings" : `n = ${m.n}`}
          />
        ))}
      </div>
    </div>
  )
}
