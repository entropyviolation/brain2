/**
 * components/Analytics/ContextSwitchHeatmap.tsx — Context-switching heatmap
 *
 * A switch is a pen change: one block ending and another beginning. Shared
 * Analytics range; a sparse window is not a trend.
 */
"use client"

import { useMemo, useState } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { entriesForDay } from "@/lib/time-entries"
import { parseLocalDate, formatLocalDateKey } from "@/lib/date-utils"
import { contextSwitchSeries, contextSwitchValueSeries, trend, mean } from "@/lib/metrics"
import { useTaskStore } from "@/lib/task-store"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, isThinSample, thinWindowSentence } from "./analytics-range"
import { DensityCalendar, StudioBars, StudioSelect } from "./studio-kit"
import { hourLabel, switchCountsByHour } from "./hour-day"

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function switchColor(count: number): string {
  if (count <= 0) return "#b0b0b0"
  if (count === 1) return "hsl(38 50% 22%)"
  if (count < 4) return "hsl(32 62% 32%)"
  if (count < 7) return "hsl(28 72% 42%)"
  return "hsl(18 78% 52%)"
}

export function ContextSwitchHeatmap() {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  const tasks = useTaskStore((s) => s.tasks)
  const { dateKeys, keySet, label } = useAnalyticsRange()

  const [scopeId, setScopeId] = useState(scopes[0]?.id ?? "")
  const scope = scopes.find((s) => s.id === scopeId) ?? scopes[0]

  const switchByDate = useMemo(() => {
    if (!scope) return new Map<string, number>()
    const dayRows = dateKeys.map((key) => ({
      date: key,
      sequence: entriesForDay(entries, key, scope.id).map((e) => e.penId),
    }))
    const series = contextSwitchSeries(dayRows)
    return new Map(series.map((p) => [p.date, p.switches]))
  }, [scope, entries, dateKeys])

  const heatmap = useMemo(() => {
    if (dateKeys.length === 0) return []
    const start = parseLocalDate(dateKeys[0]) ?? new Date()
    const weekday = (start.getDay() + 6) % 7
    const aligned = addDays(start, -weekday)
    const today = parseLocalDate(dateKeys[dateKeys.length - 1]) ?? new Date()
    const totalDays = Math.round((today.getTime() - aligned.getTime()) / 86400000) + 1
    const weeks = Math.ceil(totalDays / 7)
    const cols: { key: string; value: number; out?: boolean }[][] = []
    for (let w = 0; w < weeks; w++) {
      const col: { key: string; value: number; out?: boolean }[] = []
      for (let day = 0; day < 7; day++) {
        const d = addDays(aligned, w * 7 + day)
        const key = formatLocalDateKey(d)
        col.push({
          key,
          value: !keySet.has(key) || d > today ? 0 : switchByDate.get(key) ?? 0,
          out: !keySet.has(key) || d > today,
        })
      }
      cols.push(col)
    }
    return cols
  }, [switchByDate, dateKeys, keySet])

  const hourRows = useMemo(() => {
    if (!scope) return []
    const hours = switchCountsByHour(entries, dateKeys, scope.id)
    return hours.map((value, hour) => ({ name: hourLabel(hour), value }))
  }, [scope, entries, dateKeys])

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

  const empty = stats.activeDays === 0
  const thin = !empty && isThinSample(stats.activeDays, SAMPLE_FLOORS.contextSwitchDays)
  const loggedIds = useMemo(
    () =>
      tasks
        .filter((t) => (t.timeLogs ?? []).some((log) => keySet.has(log.date)))
        .map((t) => t.id),
    [tasks, keySet],
  )

  return (
    <div className="an-canvas an-stack">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Context switching</p>
          <p className="an-canvas-kicker">{label} · a switch is a pen change — one block ending and another beginning.</p>
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

      {!scope ? (
        <ChartFrame empty emptySentence="No tracking scopes yet." />
      ) : empty ? (
        <ChartFrame
          empty
          emptySentence={`No painted days for “${scope.name}” in the ${label}. A switch is a pen change on the Home → Tracking grid.`}
        />
      ) : thin ? (
        <ChartFrame thin thinSentence={thinWindowSentence(stats.activeDays, SAMPLE_FLOORS.contextSwitchDays, label)} />
      ) : (
        <>
          <p className="an-n">
            n = {stats.activeDays} days with a switch · avg {stats.avg.toFixed(1)} / day · busiest {stats.max} · trend{" "}
            {stats.direction}
          </p>
          <DensityCalendar weeks={heatmap} color={switchColor} />
          <div className="an-legend">
            <span>
              <i style={{ background: switchColor(0) }} />
              Focused (0 switches)
            </span>
            <span>
              <i style={{ background: switchColor(8) }} />
              Fragmented
            </span>
          </div>
          {hourRows.some((r) => r.value > 0) && (
            <>
              <p className="an-canvas-title">Hour of day</p>
              <StudioBars rows={hourRows.filter((r) => r.value > 0)} max={Math.max(...hourRows.map((r) => r.value), 1)} unit="" />
            </>
          )}
        </>
      )}
      <OpenInListsButton taskIds={loggedIds} />
    </div>
  )
}

export default ContextSwitchHeatmap
