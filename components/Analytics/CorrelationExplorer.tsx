/**
 * components/Analytics/CorrelationExplorer.tsx — Pairwise correlation matrix
 *
 * Sentence + n + caveat. Ranked links and the scatter stay hidden until the
 * overlap clears the sample floor. Shared Analytics range. Not a chart builder.
 */
"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ZAxis } from "recharts"
import { useMetricsStore, METRIC_DEFINITIONS, resolveMetricColor, type MetricKey } from "@/lib/metrics-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSleepStore } from "@/lib/sleep-store"
import { usePointsStore } from "@/lib/points-store"
import { calculateDayPercentageAV } from "@/lib/calculations"
import { exemptionTest } from "@/lib/habit-exemption"
import { parseLocalDate } from "@/lib/date-utils"
import { uniqueMinutesByDate } from "@/lib/tracking-summary"
import { resolveNights } from "@/lib/sleep-inference"
import { sleepMinutes } from "@/lib/sleep-log"
import { alignSeries, correlate, type SeriesPoint } from "@/lib/metrics"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, dateKeyOf, isThinSample, thinWindowSentence } from "./analytics-range"
import { FindingBlock, STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP } from "./studio-kit"

interface NamedSeries {
  id: string
  name: string
  points: SeriesPoint[]
}

function weekdayIndex(key: string): number {
  const d = parseLocalDate(key)
  return d ? d.getDay() : 0
}

function cellFill(r: number, n: number, floor: number): string {
  if (n < floor) return "#b0b0b0"
  const t = Math.min(1, Math.abs(r))
  const hue = r >= 0 ? 166 : 8
  return `hsl(${hue} ${40 + t * 40}% ${16 + t * 36}%)`
}

