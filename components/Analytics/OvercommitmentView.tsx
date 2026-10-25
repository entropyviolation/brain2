/**
 * components/Analytics/OvercommitmentView.tsx — Load early-warning (#238)
 *
 * One sentence + n over the shared Analytics range. A thin window is not a
 * finding. Does not reschedule anything.
 */
"use client"

import { useMemo, useState } from "react"
import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { useTaskStore } from "@/lib/task-store"
import { summarizeOvercommitment } from "@/lib/overcommitment"
import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import { getTaskCompletionDate } from "@/lib/completion-status"
import { itemTitleOrUntitled } from "@/lib/item-utils"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, thinWindowSentence } from "./analytics-range"
import { CanvasTitle, STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP, StudioReadout } from "./studio-kit"
import { BEHAVIOR_FILL, RangeField, SearchField, SizedSquares, round1, useShowMore } from "./behavior-kit"

const CAVEAT =
  "Day-pushes are reconstructed from each item’s daysPushed, ending at its schedule (or today). Logged minutes are timeLogs. This does not move your day."

export function OvercommitmentView() {
  const tasks = useTaskStore((s) => s.tasks)
  const { dateKeys, label } = useAnalyticsRange()

  const report = useMemo(
    () =>
      summarizeOvercommitment(tasks, dateKeys, {
        floor: SAMPLE_FLOORS.overcommitment,
      }),
    [tasks, dateKeys],
  )

  const periodPushes = useMemo(() => {
    let weeks = 0
    let months = 0
    for (const t of tasks) {
      weeks += Math.max(0, t.weeksPushed ?? 0)
      months += Math.max(0, t.monthsPushed ?? 0)
    }
    return { weeks, months }
  }, [tasks])

  const chartData = useMemo(
    () =>
      dateKeys.map((key, i) => {
        const d = parseLocalDate(key) ?? new Date()
        return {
          label: d.toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
          }),
          minutes: report.minutes[i]?.value ?? 0,
          pushes: report.pushes[i]?.value ?? 0,
        }
      }),
    [dateKeys, report.minutes, report.pushes],
  )

  const totals = useMemo(() => {
    const pushes = report.pushes.reduce((s, p) => s + (p.value ?? 0), 0)
    const minutes = report.minutes.reduce((s, p) => s + (p.value ?? 0), 0)
    const keys = new Set(dateKeys)
    const done = new Set<string>()
    for (const t of tasks) {
      const d = getTaskCompletionDate(t)
      if (d && keys.has(formatLocalDateKey(d))) done.add(t.id)
    }
    return { pushes, minutes, done: done.size }
  }, [report.pushes, report.minutes, tasks, dateKeys])

  // Step heights: per week of the window, pushes vs completions vs logged hours.
  const weeks = useMemo(() => {
    const doneByDay = new Map<string, number>()
    for (const t of tasks) {
      const d = getTaskCompletionDate(t)
      if (!d) continue
      const k = formatLocalDateKey(d)
      doneByDay.set(k, (doneByDay.get(k) ?? 0) + 1)
    }
    const rows: {
      label: string
      pushes: number
      done: number
      hours: number
    }[] = []
    dateKeys.forEach((key, i) => {
      if (i % 7 === 0) {
        const d = parseLocalDate(key) ?? new Date()
        rows.push({
          label: d.toLocaleDateString(undefined, {
            month: "numeric",
            day: "numeric",
          }),
          pushes: 0,
          done: 0,
          hours: 0,
        })
      }
      const row = rows[rows.length - 1]
      row.pushes += report.pushes[i]?.value ?? 0
      row.hours += (report.minutes[i]?.value ?? 0) / 60
      row.done += doneByDay.get(key) ?? 0
    })
    return rows
  }, [dateKeys, tasks, report.pushes, report.minutes])
  const weekMax = Math.max(1, ...weeks.flatMap((w) => [w.pushes, w.done]))
  const overWeeks = weeks.filter((w) => w.pushes > w.done).length

  const [minPushes, setMinPushes] = useState(2)
  const [query, setQuery] = useState("")
  const pushedItems = useMemo(() => {
    const q = query.trim().toLowerCase()
    return tasks
      .filter((t) => !t.completed)
      .map((t) => ({
        id: t.id,
        label: itemTitleOrUntitled(t),
        value: Math.max(0, t.daysPushed ?? 0),
        weeks: Math.max(0, t.weeksPushed ?? 0),
        months: Math.max(0, t.monthsPushed ?? 0),
      }))
      .filter((r) => r.value >= minPushes && (!q || r.label.toLowerCase().includes(q)))
      .sort((a, b) => b.value - a.value)
  }, [tasks, minPushes, query])
  const pushedMax = useMemo(() => Math.max(1, ...tasks.map((t) => t.daysPushed ?? 0)), [tasks])
  const { shown: shownSquares, more: moreSquares } = useShowMore(pushedItems, 24)
  const [picked, setPicked] = useState<string | null>(null)
  const pickedItem = pushedItems.find((r) => r.id === picked)

  const shiftLine = (label: string, shift: typeof report.pushShift) =>
    shift
      ? `${label} shifted on ${shift.date}: mean ${round1(shift.meanBefore)} → ${round1(shift.meanAfter)} per day.`
      : null
  const shifts = [shiftLine("Day-pushes", report.pushShift), shiftLine("Logged minutes", report.minutesShift)].filter(
    Boolean,
  )

  const listIds = report.pushedTaskIds.length ? report.pushedTaskIds : report.loggedTaskIds
  const empty = report.status === "empty"
  const thin = report.status === "thin"
  const extraPushes =
    periodPushes.weeks > 0 || periodPushes.months > 0
      ? ` Week-pushes on the vault: ${periodPushes.weeks}. Month-pushes: ${periodPushes.months}.`
      : ""

  return (
    <div className="an-canvas an-stack" data-testid="overcommit-view">
      <p className="an-canvas-kicker">Load early-warning — reconstructed, not a nanny.</p>
      {empty ? (
        <ChartFrame
          empty
          emptySentence={`No day-pushes or logged minutes in the ${label}. Push a task on To Do or log time to see a load trend.`}
        />
      ) : thin ? (
        <ChartFrame thin thinSentence={thinWindowSentence(report.n, SAMPLE_FLOORS.overcommitment, label)} />
      ) : (
        <>
          <p className="an-finding">
            {report.sentence}
            {extraPushes}
          </p>
          <p className="an-n">
            n = {report.n} day{report.n === 1 ? "" : "s"} with pushes or logs
          </p>
          <p className="an-caveat">{CAVEAT}</p>
          <OpenInListsButton taskIds={listIds} />
          <div className="an-readouts" data-testid="overcommit-readouts">
            <StudioReadout
              label="Day-pushes"
              value={totals.pushes}
              note={`${round1(totals.pushes / Math.max(1, dateKeys.length))} / day`}
            />
            <StudioReadout
              label="Logged"
              value={`${round1(totals.minutes / 60)} h`}
              note={`${round1(totals.minutes / Math.max(1, dateKeys.length))} min / day`}
            />
            <StudioReadout label="Completed" value={totals.done} note="items done in window" />
            <StudioReadout
              label="Push : done"
              value={totals.done ? round1(totals.pushes / totals.done) : "—"}
              note="pushes per completion"
              tip="Above 1 means you deferred more often than you finished."
            />
            <StudioReadout
              label="Push trend"
              value={`${report.pushTrend.perDay >= 0 ? "+" : ""}${round1(report.pushTrend.perDay)}`}
              note={`per day · ${report.pushTrend.direction}`}
              tip="Least-squares slope of daily pushes across the window."
            />
          </div>
          {shifts.length > 0 && <p className="an-canvas-hint">{shifts.join(" ")}</p>}
        </>
      )}

      {!empty && !thin && (
        <div className="an-frame">
          <p className="an-canvas-title">Day-pushes and logged minutes</p>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={STUDIO_GRID} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} tick={{ fill: STUDIO_AXIS }} />
              <YAxis
                yAxisId="min"
                fontSize={11}
                allowDecimals={false}
                stroke={STUDIO_AXIS}
                tick={{ fill: STUDIO_AXIS }}
              />
              <YAxis
                yAxisId="push"
                orientation="right"
                fontSize={11}
                allowDecimals={false}
                stroke={STUDIO_AXIS}
                tick={{ fill: STUDIO_AXIS }}
              />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Line
                yAxisId="min"
                type="monotone"
                dataKey="minutes"
                name="Logged minutes"
                stroke={BEHAVIOR_FILL.c}
                strokeWidth={2}
                dot={false}
              />
              <Line
                yAxisId="push"
                type="monotone"
                dataKey="pushes"
                name="Day-pushes"
                stroke={BEHAVIOR_FILL.b}
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="an-bx-legend">
            <span>
              <i style={{ background: BEHAVIOR_FILL.c }} />
              Logged minutes (left axis)
            </span>
            <span>
              <i style={{ background: BEHAVIOR_FILL.b }} />
              Day-pushes (right axis)
            </span>
          </p>
        </div>
      )}

      {!empty && weeks.length > 1 && (
        <section className="an-plate" data-testid="overcommit-steps">
          <CanvasTitle
            title="Pushed vs done, week by week"
            help="Each step is seven days of the window, oldest left. Orange = day-pushes, green = items completed. A week where orange stands taller is a week you deferred more than you finished."
          />
          <p className="an-canvas-kicker">
            {overWeeks} of {weeks.length} weeks pushed more than they finished.
          </p>
          <div className="an-plot-well an-steps-wrap">
            <div className="an-steps" role="img" aria-label="Weekly pushes and completions">
              {weeks.map((w, i) => (
                <div
                  key={i}
                  className="an-step"
                  title={`Week of ${w.label}: ${w.pushes} pushes · ${w.done} done · ${round1(w.hours)} h logged`}
                >
                  <span className="an-step-bars">
                    <span
                      style={{
                        height: `${(w.pushes / weekMax) * 100}%`,
                        background: BEHAVIOR_FILL.b,
                      }}
                    />
                    <span
                      style={{
                        height: `${(w.done / weekMax) * 100}%`,
                        background: BEHAVIOR_FILL.a,
                      }}
                    />
                  </span>
                  <span className="an-step-label">{w.label}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="an-bx-legend">
            <span>
              <i style={{ background: BEHAVIOR_FILL.b }} />
              Day-pushes
            </span>
            <span>
              <i style={{ background: BEHAVIOR_FILL.a }} />
              Completed
            </span>
          </p>
        </section>
      )}

      <section className="an-plate" data-testid="overcommit-squares">
        <CanvasTitle
          title="What keeps sliding"
          help="Open items sized by lifetime day-pushes (area ∝ pushes). Not limited to the window: daysPushed is a running count on the item. Click a square to read it."
        />
        <div className="an-bx-tools">
          <RangeField
            label="At least"
            value={minPushes}
            min={1}
            max={Math.max(2, pushedMax)}
            onChange={setMinPushes}
            shown={`${minPushes} push${minPushes === 1 ? "" : "es"}`}
          />
          <SearchField value={query} onChange={setQuery} placeholder="Item title…" />
          <span className="an-n">
            n = {pushedItems.length} open item
            {pushedItems.length === 1 ? "" : "s"}
          </span>
        </div>
        {pushedItems.length === 0 ? (
          <p className="an-canvas-hint">No open item has been pushed {minPushes}+ days.</p>
        ) : (
          <>
            <SizedSquares items={shownSquares} unit="day-pushes" onSelect={setPicked} />
            {moreSquares}
            {pickedItem && (
              <p className="an-finding">
                {pickedItem.label}: pushed {pickedItem.value} day
                {pickedItem.value === 1 ? "" : "s"}
                {pickedItem.weeks ? `, ${pickedItem.weeks} week${pickedItem.weeks === 1 ? "" : "s"}` : ""}
                {pickedItem.months ? `, ${pickedItem.months} month${pickedItem.months === 1 ? "" : "s"}` : ""}.
              </p>
            )}
          </>
        )}
      </section>
    </div>
  )
}
