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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"
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
import { useMetricsStore, METRIC_DEFINITIONS, resolveMetricColor, type MetricKey } from "@/lib/metrics-store"
import { trend, rollingSlope, detectChangePoints } from "@/lib/metrics"

function formatAt(at: string): string {
  const d = new Date(at)
  if (Number.isNaN(d.getTime())) return at
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
}

export function MetricsTrends() {
  const datapoints = useMetricsStore((s) => s.datapoints)
  const colors = useMetricsStore((s) => s.colors)

  const active = METRIC_DEFINITIONS
  const [metricId, setMetricId] = useState<MetricKey>(active[0]?.key ?? "joy")
  const selected = active.find((d) => d.key === metricId) ?? active[0]
  const selectedColor = selected ? resolveMetricColor(selected.key, colors) : "#2563eb"

  const series = useMemo(() => {
    if (!selected) return []
    return datapoints
      .filter((dp) => dp.values[selected.key] !== undefined)
      .map((dp) => ({ date: dp.at, value: dp.values[selected.key] as number }))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  }, [datapoints, selected])

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

  const DirIcon = fit.direction === "rising" ? TrendingUp : fit.direction === "falling" ? TrendingDown : Minus

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base">Metric trend</CardTitle>
          {active.length > 0 && (
            <select
              className="border rounded h-8 px-2 text-sm bg-background"
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
        </CardHeader>
        <CardContent>
          {!selected ? (
            <p className="text-sm text-muted-foreground">No metrics yet. Log some readings from the Metrics button.</p>
          ) : series.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Log at least two readings for “{selected.name}” to see a trend.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                <Stat
                  icon={<DirIcon className="h-4 w-4" />}
                  label="Direction"
                  value={fit.direction}
                />
                <Stat label="Per day" value={`${fit.perDay >= 0 ? "+" : ""}${fit.perDay.toFixed(2)}`} />
                <Stat label="Fit (R²)" value={fit.r2.toFixed(2)} />
                <Stat label="Readings" value={series.length} />
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" fontSize={10} tickFormatter={formatAt} />
                  <YAxis fontSize={11} domain={[0, 100]} />
                  <Tooltip labelFormatter={(l) => formatAt(String(l))} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke={selectedColor}
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                  <Scatter dataKey="change" fill="#ef4444" shape="diamond" />
                </ComposedChart>
              </ResponsiveContainer>

              <p className="text-sm text-muted-foreground mt-3">
                {fit.direction === "flat"
                  ? `“${selected.name}” has held roughly steady across ${series.length} readings.`
                  : `“${selected.name}” is ${fit.direction} by about ${Math.abs(fit.perDay).toFixed(
                      2,
                    )}/day (total ${fit.totalChange >= 0 ? "+" : ""}${fit.totalChange.toFixed(1)} over the span).`}
              </p>

              {changePoints.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs font-medium mb-1">Change points</p>
                  <div className="flex flex-wrap gap-2">
                    {changePoints.map((c) => (
                      <Badge key={c.date} variant="outline" className="font-normal">
                        {formatAt(c.date)}: {c.delta >= 0 ? "+" : ""}
                        {c.delta.toFixed(1)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[11px] text-muted-foreground flex items-center gap-1">
        {icon}
        {label}
      </p>
      <p className="text-lg font-semibold capitalize">{value}</p>
    </div>
  )
}

export default MetricsTrends
