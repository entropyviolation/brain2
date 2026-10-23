/**
 * components/Analytics/CorrelationExplorer.tsx — Pairwise correlation matrix
 *
 * Sentence + n + caveat. Ranked links and the scatter stay hidden until the
 * overlap clears the sample floor. Shared Analytics range. Not a chart builder.
 */
"use client"

import { useMemo, useState, type ReactNode } from "react"
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid, ZAxis, ReferenceLine } from "recharts"
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
import { SAMPLE_FLOORS, isThinSample, thinWindowSentence } from "./analytics-range"
import { FindingBlock, STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP } from "./studio-kit"
import { NativeSelect } from "@/components/ui/native-select"
import { dailyMeans, fisherInterval, fitLine, laggedCorrelation } from "./meta-math"
import { divergingFill } from "./meta-plots"

interface NamedSeries {
  id: string
  name: string
  points: SeriesPoint[]
}

function weekdayIndex(key: string): number {
  const d = parseLocalDate(key)
  return d ? d.getDay() : 0
}

function cellStyle(r: number, n: number, floor: number): { background: string; color: string } {
  if (n < floor) return { background: "#e1e5e8", color: "#69717c" }
  const { fill, ink } = divergingFill(r)
  return { background: fill, color: ink }
}

type LinkSign = "all" | "positive" | "negative"

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
        // One mean per local day so metrics join day-keyed series (habit %, sleep, points).
        points: dailyMeans(
          datapoints.map((dp) => ({ at: dp.at, value: dp.values[d.key] })),
          keySet,
        ),
      })
    }
    const habits: SeriesPoint[] = habitTasks.length
      ? dateKeys.map((date) => ({
          date,
          value: calculateDayPercentageAV(date, habitTasks as never, weeklyData as never, weekdayIndex(date), exemptionTest(habitExemptions, "daily")),
        }))
      : []
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

  const [lag, setLag] = useState(0)
  const [sign, setSign] = useState<LinkSign>("all")
  const lagged = useMemo(
    () => (defA && defB ? laggedCorrelation(defA.points, defB.points, lag) : { r: 0, n: 0 }),
    [defA, defB, lag],
  )
  const lagProfile = useMemo(
    () => (defA && defB ? [0, 1, 2, 3, 7].map((k) => ({ k, ...laggedCorrelation(defA.points, defB.points, k) })) : []),
    [defA, defB],
  )
  const fit = useMemo(() => fitLine(aligned.a, aligned.b), [aligned])
  const ci = result ? fisherInterval(result.r, result.n) : null
  const xMin = aligned.a.length ? Math.min(...aligned.a) : 0
  const xMax = aligned.a.length ? Math.max(...aligned.a) : 0

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

  const rankedAll = useMemo(() => {
    const out: { a: string; b: string; r: number; n: number; aId: string; bId: string }[] = []
    for (let i = 0; i < series.length; i++) {
      for (let j = i + 1; j < series.length; j++) {
        const r = correlate(series[i].points, series[j].points)
        if (r.n >= SAMPLE_FLOORS.correlation) {
          out.push({ a: series[i].name, b: series[j].name, r: r.r, n: r.n, aId: series[i].id, bId: series[j].id })
        }
      }
    }
    return out.sort((x, y) => Math.abs(y.r) - Math.abs(x.r))
  }, [series])
  const ranked = useMemo(
    () => rankedAll.filter((row) => (sign === "positive" ? row.r > 0 : sign === "negative" ? row.r < 0 : true)).slice(0, 8),
    [rankedAll, sign],
  )

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
              <span key={`h-${s.id}`} className="an-matrix-cell is-label" title={s.name}>
                {s.name.slice(0, 4)}
              </span>
            ))}
            {series.map((row, i) => (
              <FragmentRow key={row.id}>
                <span className="an-matrix-cell is-label">{row.name}</span>
                {series.map((col, j) => {
                  const cell = matrix[i]?.[j]
                  const active = row.id === aId && col.id === bId
                  const diag = i === j
                  return (
                    <button
                      key={`${row.id}-${col.id}`}
                      type="button"
                      className={`an-matrix-cell${active ? " is-active" : ""}${diag ? " is-diag" : ""}`}
                      style={cellStyle(cell?.r ?? 0, cell?.n ?? 0, SAMPLE_FLOORS.correlation)}
                      title={`${row.name} vs ${col.name}: r=${(cell?.r ?? 0).toFixed(2)} n=${cell?.n ?? 0}`}
                      onClick={() => {
                        setAId(row.id)
                        setBId(col.id)
                      }}
                    >
                      {diag ? "—" : cell && cell.n >= SAMPLE_FLOORS.correlation ? cell.r.toFixed(2) : "·"}
                    </button>
                  )
                })}
              </FragmentRow>
            ))}
          </div>

          <div className="an-studio-tools">
            <NativeSelect className="an-chip" value={aId} onChange={(e) => setAId(e.target.value)}>
              {series.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
            <span className="an-canvas-kicker">vs</span>
            <NativeSelect className="an-chip" value={bId} onChange={(e) => setBId(e.target.value)}>
              {series.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </NativeSelect>
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
                n={`n = ${n} overlapping days · r = ${result?.r.toFixed(2)}${
                  ci ? ` · 95% CI ${ci.lo.toFixed(2)} to ${ci.hi.toFixed(2)}` : ""
                }${fit ? ` · slope ${fit.slope.toFixed(2)} ${defB?.name ?? ""} per ${defA?.name ?? ""}` : ""}`}
                caveat={caveat}
              />
              <ResponsiveContainer width="100%" height={260}>
                <ScatterChart margin={{ left: 8, right: 8, bottom: 8 }}>
                  <CartesianGrid stroke={STUDIO_GRID} />
                  <XAxis type="number" dataKey="x" name={defA?.name} fontSize={11} stroke={STUDIO_AXIS} />
                  <YAxis type="number" dataKey="y" name={defB?.name} fontSize={11} stroke={STUDIO_AXIS} />
                  <ZAxis range={[60, 60]} />
                  {fit && xMax > xMin ? (
                    <ReferenceLine
                      segment={[
                        { x: xMin, y: fit.intercept + fit.slope * xMin },
                        { x: xMax, y: fit.intercept + fit.slope * xMax },
                      ]}
                      stroke="#14171c"
                      strokeDasharray="4 3"
                      ifOverflow="extendDomain"
                    />
                  ) : null}
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
              <section className="an-plate" data-testid="correlation-lag">
                <p className="an-canvas-title">Does it carry over?</p>
                <p className="an-canvas-hint">
                  Shift {defB?.name} later by a few days and re-join. A link that holds at lag 1 is “today’s {defA?.name} goes
                  with tomorrow’s {defB?.name}”. Still not a cause, and sticky series inflate r.
                </p>
                <div className="an-meta-tools">
                  <label>
                    Lag
                    <input type="range" min={0} max={7} value={lag} onChange={(e) => setLag(Number(e.target.value))} aria-label="Lag in days" />
                    {lag} d
                  </label>
                  <span className="an-n">
                    {lagged.n >= SAMPLE_FLOORS.correlation
                      ? `r = ${lagged.r >= 0 ? "+" : ""}${lagged.r.toFixed(2)} over ${lagged.n} days`
                      : `n = ${lagged.n}, below the floor of ${SAMPLE_FLOORS.correlation}`}
                  </span>
                </div>
                <div className="an-meta-tags">
                  {lagProfile.map((p) => (
                    <button key={p.k} type="button" className="an-meta-chip" aria-pressed={p.k === lag} onClick={() => setLag(p.k)}>
                      {`lag ${p.k}: ${p.n >= SAMPLE_FLOORS.correlation ? (p.r >= 0 ? "+" : "") + p.r.toFixed(2) : "·"}`}
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {rankedAll.length > 0 && (
        <div>
          <p className="an-canvas-title">Strongest links</p>
          <div className="an-meta-tools">
            {(["all", "positive", "negative"] as const).map((key) => (
              <button key={key} type="button" className="an-meta-chip" aria-pressed={sign === key} onClick={() => setSign(key)}>
                {key === "all" ? "all" : key === "positive" ? "move together" : "move apart"}
              </button>
            ))}
          </div>
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
