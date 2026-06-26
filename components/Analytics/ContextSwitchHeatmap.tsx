/**
 * components/Analytics/ContextSwitchHeatmap.tsx — Context-switching heatmap
 *
 * Self-contained analytics view. It reads the TimeGrid tracker via the
 * time-tracking-store's `getDay` action (read-only) and, for the selected scope,
 * counts how many times the painted activity changed across each day's slots
 * (pure `lib/metrics.ts` `contextSwitchSeries`). A GitHub-style calendar heatmap
 * surfaces fragmented (high-switch) vs. focused (low-switch) days, plus headline
 * stats and a trend. No LLM.
 */
"use client"

import { useMemo, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Shuffle } from "lucide-react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { formatLocalDateKey } from "@/lib/date-utils"
import { contextSwitchSeries, contextSwitchValueSeries, trend, mean } from "@/lib/metrics"

const HEATMAP_WEEKS = 17 // ~4 months

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function switchColor(count: number, max: number): string {
  if (count <= 0) return "#ebedf0"
  const ratio = max <= 0 ? 0 : count / max
  if (ratio < 0.25) return "#fde68a"
  if (ratio < 0.5) return "#fcd34d"
  if (ratio < 0.75) return "#f59e0b"
  return "#d97706"
}

export function ContextSwitchHeatmap() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  // Subscribe to data so the view recomputes when slots change; values are still
  // read through the getDay action below.
  const data = useTimeTrackingStore((s) => s.data)
  const getDay = useTimeTrackingStore((s) => s.getDay)

  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "")
  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0]

  const switchByDate = useMemo(() => {
    if (!scope) return new Map<string, number>()
    const days: { date: string; sequence: (string | null)[] }[] = []
    const today = new Date()
    for (let i = 0; i < HEATMAP_WEEKS * 7; i++) {
      const key = formatLocalDateKey(addDays(today, -i))
      days.push({ date: key, sequence: getDay(key, scope.id) })
    }
    const series = contextSwitchSeries(days)
    return new Map(series.map((p) => [p.date, p.switches]))
    // `data` is intentionally a dependency so we recompute on paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, getDay, data])

  const heatmap = useMemo(() => {
    const today = new Date()
    const weekday = (today.getDay() + 6) % 7 // 0 = Monday
    const start = addDays(today, -(HEATMAP_WEEKS * 7 - 1 + weekday))
    const weeks: { date: Date; key: string; count: number }[][] = []
    for (let w = 0; w < HEATMAP_WEEKS; w++) {
      const col: { date: Date; key: string; count: number }[] = []
      for (let day = 0; day < 7; day++) {
        const d = addDays(start, w * 7 + day)
        const key = formatLocalDateKey(d)
        col.push({ date: d, key, count: d > today ? -1 : switchByDate.get(key) ?? 0 })
      }
      weeks.push(col)
    }
    return weeks
  }, [switchByDate])

  const stats = useMemo(() => {
    const counts = [...switchByDate.values()].filter((v) => v > 0)
    const max = counts.length ? Math.max(...counts) : 0
    const avg = counts.length ? mean(counts) : 0
    const valueSeries = contextSwitchValueSeries(
      [...switchByDate.entries()].map(([date, switches]) => ({ date, switches, distinct: 0, active: 0 })),
    )
    const t = trend(valueSeries)
    return { max, avg, activeDays: counts.length, direction: t.direction }
  }, [switchByDate])

  const maxForColor = stats.max

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shuffle className="h-4 w-4" />
            Context switching (by day)
          </CardTitle>
          {scopes.length > 0 && (
            <select
              className="border rounded h-8 px-2 text-sm bg-background"
              value={scope?.id ?? ""}
              onChange={(e) => setScopeId(e.target.value)}
            >
              {scopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </CardHeader>
        <CardContent>
          {!scope ? (
            <p className="text-sm text-muted-foreground">No tracking scopes yet.</p>
          ) : stats.activeDays === 0 ? (
            <p className="text-sm text-muted-foreground">
              No painted days for “{scope.name}” yet. Use the Tracking tab on Home to paint your day, then return here.
            </p>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <Stat label="Avg switches/day" value={stats.avg.toFixed(1)} />
                <Stat label="Busiest day" value={stats.max} />
                <Stat label="Trend" value={stats.direction} />
              </div>
              <div className="flex gap-[3px] overflow-x-auto pb-2">
                {heatmap.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((cell) => (
                      <div
                        key={cell.key}
                        title={`${cell.key}: ${cell.count < 0 ? "—" : cell.count + " switches"}`}
                        style={{
                          width: 13,
                          height: 13,
                          borderRadius: 2,
                          background: cell.count < 0 ? "transparent" : switchColor(cell.count, maxForColor),
                        }}
                      />
                    ))}
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                Focused
                {[0, 0.2, 0.4, 0.7, 1].map((p) => (
                  <span
                    key={p}
                    style={{ width: 13, height: 13, borderRadius: 2, background: switchColor(Math.ceil(p * maxForColor), maxForColor) }}
                  />
                ))}
                Fragmented
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border p-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold capitalize">{value}</p>
    </div>
  )
}

export default ContextSwitchHeatmap
