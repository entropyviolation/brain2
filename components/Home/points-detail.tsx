/**
 * components/Home/points-detail.tsx — Points detail: every period as a ticker
 *
 * One plate per period (D / W / M / Y / ALL). Each plate has its own
 * **New** / **Cumulative** keys: New charts the points earned in each bucket
 * as volume bars; Cumulative charts the all-time running total as a line,
 * so the last value is the all-time total and the change is what the period
 * added. Day, week, and month keep the current vs possible meter. The chosen
 * mode per period is a per-device convenience in localStorage. Math is
 * `pointsPeriodSeries` in `lib/points-ticker.ts`.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import { usePointsStore } from "@/lib/points-store"
import {
  POINTS_DETAIL_PERIODS,
  formatTickerChange,
  formatTickerDelta,
  formatTickerPoints,
  pointsPeriodSeries,
  type PointsDetailPeriod,
  type PointsPeriodSeries,
  type PointsSeriesMode,
} from "@/lib/points-ticker"
import { cn } from "@/lib/utils"

const MODE_KEY = "brain2-home-points-detail-mode"

type ModeMap = Partial<Record<PointsDetailPeriod, PointsSeriesMode>>

function readModes(): ModeMap {
  try {
    const raw = JSON.parse(window.localStorage.getItem(MODE_KEY) ?? "{}") as Record<string, unknown>
    const out: ModeMap = {}
    for (const p of POINTS_DETAIL_PERIODS) {
      const v = raw[p.id]
      if (v === "new" || v === "cumulative") out[p.id] = v
    }
    return out
  } catch {
    return {}
  }
}

function useModes(): [ModeMap, (period: PointsDetailPeriod, mode: PointsSeriesMode) => void] {
  const [modes, setModes] = useState<ModeMap>({})
  useEffect(() => setModes(readModes()), [])
  const choose = (period: PointsDetailPeriod, mode: PointsSeriesMode) => {
    setModes((prev) => {
      const next = { ...prev, [period]: mode }
      try {
        window.localStorage.setItem(MODE_KEY, JSON.stringify(next))
      } catch {
        // Not remembered this time.
      }
      return next
    })
  }
  return [modes, choose]
}

/** Default: All time reads as a running total; the rest as new points. */
function defaultMode(period: PointsDetailPeriod): PointsSeriesMode {
  return period === "all" ? "cumulative" : "new"
}

function PeriodChart({ series }: { series: PointsPeriodSeries }) {
  const values = series.buckets.map((b) => b.value)
  const w = 320
  const h = 90
  const pad = 6
  const max = Math.max(...values, series.mode === "cumulative" ? series.previous : 0, 0)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const y = (v: number) => pad + (h - pad * 2) * (1 - (v - min) / span)
  const n = values.length
  const first = series.buckets[0]
  const last = series.buckets[n - 1]
  if (!values.some((v) => v !== 0)) {
    return <p className="home-widget-spark-empty">No points in this window yet.</p>
  }
  return (
    <div className="home-points-chart" role="img" aria-label={`${series.mode === "new" ? "New points" : "Running total"} by ${series.period}`}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={90}>
        <line className="home-points-zero" x1="0" x2={w} y1={y(0)} y2={y(0)} vectorEffect="non-scaling-stroke" />
        {series.mode === "new" ? (
          values.map((v, i) => {
            const slot = w / n
            const bw = Math.max(1, slot * 0.7)
            const x = i * slot + (slot - bw) / 2
            const top = Math.min(y(v), y(0))
            const height = Math.max(1, Math.abs(y(v) - y(0)))
            return (
              <rect
                key={series.buckets[i]!.start}
                className={cn("home-points-bar", v < 0 && "is-down", i === n - 1 && "is-now")}
                x={x}
                y={top}
                width={bw}
                height={height}
              >
                <title>{`${series.buckets[i]!.label}: ${formatTickerPoints(v)} pts`}</title>
              </rect>
            )
          })
        ) : (
          <>
            {series.period !== "all" ? (
              <line
                className="home-points-prev"
                x1="0"
                x2={w}
                y1={y(series.previous)}
                y2={y(series.previous)}
                vectorEffect="non-scaling-stroke"
              />
            ) : null}
            <path
              className="home-points-area"
              d={`${linePath(values, w, y)} L${w} ${h} L0 ${h} Z`}
            />
            <path className="home-points-line" d={linePath(values, w, y)} vectorEffect="non-scaling-stroke" />
          </>
        )}
      </svg>
      <div className="home-points-axis" aria-hidden="true">
        <span>{first?.label}</span>
        <span>
          hi {formatTickerPoints(max)} · lo {formatTickerPoints(min)}
        </span>
        <span>{last?.label}</span>
      </div>
    </div>
  )
}

function linePath(values: number[], w: number, y: (v: number) => number): string {
  const x = (i: number) => (values.length <= 1 ? w / 2 : (i / (values.length - 1)) * w)
  return values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
}

export type PointsMeter = { score: string; sub?: string; fill?: number }

export function PointsPeriodsDetail({
  currentDate,
  meters,
}: {
  currentDate: Date
  /** Current vs possible for the periods that have a ceiling. */
  meters: Partial<Record<PointsDetailPeriod, PointsMeter>>
}) {
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const [modes, setMode] = useModes()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const all = useMemo(
    () =>
      POINTS_DETAIL_PERIODS.map((p) => {
        const mode = modes[p.id] ?? defaultMode(p.id)
        return { meta: p, mode, series: pointsPeriodSeries(pointsHistory, p.id, currentDate, mode) }
      }),
    [pointsHistory, currentDate, modes],
  )

  return (
    <div className="home-points-periods" data-testid="home-points-periods">
      {all.map(({ meta, mode, series }) => {
        const meter = meters[meta.id]
        const vs = mode === "cumulative" && meta.id !== "all" ? `total ${meta.vs.replace("vs ", "vs end of ")}` : meta.vs
        return (
          <section
            key={meta.id}
            className="home-points-period"
            data-period={meta.id}
            data-direction={series.direction}
            aria-label={`${meta.label} points`}
          >
            <header className="home-points-period-head">
              <span className="home-points-period-key">{meta.key}</span>
              <span className="home-points-period-name">{meta.label}</span>
              <div className="home-points-mode" role="group" aria-label={`${meta.label} chart`}>
                {(
                  [
                    ["new", "New"],
                    ["cumulative", "Cumulative"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className="home-points-mode-key"
                    aria-pressed={mode === id}
                    title={id === "new" ? "Points earned in each bucket" : "Running all-time total"}
                    onClick={() => setMode(meta.id, id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </header>
            <div className="home-points-quote" suppressHydrationWarning>
              <strong>{mounted ? formatTickerPoints(series.value) : "—"}</strong>
              <span className="home-points-change">
                <span aria-hidden="true">
                  {series.direction === "down" ? "▼" : series.direction === "up" ? "▲" : "■"}
                </span>{" "}
                {mounted ? `${formatTickerDelta(series.delta)} (${formatTickerChange(series)})` : "—"}
              </span>
              <span className="home-points-vs">{vs}</span>
            </div>
            {mounted ? <PeriodChart series={series} /> : <div className="home-points-chart" />}
            {meter ? (
              <div className="home-points-meter">
                <span className="home-points-meter-row">
                  <span>Earned {meter.score}</span>
                  <span>{meter.sub ?? "no possible points left"}</span>
                </span>
                <span className="home-widget-meter" aria-hidden="true">
                  <span style={{ width: `${meter.fill ?? 0}%` }} />
                </span>
              </div>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}
