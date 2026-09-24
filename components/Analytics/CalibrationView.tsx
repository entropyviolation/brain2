/**
 * components/Analytics/CalibrationView.tsx — Estimate-vs-actual calibration
 *
 * Sentence + n + caveat. A thin window is not a finding. Scatter and rates
 * only render when the sample clears the floor. Click through to Lists.
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ZAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts"
import {
  getCalibrationPoints,
  summarizeCalibration,
  ratioDistribution,
  calibrationTrend,
} from "@/lib/calibration"
import { itemTitle } from "@/lib/item-utils"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, inRange, isThinSample, thinWindowSentence } from "./analytics-range"
import { openItemsInLists } from "./open-in-lists"
import { STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP, StudioBars } from "./studio-kit"

export function CalibrationView() {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const { keySet, label } = useAnalyticsRange()

  const points = useMemo(
    () => getCalibrationPoints(tasks).filter((p) => inRange(p.completedAt, keySet)),
    [tasks, keySet],
  )
  const summary = useMemo(() => summarizeCalibration(points), [points])
  const distribution = useMemo(() => ratioDistribution(points), [points])
  const trend = useMemo(() => calibrationTrend(points, "week"), [points])
  const thin = isThinSample(points.length, SAMPLE_FLOORS.calibration)
  const empty = points.length === 0

  const scatterData = points.map((p) => ({
    x: p.estimated,
    y: p.actual,
    name: itemTitle(p),
    ratio: p.ratio,
    taskId: p.taskId,
  }))

  const typeRows = useMemo(() => {
    const groups = new Map<string, typeof points>()
    for (const p of points) {
      const task = tasks.find((t) => t.id === p.taskId)
      const key = String(task?.itemTypeId ?? "untyped")
      const bucket = groups.get(key) ?? []
      bucket.push(p)
      groups.set(key, bucket)
    }
    return [...groups.entries()]
      .map(([name, pts]) => {
        const s = summarizeCalibration(pts)
        return { name, value: Math.round(s.medianRatio * 100) / 100, n: s.count }
      })
      .filter((row) => row.n >= SAMPLE_FLOORS.calibration)
      .sort((a, b) => b.n - a.n)
  }, [points, tasks])

  const listRows = useMemo(() => {
    const groups = new Map<string, typeof points>()
    for (const p of points) {
      const task = tasks.find((t) => t.id === p.taskId)
      const listId = task?.lists?.[0]
      const name = lists.find((l) => l.id === listId)?.name ?? "Unlisted"
      const bucket = groups.get(name) ?? []
      bucket.push(p)
      groups.set(name, bucket)
    }
    return [...groups.entries()]
      .map(([name, pts]) => {
        const s = summarizeCalibration(pts)
        return { name, value: Math.round(s.medianRatio * 100) / 100, n: s.count }
      })
      .filter((row) => row.n >= SAMPLE_FLOORS.calibration)
      .sort((a, b) => b.n - a.n)
  }, [points, tasks, lists])

  const pert = useMemo(
    () =>
      points.flatMap((p) => {
        const task = tasks.find((t) => t.id === p.taskId)
        if (!task?.pertEstimate) return []
        return [
          {
            id: p.taskId,
            name: itemTitle(task),
            optimistic: task.pertEstimate.optimistic,
            likely: task.pertEstimate.likely,
            pessimistic: task.pertEstimate.pessimistic,
            actual: p.actual,
          },
        ]
      }),
    [points, tasks],
  )

  const maxAxis = points.reduce((m, p) => Math.max(m, p.estimated, p.actual), 0) || 60
  const caveat =
    "Only tasks with both an estimated duration and a recorded actual count. The median ratio is not a law."

  return (
    <div className="an-canvas an-stack">
      {empty ? (
        <ChartFrame
          empty
          emptySentence={`No calibrated tasks in the ${label}. Complete work that has both an estimate and an actual time.`}
        />
      ) : thin ? (
        <ChartFrame thin thinSentence={thinWindowSentence(points.length, SAMPLE_FLOORS.calibration, label)} />
      ) : (
        <>
          <p className="an-finding">{summary.insight}</p>
          <p className="an-n">
            n = {summary.count} tasks · {Math.round(summary.accurateRate * 100)}% within ±10% · median ratio{" "}
            {summary.medianRatio.toFixed(2)}×
          </p>
          <p className="an-caveat">{caveat}</p>
          <OpenInListsButton taskIds={points.map((p) => p.taskId)} />
        </>
      )}

      {!empty && !thin && (
        <>
          <div className="an-frame">
            <p className="an-canvas-title">Estimated vs actual (minutes)</p>
            <ResponsiveContainer width="100%" height={300}>
              <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={STUDIO_GRID} />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Estimated"
                  unit="m"
                  domain={[0, maxAxis]}
                  fontSize={11}
                  stroke={STUDIO_AXIS}
                  tick={{ fill: STUDIO_AXIS }}
                  label={{ value: "Estimated", position: "insideBottom", offset: -2, fontSize: 11, fill: STUDIO_AXIS }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="Actual"
                  unit="m"
                  domain={[0, maxAxis]}
                  fontSize={11}
                  stroke={STUDIO_AXIS}
                  tick={{ fill: STUDIO_AXIS }}
                  label={{ value: "Actual", angle: -90, position: "insideLeft", fontSize: 11, fill: STUDIO_AXIS }}
                />
                <ZAxis range={[60, 60]} />
                <Tooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  contentStyle={STUDIO_TOOLTIP}
                  formatter={(value: number, key: string) => [`${value}m`, key === "y" ? "Actual" : "Estimated"]}
                  labelFormatter={() => ""}
                />
                <Scatter
                  data={scatterData}
                  fill="#7dd3fc"
                  onClick={(d: { taskId?: string }) => d?.taskId && openItemsInLists({ taskIds: [d.taskId] })}
                  cursor="pointer"
                />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="an-canvas-hint">
              Points above the diagonal took longer than estimated; points below finished faster.
            </p>
          </div>

          <div className="an-frame">
            <p className="an-canvas-title">Ratio distribution (actual ÷ estimated)</p>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={distribution} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={STUDIO_GRID} />
                <XAxis
                  dataKey="label"
                  fontSize={10}
                  interval={0}
                  angle={-12}
                  textAnchor="end"
                  height={50}
                  stroke={STUDIO_AXIS}
                  tick={{ fill: STUDIO_AXIS }}
                />
                <YAxis allowDecimals={false} fontSize={11} stroke={STUDIO_AXIS} tick={{ fill: STUDIO_AXIS }} />
                <Tooltip contentStyle={STUDIO_TOOLTIP} />
                <Bar dataKey="count">
                  {distribution.map((b, i) => (
                    <Cell key={i} fill={b.label.includes("accurate") ? "#34d399" : "#fbbf24"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {typeRows.length > 0 && (
            <div>
              <p className="an-canvas-title">Median ratio by item type</p>
              <StudioBars
                rows={typeRows.map((r) => ({ name: `${r.name} (n=${r.n})`, value: r.value }))}
                max={Math.max(...typeRows.map((r) => r.value), 1)}
                unit="×"
              />
            </div>
          )}

          {listRows.length > 0 && (
            <div>
              <p className="an-canvas-title">Median ratio by list</p>
              <StudioBars
                rows={listRows.map((r) => ({ name: `${r.name} (n=${r.n})`, value: r.value }))}
                max={Math.max(...listRows.map((r) => r.value), 1)}
                unit="×"
              />
            </div>
          )}

          {pert.length > 0 && (
            <div>
              <p className="an-canvas-title">PERT bands</p>
              <ul className="an-list">
                {pert.map((row) => (
                  <li key={row.id}>
                    <button type="button" onClick={() => openItemsInLists({ taskIds: [row.id] })}>
                      <span className="truncate">{row.name}</span>
                      <span className="an-n">
                        {row.optimistic}–{row.likely}–{row.pessimistic} vs {row.actual}m
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {trend.length > 1 && (
            <div className="an-frame">
              <p className="an-canvas-title">Calibration trend (median ratio by week)</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={STUDIO_GRID} />
                  <XAxis
                    dataKey="periodKey"
                    fontSize={9}
                    tickFormatter={(k: string) => k.slice(5, 10)}
                    stroke={STUDIO_AXIS}
                    tick={{ fill: STUDIO_AXIS }}
                  />
                  <YAxis fontSize={11} stroke={STUDIO_AXIS} tick={{ fill: STUDIO_AXIS }} />
                  <Tooltip contentStyle={STUDIO_TOOLTIP} formatter={(v: number) => `${v.toFixed(2)}×`} />
                  <Line type="monotone" dataKey="medianRatio" stroke="#7dd3fc" strokeWidth={2} dot />
                </LineChart>
              </ResponsiveContainer>
              <p className="an-canvas-hint">A ratio of 1.0× means estimates matched reality.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default CalibrationView
