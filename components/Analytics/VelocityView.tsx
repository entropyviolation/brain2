/**
 * components/Analytics/VelocityView.tsx — Throughput and cycle time
 */
"use client"

import { useMemo } from "react"
import { ResponsiveContainer, BarChart, Bar, ScatterChart, Scatter, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { parseLocalDate } from "@/lib/date-utils"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { dateKeyOf } from "./analytics-range"
import { STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP, StudioReadout } from "./studio-kit"

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
    return dateKeys.map((key) => {
      const d = parseLocalDate(key) ?? new Date()
      return {
        label: d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
        completions: done.filter((t) => dateKeyOf(t.completedDate ?? t.createdAt) === key).length,
        points: pointsHistory.filter((e) => e.date === key).reduce((s, e) => s + e.points, 0),
      }
    })
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
  const empty = done.length === 0 && !byDay.some((d) => d.points > 0)

  return (
    <div className="an-canvas an-stack" data-testid="velocity-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Velocity</p>
          <p className="an-canvas-kicker">{label} · completions, points, cycle time. Display only — not a nanny.</p>
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
              value={med === null ? "—" : med < 24 ? `${med.toFixed(1)}h` : `${(med / 24).toFixed(1)}d`}
              note={`${cycles.length} timed`}
            />
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={byDay}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
              <YAxis fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Bar dataKey="completions" fill="#60a5fa" />
              <Bar dataKey="points" fill="#fbbf24" />
            </BarChart>
          </ResponsiveContainer>
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
