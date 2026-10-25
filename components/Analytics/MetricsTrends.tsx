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
  ReferenceDot,
  ReferenceLine,
} from "recharts"
import { useMetricsStore, METRIC_DEFINITIONS, type MetricKey } from "@/lib/metrics-store"
import { trend, rollingSlope, detectChangePoints } from "@/lib/metrics"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { dateKeyOf } from "./analytics-range"
import { MetricLogger } from "@/components/Tracking/MetricLogger"
import { STUDIO_TOOLTIP } from "./studio-kit"
import { NativeSelect } from "@/components/ui/native-select"
import { dailyMeans, rollingMean, summaryStats } from "./meta-math"
import "./analytics-meta.css"

function MiniLine({ values, label, own = false }: { values: number[]; label: string; own?: boolean }) {
  if (values.length < 2) return <svg viewBox="0 0 200 34" role="img" aria-label={`${label}: too few days`} />
  const w = 200
  const h = 34
  const lo = own ? Math.min(...values) : 0
  const hi = own ? Math.max(...values, lo + 1) : 100
  const y = (v: number) => h - 3 - ((v - lo) / (hi - lo)) * (h - 6)
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"} ${((i / (values.length - 1)) * w).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`${label} daily mean`}>
      {!own ? <line x1={0} x2={w} y1={y(50)} y2={y(50)} className="an-meta-grid" /> : null}
      <path d={d} fill="none" stroke="var(--at-ink, #14171c)" strokeWidth={1.4} vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

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

  const [smooth, setSmooth] = useState(3)
  const values = useMemo(() => series.map((p) => p.value), [series])
  const stats = useMemo(() => summaryStats(values), [values])
  const smoothed = useMemo(() => rollingMean(values, smooth), [values, smooth])
  const chartRows = useMemo(
    () => chartData.map((row, i) => ({ ...row, smooth: smooth > 1 ? Number(smoothed[i]?.toFixed(1)) : undefined })),
    [chartData, smoothed, smooth],
  )
  const peak = stats ? series.find((p) => p.value === stats.max) : undefined
  const trough = stats ? series.find((p) => p.value === stats.min) : undefined
  const momentum = slopes[slopes.length - 1]?.slope
  // Keep the high/low labels inside the plot: near an edge, put them beside the dot.
  const labelSide = (date: string, fallback: "top" | "bottom") => {
    const i = series.findIndex((p) => p.date === date)
    if (i <= 0) return "right" as const
    if (i >= series.length - 1) return "left" as const
    return fallback
  }
  const [ownScale, setOwnScale] = useState(false)

  const multiples = useMemo(
    () =>
      METRIC_DEFINITIONS.map((def) => {
        const days = dailyMeans(
          datapoints.map((dp) => ({ at: dp.at, value: dp.values[def.key] })),
          keySet,
        )
        return { def, values: days.map((d) => d.value), stats: summaryStats(days.map((d) => d.value)) }
      }),
    [datapoints, keySet],
  )

  const dirLabel = fit.direction === "rising" ? "rising" : fit.direction === "falling" ? "falling" : "flat"

  return (
    <div className="an-canvas an-stack">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Metric trend</p>
        </div>
        <div className="an-studio-tools">
            {active.length > 0 && (
              <NativeSelect
                className="an-chip"
                value={selected?.key ?? ""}
                onChange={(e) => setMetricId(e.target.value as MetricKey)}
              >
                {active.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            <Dialog open={logOpen} onOpenChange={setLogOpen}>
              <DialogTrigger asChild>
                <button type="button" className="an-open-lists">
                  Log {selected?.name ?? "metric"}
                </button>
              </DialogTrigger>
              <DialogContent className="an-popup max-w-2xl max-h-[85vh] overflow-y-auto">
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
            .slice()
            .sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0))
            .map((dp) => dp.values[def.key] as number)
          const last = values[values.length - 1]
          return (
            <button
              key={def.key}
              type="button"
              className="an-readout"
              aria-pressed={def.key === selected?.key}
              title={`Latest ${def.name} reading in the window`}
              onClick={() => setMetricId(def.key)}
            >
              <p className="an-readout-label">{def.name}</p>
              <p className="an-readout-value">{last === undefined ? "—" : Math.round(last)}</p>
              <p className="an-readout-note">n = {values.length}</p>
            </button>
          )
        })}
      </div>
      <section className="an-plate" data-testid="metric-multiples">
        <p className="an-canvas-title">{ownScale ? "All five, each on its own range" : "All five, same scale"}</p>
        <p className="an-canvas-hint">
          {ownScale
            ? "Each line stretched to its own low and high, so small moves show. Do not compare heights across rows."
            : "Daily mean of each metric on 0–100, dotted line at 50. Click a row to open it below."}
        </p>
        <div className="an-meta-tools">
          <button type="button" className="an-meta-chip" aria-pressed={!ownScale} onClick={() => setOwnScale(false)}>
            same 0–100
          </button>
          <button type="button" className="an-meta-chip" aria-pressed={ownScale} onClick={() => setOwnScale(true)}>
            own range
          </button>
        </div>
        <div className="an-meta-multiples">
          {multiples.map(({ def, values: v, stats: st }) => (
            <button
              key={def.key}
              type="button"
              className="an-meta-multiple"
              aria-pressed={def.key === selected?.key}
              onClick={() => setMetricId(def.key)}
            >
              <span className="an-readout-label">{def.name}</span>
              <MiniLine values={v} label={def.name} own={ownScale} />
              <span className="an-meta-stats">
                {st ? `μ ${st.mean.toFixed(0)} · σ ${st.sd.toFixed(0)} · ${st.n} d` : "no readings"}
              </span>
            </button>
          ))}
        </div>
      </section>
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
              {stats ? (
                <p className="an-meta-stats" data-testid="metric-stats">
                  mean {stats.mean.toFixed(1)} ± {stats.sd.toFixed(1)} σ · median {stats.median.toFixed(1)} · range{" "}
                  {Math.round(stats.min)}–{Math.round(stats.max)}
                  {momentum !== undefined ? ` · recent slope ${momentum >= 0 ? "+" : ""}${momentum.toFixed(2)}/day` : ""}
                </p>
              ) : null}
              <div className="an-meta-tools">
                <label>
                  Smooth
                  <input
                    type="range"
                    min={1}
                    max={Math.max(2, Math.min(14, series.length))}
                    value={smooth}
                    onChange={(e) => setSmooth(Number(e.target.value))}
                    aria-label="Rolling mean window in readings"
                  />
                  {smooth <= 1 ? "off" : `${smooth}-reading mean`}
                </label>
              </div>
              <div className="an-scope">
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartRows}>
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
                  {smooth > 1 ? (
                    <Line type="monotone" dataKey="smooth" stroke="#d7f5e0" strokeWidth={1.4} strokeDasharray="4 3" dot={false} />
                  ) : null}
                  {stats ? <ReferenceLine y={stats.mean} stroke="#8fbf9a" strokeDasharray="2 4" /> : null}
                  {peak ? (
                    <ReferenceDot x={peak.date} y={peak.value} r={4} fill="#3dff8a" stroke="#d7f5e0"
                      label={{ value: `high ${Math.round(peak.value)} · ${formatAt(peak.date)}`, position: labelSide(peak.date, "top"), fill: "#d7f5e0", fontSize: 10 }} />
                  ) : null}
                  {trough && trough !== peak ? (
                    <ReferenceDot x={trough.date} y={trough.value} r={4} fill="#3dff8a" stroke="#d7f5e0"
                      label={{ value: `low ${Math.round(trough.value)} · ${formatAt(trough.date)}`, position: labelSide(trough.date, "bottom"), fill: "#d7f5e0", fontSize: 10 }} />
                  ) : null}
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
