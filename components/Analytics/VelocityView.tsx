/**
 * components/Analytics/VelocityView.tsx — Throughput and cycle time
 */
"use client"

import { useMemo, useState } from "react"
import { ResponsiveContainer, BarChart, Bar, ComposedChart, Line, Legend, ReferenceLine, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { parseLocalDate } from "@/lib/date-utils"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { dateKeyOf } from "./analytics-range"
import { openItemsInLists } from "./open-in-lists"
import { STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP, StudioBars, StudioHelp, StudioReadout } from "./studio-kit"
import { quadrantOf, quantile, rollingMean, shareAtMost, type Quadrant } from "./behavior-stats"
import "./behavior-views.css"

const QUAD: Record<Quadrant, { name: string; fill: string }> = {
  "quick-win": { name: "Quick wins", fill: "#34d399" },
  "slow-reward": { name: "Slow rewards", fill: "#fbbf24" },
  "slow-small": { name: "Slow and small", fill: "#9ca4ae" },
  "fast-small": { name: "Fast and small", fill: "#60a5fa" },
}
const LOG_TICKS = [0.25, 1, 4, 24, 168, 720, 2160]
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function fmtHours(h: number | null): string {
  if (h === null) return "—"
  if (h < 1) return `${Math.round(h * 60)}m`
  return h < 24 ? `${h.toFixed(1)}h` : `${(h / 24).toFixed(1)}d`
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function VelocityView() {
  const tasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const { dateKeys, keySet, label } = useAnalyticsRange()

  const done = useMemo(
    () =>
      tasks.filter((t) => {
        const key = dateKeyOf(t.completedDate ?? (t.completed ? t.createdAt : null))
        return t.completed && key !== null && keySet.has(key)
      }),
    [tasks, keySet],
  )

  const byDay = useMemo(() => {
    const rows = dateKeys.map((key) => {
      const d = parseLocalDate(key) ?? new Date()
      return {
        label: d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
        dow: (d.getDay() + 6) % 7,
        completions: done.filter((t) => dateKeyOf(t.completedDate ?? t.createdAt) === key).length,
        points: pointsHistory.filter((e) => e.date === key).reduce((s, e) => s + e.points, 0),
      }
    })
    const avg = rollingMean(rows.map((r) => r.completions), 7)
    return rows.map((r, i) => ({ ...r, avg7: Math.round(avg[i] * 100) / 100 }))
  }, [dateKeys, done, pointsHistory])

  const cycles = useMemo(() => {
    const hours: number[] = []
    for (const t of done) {
      const start = t.startedAt ? new Date(t.startedAt) : t.createdAt ? new Date(t.createdAt) : null
      const end = t.completedDate ? new Date(t.completedDate) : null
      if (!start || !end) continue
      const h = (end.getTime() - start.getTime()) / 3_600_000
      if (h >= 0 && Number.isFinite(h)) hours.push(h)
    }
    return hours
  }, [done])

  const scatter = useMemo(
    () =>
      done
        .filter((t) => (t.rewardValue ?? 0) > 0 && (t.actualDuration ?? 0) > 0)
        .map((t) => ({ x: t.actualDuration ?? 0, y: t.rewardValue ?? 0, id: t.id })),
    [done],
  )

  const med = median(cycles)
  const p85 = quantile(cycles, 0.85)
  const p95 = quantile(cycles, 0.95)
  const [withinDays, setWithinDays] = useState(3)
  const withinShare = shareAtMost(cycles, withinDays * 24)
  const throughput = dateKeys.length ? done.length / dateKeys.length : 0
  const meanCycleDays = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length / 24 : 0
  const weekday = useMemo(() => {
    const sum = Array(7).fill(0)
    const n = Array(7).fill(0)
    for (const r of byDay) {
      sum[r.dow] += r.completions
      n[r.dow]++
    }
    return WEEKDAYS.map((name, i) => ({ name, value: n[i] ? Math.round((sum[i] / n[i]) * 10) / 10 : 0 }))
  }, [byDay])

  // Quadrant scatter: cycle time against points the item earned (ledger, else reward value).
  const quad = useMemo(() => {
    const earned: Record<string, number> = {}
    for (const e of pointsHistory) earned[e.taskId] = (earned[e.taskId] ?? 0) + e.points
    const pts = done.flatMap((t) => {
      const start = t.startedAt ? new Date(t.startedAt) : t.createdAt ? new Date(t.createdAt) : null
      const end = t.completedDate ? new Date(t.completedDate) : null
      if (!start || !end) return []
      const h = (end.getTime() - start.getTime()) / 3_600_000
      const y = earned[t.id] ?? t.rewardValue ?? 0
      if (!(h > 0) || !Number.isFinite(h) || y <= 0) return []
      return [{ id: t.id, name: t.description, x: Math.round(h * 100) / 100, y: Math.round(y * 100) / 100 }]
    })
    const mx = median(pts.map((p) => p.x)) ?? 0
    const my = median(pts.map((p) => p.y)) ?? 0
    const groups: Record<Quadrant, typeof pts> = { "quick-win": [], "slow-reward": [], "slow-small": [], "fast-small": [] }
    for (const p of pts) groups[quadrantOf(p.x, p.y, mx, my)].push(p)
    return { pts, mx, my, groups }
  }, [done, pointsHistory])
  const empty = done.length === 0 && !byDay.some((d) => d.points > 0)

  return (
    <div className="an-canvas an-stack" data-testid="velocity-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Velocity</p>
          <p className="an-canvas-kicker">{label}</p>
        </div>
      </header>
      {empty ? (
        <ChartFrame empty emptySentence={`No completions or points in the ${label}.`} />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="Completions" value={done.length} note={label} />
            <StudioReadout
              label="Median cycle"
              value={fmtHours(med)}
              note={`${cycles.length} timed`}
            />
            <StudioReadout label="85th percentile" value={fmtHours(p85)} note="85% finish within" />
            <StudioReadout label="95th percentile" value={fmtHours(p95)} note="the long tail" />
            <StudioReadout
              label="Little's Law WIP"
              value={`~${(throughput * meanCycleDays).toFixed(1)}`}
              note={`${throughput.toFixed(2)}/day × ${meanCycleDays.toFixed(1)} d`}
              tip="Average items in flight ≈ throughput × mean cycle time (Little 1961). Assumes a steady state."
            />
          </div>
          {/* Points run far larger than counts, so each gets its own axis. */}
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={byDay}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
              <YAxis yAxisId="n" fontSize={11} stroke={STUDIO_AXIS} allowDecimals={false} />
              <YAxis yAxisId="pts" orientation="right" fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar yAxisId="n" dataKey="completions" name="Completions" fill="#60a5fa" />
              <Bar yAxisId="pts" dataKey="points" name="Points" fill="#fbbf24" />
              <Line yAxisId="n" dataKey="avg7" name="7-day mean" stroke={STUDIO_AXIS} dot={false} strokeWidth={1.5} />
            </ComposedChart>
          </ResponsiveContainer>
          {cycles.length > 0 && (
            <div data-testid="velocity-within">
              <div className="an-bv-tools">
                <label className="an-bv-slider">
                  Finish within
                  <input type="range" min={1} max={60} value={withinDays} onChange={(e) => setWithinDays(Number(e.target.value))} />
                  <output>{withinDays} d</output>
                </label>
                <span className="an-bv-math">
                  {Math.round(withinShare * 100)}% of {cycles.length} timed items did (empirical CDF)
                </span>
              </div>
            </div>
          )}
          <div>
            <p className="an-canvas-title an-canvas-title-row">
              Throughput by weekday
              <StudioHelp text="Mean completions on each weekday in this window." />
            </p>
            <StudioBars rows={weekday} max={Math.max(1, ...weekday.map((w) => w.value))} unit="" />
          </div>
          {quad.pts.length >= 4 && (
            <div data-testid="velocity-quadrants">
              <p className="an-canvas-title an-canvas-title-row">
                Quick wins and slow rewards
                <StudioHelp text="x = cycle time (start or creation to done, log scale), y = points the item earned. Lines are the medians, so each corner is relative to you. Click a dot to open the item." />
              </p>
              <ResponsiveContainer width="100%" height={240}>
                <ScatterChart>
                  <CartesianGrid stroke={STUDIO_GRID} />
                  <XAxis type="number" dataKey="x" name="hours" scale="log" domain={["dataMin", "dataMax"]} ticks={LOG_TICKS} tickFormatter={(h: number) => fmtHours(h)} fontSize={11} stroke={STUDIO_AXIS} />
                  <YAxis type="number" dataKey="y" name="points" fontSize={11} stroke={STUDIO_AXIS} />
                  <Tooltip contentStyle={STUDIO_TOOLTIP} />
                  <ReferenceLine x={quad.mx} stroke={STUDIO_AXIS} strokeDasharray="4 3" />
                  <ReferenceLine y={quad.my} stroke={STUDIO_AXIS} strokeDasharray="4 3" />
                  {(Object.keys(QUAD) as Quadrant[]).map((q) => (
                    <Scatter
                      key={q}
                      name={QUAD[q].name}
                      data={quad.groups[q]}
                      fill={QUAD[q].fill}
                      cursor="pointer"
                      onClick={(p: { id?: string }) => p?.id && openItemsInLists({ taskIds: [p.id] })}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div className="an-bv-key">
                {(Object.keys(QUAD) as Quadrant[]).map((q) => (
                  <span key={q}>
                    <i style={{ background: QUAD[q].fill }} />
                    {QUAD[q].name} · {quad.groups[q].length}
                  </span>
                ))}
                <span>median {fmtHours(quad.mx)} · {quad.my} pts</span>
              </div>
            </div>
          )}
          {scatter.length > 0 && (
            <>
              <p className="an-canvas-title">Reward vs actual minutes</p>
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart>
                  <CartesianGrid stroke={STUDIO_GRID} />
                  <XAxis type="number" dataKey="x" name="minutes" fontSize={11} stroke={STUDIO_AXIS} />
                  <YAxis type="number" dataKey="y" name="reward" fontSize={11} stroke={STUDIO_AXIS} />
                  <Tooltip contentStyle={STUDIO_TOOLTIP} />
                  <Scatter data={scatter} fill="#34d399" />
                </ScatterChart>
              </ResponsiveContainer>
            </>
          )}
          <OpenInListsButton taskIds={done.map((t) => t.id)} />
        </>
      )}
    </div>
  )
}
