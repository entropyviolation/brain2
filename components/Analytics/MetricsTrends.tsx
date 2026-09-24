/**
 * components/Analytics/MetricsTrends.tsx — Trend view for self-tracking metrics
 *
 * Self-contained analytics view (reads `metrics-store` itself). For the selected
 * metric it shows the raw value series, a least-squares trend line, a rolling
 * slope (momentum), detected change-points, and headline stats — all computed by
 * the pure `lib/metrics.ts` helpers (no LLM). Mounted as an Analytics tab by the
 * integration pass.
 */
"use client"

import { useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { useMetricsStore, METRIC_DEFINITIONS, type MetricKey } from "@/lib/metrics-store"
import { trend, rollingSlope, detectChangePoints } from "@/lib/metrics"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { dateKeyOf } from "./analytics-range"
import { MetricLogger } from "@/components/Tracking/MetricLogger"
import { STUDIO_TOOLTIP } from "./studio-kit"

function formatAt(at: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return at
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function MetricsTrends() {
  const datapoints = useMetricsStore((s) => s.datapoints)

  const { keySet, label } = useAnalyticsRange()
  const [logOpen, setLogOpen] = useState(false)

  const active = METRIC_DEFINITIONS
  const [metricId, setMetricId] = useState<MetricKey>(active[0]?.key ?? "joy")
  const selected = active.find((d) => d.key === metricId) ?? active[0]

  const series = useMemo(() => {
    if (!selected) return []
    return datapoints
      .filter((dp) => dp.values[selected.key] !== undefined)
      .filter((dp) => {
        const key = dateKeyOf(dp.at)
        return key !== null && keySet.has(key)
      })
      .map((dp) => ({ date: dp.at, value: dp.values[selected.key] as number }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  }, [datapoints, selected, keySet])

  const fit = useMemo(() => trend(series), [series])
  const slopes = useMemo(() => rollingSlope(series, Math.min(7, Math.max(2, Math.floor(series.length / 2)))), [series])
  const changePoints = useMemo(() => detectChangePoints(series, { window: 3 }), [series])

  const chartData = useMemo(() => {
    const cpDates = new Set(changePoints.map((c) => c.date))
    const slopeByDate = new Map(slopes.map((s) => [s.date, s.slope]))
    return series.map((p) => ({
      date: p.date,
      value: p.value,
      slope: slopeByDate.get(p.date),
      change: cpDates.has(p.date) ? p.value : null,
    }))
  }, [series, slopes, changePoints])

  const dirLabel = fit.direction === "rising" ? "rising" : fit.direction === "falling" ? "falling" : "flat"

  return (
    <div className="an-canvas an-stack">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Metric trend</p>
        </div>
        <div className="an-studio-tools">
            {active.length > 0 && (
              <select
                className="an-chip"
                value={selected?.key ?? ""}
                onChange={(e) => setMetricId(e.target.value as MetricKey)}
              >
                {active.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.name}
                  </option>
                ))}
              </select>
            )}
            <Dialog open={logOpen} onOpenChange={setLogOpen}>
              <DialogTrigger asChild>
                <button type="button" className="an-open-lists">
                  Log {selected?.name ?? "metric"}
                </button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Log {selected?.name ?? "metric"}</DialogTitle>
                </DialogHeader>
                <MetricLogger />
              </DialogContent>
            </Dialog>
          </div>
      </header>
      <div className="an-readouts">
        {METRIC_DEFINITIONS.map((def) => {
          const values = datapoints
            .filter((dp) => dp.values[def.key] !== undefined && keySet.has(dateKeyOf(dp.at) ?? ""))
            .map((dp) => dp.values[def.key] as number)
          const last = values[values.length - 1]
          return (
            <button
              key={def.key}
              type="button"
              className="an-readout"
              onClick={() => setMetricId(def.key)}
            >
              <p className="an-readout-label">{def.name}</p>
              <p className="an-readout-value">{last === undefined ? "—" : Math.round(last)}</p>
              <p className="an-readout-note">n = {values.length}</p>
            </button>
          )
        })}
      </div>
          {!selected ? (
            <ChartFrame empty emptySentence="No metrics yet. Log some readings from the Metrics button." />
          ) : series.length < 2 ? (
            <ChartFrame
              empty
              emptySentence={`Fewer than two readings for “${selected.name}” in the ${label}. Log this metric to see a trend.`}
            />
          ) : (
            <>
              <p className="an-n">
                n = {series.length} readings · {dirLabel}
                {fit.direction !== "flat" ? ` by ${Math.abs(fit.perDay).toFixed(2)}/day` : ""} · R² {fit.r2.toFixed(2)}
              </p>
              <div className="an-scope">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a4a32" />
                  <XAxis dataKey="date" fontSize={10} tickFormatter={formatAt} stroke="#8fbf9a" tick={{ fill: "#8fbf9a" }} />
                  <YAxis fontSize={11} domain={[0, 100]} stroke="#8fbf9a" tick={{ fill: "#8fbf9a" }} />
                  <Tooltip labelFormatter={(l) => formatAt(String(l))} contentStyle={STUDIO_TOOLTIP} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3dff8a"
                    strokeWidth={2}
                    dot={{ r: 2, fill: "#3dff8a" }}
                  />
                  <Scatter dataKey="change" fill="#ef4444" shape="diamond" />
                </ComposedChart>
              </ResponsiveContainer>
              </div>

              <p className="an-canvas-kicker">
                {fit.direction === "flat"
                  ? `“${selected.name}” has held roughly steady across ${series.length} readings.`
                  : `“${selected.name}” is ${fit.direction} by about ${Math.abs(fit.perDay).toFixed(
                      2,
                    )}/day (total ${fit.totalChange >= 0 ? "+" : ""}${fit.totalChange.toFixed(1)} over the span).`}
              </p>

              {changePoints.length > 0 && (
                <div>
                  <p className="an-canvas-title">Change points</p>
                  <div className="an-legend">
                    {changePoints.map((c) => (
                      <span key={c.date}>
                        {formatAt(c.date)}: {c.delta >= 0 ? "+" : ""}
                        {c.delta.toFixed(1)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
    </div>
  )
}

export default MetricsTrends
