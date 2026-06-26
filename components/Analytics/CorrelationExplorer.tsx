/**
 * components/Analytics/CorrelationExplorer.tsx — Pairwise metric correlation
 *
 * Self-contained analytics view (reads `metrics-store` itself). The user picks
 * two metrics; we inner-join their readings by date and compute a Pearson
 * correlation (via pure `lib/metrics.ts`), rendering a scatter plot plus a
 * plain-language insight. A small matrix lists the strongest pairwise links
 * across all metrics with enough overlapping days. No LLM.
 */
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ZAxis } from "recharts"
import { useMetricsStore, METRIC_DEFINITIONS, resolveMetricColor, type MetricKey } from "@/lib/metrics-store"
import { alignSeries, correlate, type SeriesPoint } from "@/lib/metrics"

const MIN_OVERLAP = 3

export function CorrelationExplorer() {
  const datapoints = useMetricsStore((s) => s.datapoints)
  const colors = useMetricsStore((s) => s.colors)

  const active = METRIC_DEFINITIONS

  const seriesById = useMemo(() => {
    const map = new Map<string, SeriesPoint[]>()
    for (const d of active) {
      map.set(
        d.key,
        datapoints
          .filter((dp) => dp.values[d.key] !== undefined)
          .map((dp) => ({ date: dp.at, value: dp.values[d.key] as number }))
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
      )
    }
    return map
  }, [active, datapoints])

  const [aId, setAId] = useState<MetricKey>(active[0]?.key ?? "joy")
  const [bId, setBId] = useState<MetricKey>(active[1]?.key ?? active[0]?.key ?? "joy")

  const defA = active.find((d) => d.key === aId)
  const defB = active.find((d) => d.key === bId)

  const aligned = useMemo(() => {
    if (!defA || !defB) return { dates: [], a: [], b: [] }
    return alignSeries(seriesById.get(defA.key) ?? [], seriesById.get(defB.key) ?? [])
  }, [defA, defB, seriesById])

  const result = useMemo(() => {
    if (!defA || !defB) return null
    return correlate(seriesById.get(defA.key) ?? [], seriesById.get(defB.key) ?? [], {
      a: defA.name,
      b: defB.name,
    })
  }, [defA, defB, seriesById])

  const scatterData = useMemo(
    () => aligned.dates.map((date, i) => ({ x: aligned.a[i], y: aligned.b[i], date })),
    [aligned],
  )

  // Top pairwise links across all metrics with enough overlap.
  const ranked = useMemo(() => {
    const out: { a: string; b: string; r: number; n: number }[] = []
    for (let i = 0; i < active.length; i++) {
      for (let j = i + 1; j < active.length; j++) {
        const r = correlate(seriesById.get(active[i].key) ?? [], seriesById.get(active[j].key) ?? [])
        if (r.n >= MIN_OVERLAP) out.push({ a: active[i].name, b: active[j].name, r: r.r, n: r.n })
      }
    }
    return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 8)
  }, [active, seriesById])

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Correlation explorer</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {active.length < 2 ? (
            <p className="text-sm text-muted-foreground">
              Track at least two metrics (and log them on shared days) to explore correlations.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <select
                  className="border rounded h-8 px-2 bg-background"
                  value={aId}
                  onChange={(e) => setAId(e.target.value as MetricKey)}
                >
                  {active.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.name}
                    </option>
                  ))}
                </select>
                <span className="text-muted-foreground">vs</span>
                <select
                  className="border rounded h-8 px-2 bg-background"
                  value={bId}
                  onChange={(e) => setBId(e.target.value as MetricKey)}
                >
                  {active.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.name}
                    </option>
                  ))}
                </select>
                {result && (
                  <Badge variant={result.direction === "none" ? "outline" : "secondary"} className="ml-auto">
                    r = {result.r.toFixed(2)} · n = {result.n}
                  </Badge>
                )}
              </div>

              {result && <p className="text-sm text-muted-foreground">{result.insight}</p>}

              {scatterData.length >= 2 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <ScatterChart margin={{ left: 8, right: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" name={defA?.name} fontSize={11} />
                    <YAxis type="number" dataKey="y" name={defB?.name} fontSize={11} />
                    <ZAxis range={[60, 60]} />
                    <Tooltip
                      cursor={{ strokeDasharray: "3 3" }}
                      formatter={(v: number, n: string) => [v, n === "x" ? defA?.name : defB?.name]}
                    />
                    <Scatter data={scatterData} fill={defA ? resolveMetricColor(defA.key, colors) : "#2563eb"} />
                  </ScatterChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No overlapping days yet — log both metrics on the same dates.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {ranked.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Strongest links</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ranked.map((row, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="truncate">
                  {row.a} ↔ {row.b}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">n={row.n}</span>
                  <Badge variant={Math.abs(row.r) < 0.2 ? "outline" : "secondary"}>
                    {row.r >= 0 ? "+" : ""}
                    {row.r.toFixed(2)}
                  </Badge>
                </span>
              </div>
            ))}
            <p className="text-[11px] text-muted-foreground pt-1">Correlation does not imply causation.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default CorrelationExplorer
