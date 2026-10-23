/**
 * components/Analytics/CalibrationView.tsx — Estimate-vs-actual calibration
 *
 * Sentence + n + caveat. A thin window is not a finding. Scatter and rates
 * only render when the sample clears the floor. Click through to Lists.
 */
"use client"

import { useMemo, useState } from "react"
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
  ReferenceLine,
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
import { STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP, StudioBars, StudioReadout } from "./studio-kit"
import { biasStats, estimateBarcode, pertMean, pertSummary, ratioBySize } from "./accuracy-stats"
import "./accuracy-views.css"

const VERDICT_CLASS = { under: "is-early", on: "is-on", over: "is-over" } as const

export function CalibrationView() {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const { keySet, label } = useAnalyticsRange()
  const [bandPct, setBandPct] = useState(10)
  const [groupBy, setGroupBy] = useState<"type" | "list">("type")
  const [myEstimate, setMyEstimate] = useState(30)

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
      const key = String(task?.type ?? "untyped")
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

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const listName = useMemo(() => new Map(lists.map((l) => [l.id, l.name])), [lists])
  const barcode = useMemo(
    () =>
      estimateBarcode(
        points,
        (p) => {
          const task = taskById.get(p.taskId)
          if (groupBy === "type") return String(task?.type ?? "untyped")
          return listName.get(task?.lists?.[0] ?? "") ?? "Unlisted"
        },
        bandPct,
      ),
    [points, taskById, listName, groupBy, bandPct],
  )
  const onShare = points.length
    ? barcode.reduce((s, row) => s + row.on, 0) / points.length
    : 0
  const bias = useMemo(() => biasStats(points.map((p) => p.ratio)), [points])
  const bySize = useMemo(() => ratioBySize(points), [points])
  const pertHits = useMemo(() => pertSummary(pert), [pert])

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
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: maxAxis, y: maxAxis },
                  ]}
                  stroke={STUDIO_AXIS}
                  strokeDasharray="4 3"
                  ifOverflow="hidden"
                />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: maxAxis, y: maxAxis * (1 + bandPct / 100) },
                  ]}
                  stroke={STUDIO_GRID}
                  strokeDasharray="2 4"
                  ifOverflow="hidden"
                />
                <ReferenceLine
                  segment={[
                    { x: 0, y: 0 },
                    { x: maxAxis, y: maxAxis * (1 - bandPct / 100) },
                  ]}
                  stroke={STUDIO_GRID}
                  strokeDasharray="2 4"
                  ifOverflow="hidden"
                />
                <Scatter
                  data={scatterData}
                  fill="#173a7a"
                  fillOpacity={0.7}
                  onClick={(d: { taskId?: string }) => d?.taskId && openItemsInLists({ taskIds: [d.taskId] })}
                  cursor="pointer"
                />
              </ScatterChart>
            </ResponsiveContainer>
            <p className="an-canvas-hint">
              Points above the dashed diagonal took longer than estimated; points below finished faster. The
              dotted lines are the ±{bandPct}% band.
            </p>
          </div>

          <div className="an-acc-plate">
            <p className="an-canvas-title">Estimate barcode</p>
            <div className="an-acc-tools">
              <label>
                On if within ±{bandPct}%
                <input
                  type="range"
                  min={5}
                  max={50}
                  step={5}
                  value={bandPct}
                  aria-label="Band that counts as on"
                  onChange={(e) => setBandPct(Number(e.target.value))}
                />
              </label>
              <label>
                Rows
                <select
                  className="an-chip"
                  value={groupBy}
                  aria-label="Barcode rows"
                  onChange={(e) => setGroupBy(e.target.value as "type" | "list")}
                >
                  <option value="type">Item type</option>
                  <option value="list">List</option>
                </select>
              </label>
              <span className="an-n">{Math.round(onShare * 100)}% on at this band</span>
            </div>
            <div className="an-acc-barcode">
              {barcode.map((row) => (
                <div key={row.group} className="an-acc-barcode-row">
                  <span className="an-acc-barcode-name" title={row.group}>
                    {row.group}
                  </span>
                  <span className="an-acc-cells">
                    {row.cells.map((c) => (
                      <button
                        key={c.taskId}
                        type="button"
                        className={`an-acc-cell ${VERDICT_CLASS[c.verdict]}`}
                        title={`${c.description}: ${c.estimated}m est. → ${c.actual}m (${c.ratio.toFixed(2)}×)`}
                        aria-label={`${c.description}, ${c.verdict}`}
                        onClick={() => openItemsInLists({ taskIds: [c.taskId] })}
                      />
                    ))}
                  </span>
                  <span className="an-n">
                    {row.on}/{row.cells.length}
                  </span>
                </div>
              ))}
            </div>
            <div className="an-acc-key">
              <span><i className="is-early" />Finished early</span>
              <span><i className="is-on" />On estimate</span>
              <span><i className="is-over" />Ran over</span>
              <span>Oldest left, newest right</span>
            </div>
          </div>

          <div className="an-acc-plate">
            <p className="an-canvas-title">Plan a task with your own track record</p>
            <div className="an-acc-tools">
              <label>
                My estimate
                <input
                  type="number"
                  min={1}
                  value={myEstimate}
                  aria-label="Your estimate in minutes"
                  onChange={(e) => setMyEstimate(Math.max(1, Number(e.target.value) || 1))}
                />
                min
              </label>
            </div>
            <div className="an-readouts">
              <StudioReadout label="Coin flip (P50)" value={`${Math.round(myEstimate * bias.p50)}m`} note="half run longer" />
              <StudioReadout label="Safe (P80)" value={`${Math.round(myEstimate * bias.p80)}m`} note="4 in 5 fit" />
              <StudioReadout label="Very safe (P90)" value={`${Math.round(myEstimate * bias.p90)}m`} note="9 in 10 fit" />
              <StudioReadout
                label="Typical multiplier"
                value={`${bias.geoMeanRatio.toFixed(2)}×`}
                note={`spread ±${bias.logSd.toFixed(2)} ln`}
                tip="Geometric mean of actual ÷ estimate. One huge overrun moves it less than a plain mean."
              />
            </div>
            <p className="an-acc-math">
              Reference-class forecast: your estimate × the 50th, 80th and 90th percentile of your past actual ÷
              estimate ratios (n = {bias.n}). Typical multiplier = exp(mean ln ratio). Past work in this window only.
            </p>
          </div>

          <div className="an-acc-plate">
            <p className="an-canvas-title">Bias by task size</p>
            <StudioBars
              rows={bySize
                .filter((b) => b.median !== null)
                .map((b) => ({ name: `${b.label} (n=${b.n})`, value: Math.round((b.median ?? 0) * 100) / 100 }))}
              max={Math.max(2, ...bySize.map((b) => b.median ?? 0))}
              unit="×"
            />
            <p className="an-acc-math">
              Median actual ÷ estimate by how big the estimate was. Studies often find short tasks run long and long
              tasks get padded. Thin bins (small n) are noise.
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
              <p className="an-n">
                {pertHits.inside} of {pertHits.n} landed inside optimistic–pessimistic · {pertHits.past} past the
                pessimistic · {pertHits.early} before the optimistic
              </p>
              <details className="an-acc-fold" open={pert.length <= 8}>
                <summary>{pert.length} tasks with three-point estimates</summary>
                <ul className="an-list">
                  {pert.map((row) => (
                    <li key={row.id}>
                      <button type="button" onClick={() => openItemsInLists({ taskIds: [row.id] })}>
                        <span className="truncate">{row.name}</span>
                        <span className="an-n">
                          {row.optimistic}–{row.likely}–{row.pessimistic} (mean {Math.round(pertMean(row))}) vs{" "}
                          {row.actual}m
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </details>
              <p className="an-acc-math">PERT mean = (optimistic + 4 × likely + pessimistic) ÷ 6.</p>
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
                  <ReferenceLine y={1} stroke={STUDIO_AXIS} strokeDasharray="4 3" />
                  <Line type="monotone" dataKey="medianRatio" stroke="#173a7a" strokeWidth={2} dot />
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