export function CorrelationExplorer() {
  const datapoints = useMetricsStore((s) => s.datapoints)
  const colors = useMetricsStore((s) => s.colors)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const trackingEntries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const loggedNights = useSleepStore((s) => s.nights)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const { dateKeys, keySet, label } = useAnalyticsRange()

  const series = useMemo<NamedSeries[]>(() => {
    const out: NamedSeries[] = []
    for (const d of METRIC_DEFINITIONS) {
      out.push({
        id: d.key,
        name: d.name,
        points: datapoints
          .filter((dp) => dp.values[d.key] !== undefined)
          .filter((dp) => keySet.has(dateKeyOf(dp.at) ?? ""))
          .map((dp) => ({ date: dp.at, value: dp.values[d.key] as number })),
      })
    }
    const habits: SeriesPoint[] = dateKeys.map((date) => ({
      date,
      value: habitTasks.length
        ? calculateDayPercentageAV(date, habitTasks as never, weeklyData as never, weekdayIndex(date), exemptionTest(habitExemptions, "daily"))
        : 0,
    }))
    out.push({ id: "habits", name: "Habit %", points: habits })
    const tracking = uniqueMinutesByDate(trackingEntries)
    out.push({
      id: "tracking",
      name: "Tracked min",
      points: dateKeys.map((date) => ({ date, value: tracking[date] ?? 0 })),
    })
    const nights = resolveNights(loggedNights, { scopes, entries: trackingEntries }, dateKeys)
    out.push({
      id: "sleep",
      name: "Sleep min",
      points: dateKeys
        .map((date) => {
          const m = sleepMinutes(nights[date])
          return m === null ? null : { date, value: m }
        })
        .filter((p): p is SeriesPoint => p !== null),
    })
    const pts: Record<string, number> = {}
    for (const e of pointsHistory) if (keySet.has(e.date)) pts[e.date] = (pts[e.date] ?? 0) + e.points
    out.push({
      id: "points",
      name: "Points",
      points: dateKeys.map((date) => ({ date, value: pts[date] ?? 0 })),
    })
    return out
  }, [datapoints, dateKeys, habitTasks, keySet, loggedNights, pointsHistory, scopes, trackingEntries, weeklyData, habitExemptions])

  const [aId, setAId] = useState(series[0]?.id ?? "joy")
  const [bId, setBId] = useState(series[1]?.id ?? series[0]?.id ?? "joy")
  const defA = series.find((d) => d.id === aId) ?? series[0]
  const defB = series.find((d) => d.id === bId) ?? series[1] ?? series[0]

  const aligned = useMemo(() => {
    if (!defA || !defB) return { dates: [], a: [], b: [] }
    return alignSeries(defA.points, defB.points)
  }, [defA, defB])

  const result = useMemo(() => {
    if (!defA || !defB) return null
    return correlate(defA.points, defB.points, { a: defA.name, b: defB.name })
  }, [defA, defB])

  const scatterData = useMemo(
    () => aligned.dates.map((date, i) => ({ x: aligned.a[i], y: aligned.b[i], date })),
    [aligned],
  )

  const n = result?.n ?? 0
  const empty = n < 2
  const thin = !empty && isThinSample(n, SAMPLE_FLOORS.correlation)
  const caveat = "Correlation does not imply causation. Overlap is inner-joined by calendar day."

  const matrix = useMemo(() => {
    return series.map((a) =>
      series.map((b) => {
        const r = correlate(a.points, b.points)
        return { r: r.r, n: r.n }
      }),
    )
  }, [series])

  const ranked = useMemo(() => {
    const out: { a: string; b: string; r: number; n: number; aId: string; bId: string }[] = []
    for (let i = 0; i < series.length; i++) {
      for (let j = i + 1; j < series.length; j++) {
        const r = correlate(series[i].points, series[j].points)
        if (r.n >= SAMPLE_FLOORS.correlation) {
          out.push({ a: series[i].name, b: series[j].name, r: r.r, n: r.n, aId: series[i].id, bId: series[j].id })
        }
      }
    }
    return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r)).slice(0, 8)
  }, [series])

  return (
    <div className="an-canvas an-stack">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Correlation</p>
          <p className="an-canvas-kicker">Pairwise Pearson r over the {label}. Click a cell to open the scatter.</p>
        </div>
      </header>

      {series.length < 2 ? (
        <ChartFrame empty emptySentence="Track at least two metrics (and log them on shared days) to explore correlations." />
      ) : (
        <>
          <div
            className="an-matrix"
            style={{ gridTemplateColumns: `88px repeat(${series.length}, minmax(36px, 1fr))` }}
          >
            <span className="an-matrix-cell is-label" />
            {series.map((s) => (
              <span key={`h-${s.id}`} className="an-matrix-cell is-label">
                {s.name.slice(0, 4)}
              </span>
            ))}
            {series.map((row, i) => (
              <FragmentRow key={row.id}>
                <span className="an-matrix-cell is-label">{row.name}</span>
                {series.map((col, j) => {
                  const cell = matrix[i]?.[j]
                  const active = row.id === aId && col.id === bId
                  return (
                    <button
                      key={`${row.id}-${col.id}`}
                      type="button"
                      className={`an-matrix-cell${active ? " is-active" : ""}`}
                      style={{ background: cellFill(cell?.r ?? 0, cell?.n ?? 0, SAMPLE_FLOORS.correlation) }}
                      title={`${row.name} vs ${col.name}: r=${(cell?.r ?? 0).toFixed(2)} n=${cell?.n ?? 0}`}
                      onClick={() => {
                        setAId(row.id)
                        setBId(col.id)
                      }}
                    >
                      {cell && cell.n >= SAMPLE_FLOORS.correlation ? cell.r.toFixed(2) : "·"}
                    </button>
                  )
                })}
              </FragmentRow>
            ))}
          </div>

          <div className="an-studio-tools">
            <select className="an-chip" value={aId} onChange={(e) => setAId(e.target.value)}>
              {series.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <span className="an-canvas-kicker">vs</span>
            <select className="an-chip" value={bId} onChange={(e) => setBId(e.target.value)}>
              {series.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>

          {empty ? (
            <ChartFrame
              empty
              emptySentence={`No overlapping days for these two series in the ${label} — log both on the same dates.`}
            />
          ) : thin ? (
            <ChartFrame thin thinSentence={thinWindowSentence(n, SAMPLE_FLOORS.correlation, label)} />
          ) : (
            <>
              <FindingBlock
                sentence={result?.insight ?? ""}
                n={`n = ${n} overlapping days · r = ${result?.r.toFixed(2)}`}
                caveat={caveat}
              />
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ left: 8, right: 8, bottom: 8 }}>
                  <CartesianGrid stroke={STUDIO_GRID} />
                  <XAxis type="number" dataKey="x" name={defA?.name} fontSize={11} stroke={STUDIO_AXIS} />
                  <YAxis type="number" dataKey="y" name={defB?.name} fontSize={11} stroke={STUDIO_AXIS} />
                  <ZAxis range={[60, 60]} />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={STUDIO_TOOLTIP}
                    formatter={(v: number, name: string) => [v, name === "x" ? defA?.name : defB?.name]}
                  />
                  <Scatter
                    data={scatterData}
                    fill={
                      METRIC_DEFINITIONS.some((m) => m.key === defA?.id)
                        ? resolveMetricColor(defA.id as MetricKey, colors)
                        : "#5eead4"
                    }
                  />
                </ScatterChart>
              </ResponsiveContainer>
              {(aId === "habits" || bId === "habits") && <OpenInListsButton habits />}
            </>
          )}
        </>
      )}

      {ranked.length > 0 && (
        <div>
          <p className="an-canvas-title">Strongest links</p>
          <ul className="an-list">
            {ranked.map((row) => (
              <li key={`${row.aId}-${row.bId}`}>
                <button
                  type="button"
                  onClick={() => {
                    setAId(row.aId)
                    setBId(row.bId)
                  }}
                >
                  <span>
                    {row.a} ↔ {row.b}
                  </span>
                  <span className="an-n">
                    n={row.n} · {row.r >= 0 ? "+" : ""}
                    {row.r.toFixed(2)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="an-caveat">Correlation does not imply causation.</p>
        </div>
      )}
    </div>
  )
}

function FragmentRow({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export default CorrelationExplorer
