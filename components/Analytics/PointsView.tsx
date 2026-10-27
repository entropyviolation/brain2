/**
 * components/Analytics/PointsView.tsx — Daily / cumulative points + source split
 *
 * The last plate is the **Points ledger** (`#analytics-points-ledger`): every
 * award in the range, or the whole ledger, newest first, with a search. A row
 * opens its breakdown (`components/Home/award-detail.tsx`). Home → Latest
 * award jumps here through `lib/points-ledger-nav.ts`, with its open row
 * expanded.
 */
"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine } from "recharts"
import { usePointsStore } from "@/lib/points-store"
import { parseLocalDate } from "@/lib/date-utils"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { openItemsInLists } from "./open-in-lists"
import { STUDIO_AXIS, STUDIO_EMPTY, STUDIO_GRID, STUDIO_TOOLTIP, StudioBars, StudioHelp, StudioReadout } from "./studio-kit"
import { quantile } from "./behavior-stats"
import "./behavior-views.css"
import { AwardDetail } from "@/components/Home/award-detail"
import { awardReason, formatAwardPoints } from "@/lib/habit-points"
import { AWARD_KIND_LABEL, awardKindOf } from "@/lib/points-award-explain"
import { POINTS_LEDGER_ANCHOR, openItemDetailPage, takeLedgerFocus } from "@/lib/points-ledger-nav"
import { COGS_NAV_RESTORE_EVENT } from "@/lib/screen-location"
import { useHabitsStore } from "@/lib/habits-store"
import { useGoalsStore } from "@/lib/goals-store"

const LEDGER_PAGE = 100
const SOURCE_FILL = { habit: "#34d399", bonus: "#fbbf24", task: "#60a5fa" } as const
const SOURCE_NAME = { habit: "Habits", bonus: "Bonuses", task: "Tasks" } as const
/** Waking hours a day for the per-hour rate. An estimate, labelled so. */
const WAKING_HOURS = 16
const round2 = (n: number) => Math.round(n * 100) / 100

function PointsLedger() {
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const habits = useHabitsStore((s) => s.tasks)
  const goals = useGoalsStore((s) => s.goals)
  const range = useAnalyticsRange()
  const [scope, setScope] = useState<"range" | "all">("range")
  const [query, setQuery] = useState("")
  const [limit, setLimit] = useState(LEDGER_PAGE)
  const [expanded, setExpanded] = useState<number | null>(null)
  const focusRef = useRef<{ date: string; taskId: string } | null>(null)

  // Read the focus on mount, and again on each nav restore: Analytics stays
  // mounted (hidden) once opened, so a later jump from Home lands here.
  // The focus is read once (`takeLedgerFocus` clears it), so re-running on new
  // history or range does nothing until Home writes another.
  useEffect(() => {
    const consume = () => {
      const focus = takeLedgerFocus()
      if (!focus) return
      focusRef.current = focus
      // A search or a short page could hide the row, so show the whole ledger.
      setQuery("")
      setLimit(Math.max(LEDGER_PAGE, pointsHistory.length))
      if (!range.keySet.has(focus.date)) setScope("all")
      // The newest matching row is the one Home showed.
      for (let i = pointsHistory.length - 1; i >= 0; i -= 1) {
        const e = pointsHistory[i]!
        if (e.date === focus.date && e.taskId === focus.taskId) {
          setExpanded(i)
          break
        }
      }
    }
    consume()
    window.addEventListener(COGS_NAV_RESTORE_EVENT, consume)
    return () => window.removeEventListener(COGS_NAV_RESTORE_EVENT, consume)
  }, [pointsHistory, range.keySet])

  useEffect(() => {
    if (expanded === null || !focusRef.current) return
    focusRef.current = null
    const t = window.setTimeout(() => {
      document.getElementById(`points-ledger-row-${expanded}`)?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 120)
    return () => window.clearTimeout(t)
  }, [expanded])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return pointsHistory
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => scope === "all" || range.keySet.has(entry.date))
      .filter(({ entry }) => {
        if (!q) return true
        const kind = AWARD_KIND_LABEL[awardKindOf(entry, { habits, goals })]
        return `${entry.taskDescription} ${kind} ${entry.date}`.toLowerCase().includes(q)
      })
      .sort((a, b) => (a.entry.date < b.entry.date ? 1 : a.entry.date > b.entry.date ? -1 : b.index - a.index))
  }, [pointsHistory, scope, range.keySet, query, habits, goals])
  const total = rows.reduce((sum, r) => sum + r.entry.points, 0)

  return (
    <div id={POINTS_LEDGER_ANCHOR} data-testid="points-ledger">
      <p className="an-canvas-title">Points ledger</p>
      <div className="an-ledger-tools">
        <div role="group" aria-label="Ledger window">
          <button
            type="button"
            className="an-range-chip"
            aria-pressed={scope === "range"}
            title="Only awards inside the shared Analytics range"
            onClick={() => setScope("range")}
          >
            {range.label}
          </button>
          <button
            type="button"
            className="an-range-chip"
            aria-pressed={scope === "all"}
            title="Every award ever recorded"
            onClick={() => setScope("all")}
          >
            Whole ledger
          </button>
        </div>
        <input
          type="search"
          className="an-ledger-search"
          placeholder="Search awards"
          aria-label="Search awards"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setLimit(LEDGER_PAGE)
          }}
        />
        <span className="an-n">
          n={rows.length} · {Math.round(total * 100) / 100} pts
        </span>
      </div>
      {rows.length === 0 ? (
        <ChartFrame empty emptySentence="No awards match." />
      ) : (
        <ul className="an-list an-ledger">
          {rows.slice(0, limit).map(({ entry, index }) => {
            const isOpen = expanded === index
            const kind = AWARD_KIND_LABEL[awardKindOf(entry, { habits, goals })]
            return (
              <li key={index} id={`points-ledger-row-${index}`}>
                <button
                  type="button"
                  aria-expanded={isOpen}
                  title="Show multipliers, rules, and the item"
                  onClick={() => setExpanded(isOpen ? null : index)}
                >
                  <span className="an-ledger-date">{entry.date}</span>
                  <span className="an-ledger-kind">{kind}</span>
                  <span className="truncate">{awardReason(entry)}</span>
                  <span className="an-n">
                    {entry.points < 0 ? `−${Math.abs(entry.points)}` : formatAwardPoints(entry.points)}
                  </span>
                </button>
                {isOpen ? <AwardDetail entry={entry} onOpenItem={openItemDetailPage} /> : null}
              </li>
            )
          })}
        </ul>
      )}
      {rows.length > limit ? (
        <button type="button" className="an-range-chip" onClick={() => setLimit((n) => n + LEDGER_PAGE)}>
          Show {Math.min(LEDGER_PAGE, rows.length - limit)} more
        </button>
      ) : null}
    </div>
  )
}

function sourceOf(taskId: string): "habit" | "bonus" | "task" {
  if (taskId.startsWith("habit-grade-bonus:") || taskId.startsWith("habit-raw-day-bonus:")) return "bonus"
  if (taskId.startsWith("habit-day:")) return "habit"
  return "task"
}

export function PointsView() {
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const range = useAnalyticsRange()

  const pointsByDay = useMemo(() => {
    let cum = 0
    return range.dateKeys.map((key) => {
      const d = parseLocalDate(key) ?? new Date()
      const day = pointsHistory.filter((e) => e.date === key)
      const points = day.reduce((s, e) => s + e.points, 0)
      const habit = day.filter((e) => sourceOf(e.taskId) === "habit").reduce((s, e) => s + e.points, 0)
      const bonus = day.filter((e) => sourceOf(e.taskId) === "bonus").reduce((s, e) => s + e.points, 0)
      const task = day.filter((e) => sourceOf(e.taskId) === "task").reduce((s, e) => s + e.points, 0)
      cum += points
      return {
        date: key,
        label: d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
        points,
        cumulative: cum,
        habit,
        bonus,
        task,
      }
    })
  }, [pointsHistory, range.dateKeys])
  const pointsInWindow = pointsByDay.some((d) => d.points !== 0)

  const topTasks = useMemo(() => {
    const byTask: Record<string, { id: string; name: string; points: number }> = {}
    pointsHistory
      .filter((e) => range.keySet.has(e.date))
      .forEach((e) => {
        byTask[e.taskId] = byTask[e.taskId] || { id: e.taskId, name: e.taskDescription, points: 0 }
        byTask[e.taskId].points += e.points
      })
    return Object.values(byTask)
      .sort((a, b) => b.points - a.points)
      .slice(0, 8)
  }, [pointsHistory, range.keySet])

  const split = useMemo(() => {
    let habit = 0
    let bonus = 0
    let task = 0
    for (const e of pointsHistory) {
      if (!range.keySet.has(e.date)) continue
      const src = sourceOf(e.taskId)
      if (src === "habit") habit += e.points
      else if (src === "bonus") bonus += e.points
      else task += e.points
    }
    return [
      { name: "Habits", value: habit },
      { name: "Bonuses", value: bonus },
      { name: "Tasks", value: task },
    ]
  }, [pointsHistory, range.keySet])
  const splitMax = Math.max(...split.map((s) => s.value), 1)

  const dayTotals = pointsByDay.map((d) => d.points)
  const activeDays = dayTotals.filter((v) => v > 0)
  const windowTotal = dayTotals.reduce((a, b) => a + b, 0)
  const perDay = dayTotals.length ? windowTotal / dayTotals.length : 0
  const typicalDay = quantile(activeDays, 0.5) ?? 0
  const [dayTarget, setDayTarget] = useState<number | null>(null)
  const targetMax = Math.max(10, Math.ceil(Math.max(0, ...dayTotals)))
  const target = Math.min(dayTarget ?? Math.round(typicalDay), targetMax)
  const daysAtTarget = dayTotals.filter((v) => v >= target && v > 0).length

  // Sized squares: positive awards by item, grouped by source, plus a typical-day anchor.
  const squares = useMemo(() => {
    const byItem: Record<string, { id: string; name: string; src: "habit" | "bonus" | "task"; points: number }> = {}
    for (const e of pointsHistory) {
      if (!range.keySet.has(e.date) || e.points <= 0) continue
      const src = sourceOf(e.taskId)
      const id = src === "task" ? e.taskId : `${src}:${e.taskDescription}`
      byItem[id] = byItem[id] || { id, name: e.taskDescription, src, points: 0 }
      byItem[id].points += e.points
    }
    const order = { habit: 0, bonus: 1, task: 2 }
    return Object.values(byItem)
      .sort((a, b) => order[a.src] - order[b.src] || b.points - a.points)
      .slice(0, 40)
  }, [pointsHistory, range.keySet])
  const squaresTotal = squares.reduce((t, q) => t + q.points, 0) || 1
  const negatives = useMemo(
    () => pointsHistory.filter((e) => range.keySet.has(e.date) && e.points < 0).reduce((s, e) => s + e.points, 0),
    [pointsHistory, range.keySet],
  )

  return (
    <div className="an-canvas an-stack">
      <div>
        <p className="an-canvas-title">Points ({range.label})</p>
        {!pointsInWindow ? (
          <ChartFrame empty emptySentence={`No points in the ${range.label}.`} />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={pointsByDay}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
              <YAxis fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="habit" name="Habits" stackId="p" fill={SOURCE_FILL.habit} />
              <Bar dataKey="bonus" name="Bonuses" stackId="p" fill={SOURCE_FILL.bonus} />
              <Bar dataKey="task" name="Tasks" stackId="p" fill={SOURCE_FILL.task} />
              {target > 0 ? <ReferenceLine y={target} stroke={STUDIO_AXIS} strokeDasharray="4 3" /> : null}
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
      {pointsInWindow && (
        <div data-testid="points-rate">
          <div className="an-bv-tools">
            <label className="an-bv-slider" title="Draws a dashed line on the daily chart">
              Day target
              <input type="range" min={0} max={targetMax} value={target} onChange={(e) => setDayTarget(Number(e.target.value))} />
              <output>{target} pts</output>
            </label>
            <span className="an-n">
              {daysAtTarget} of {dayTotals.length} days reach it ({dayTotals.length ? Math.round((daysAtTarget / dayTotals.length) * 100) : 0}%)
            </span>
          </div>
          <div className="an-readouts">
            <StudioReadout label="Per day" value={round2(perDay)} note={`${range.label} mean`} />
            <StudioReadout label="Per scoring day" value={round2(activeDays.length ? windowTotal / activeDays.length : 0)} note={`${activeDays.length} days with points`} />
            <StudioReadout label="Per week" value={round2(perDay * 7)} note="mean × 7" />
            <StudioReadout label="Per waking hour" value={`~${round2(perDay / WAKING_HOURS)}`} note={`est. ${WAKING_HOURS} h awake`} />
          </div>
        </div>
      )}
      <div>
        <p className="an-canvas-title">Cumulative points</p>
        {!pointsInWindow ? (
          <ChartFrame empty emptySentence={`No points in the ${range.label} to accumulate.`} />
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={pointsByDay}>
              <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
              <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
              <YAxis fontSize={11} stroke={STUDIO_AXIS} />
              <Tooltip contentStyle={STUDIO_TOOLTIP} />
              <Line type="monotone" dataKey="cumulative" stroke="#fbbf24" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
      {pointsInWindow && (
        <div>
          <p className="an-canvas-title">Source split</p>
          <StudioBars rows={split} max={splitMax} unit=" pts" />
        </div>
      )}
      {squares.length > 0 && (
        <div data-testid="points-squares">
          <p className="an-canvas-title an-canvas-title-row">
            Sized squares
            <StudioHelp text="Area is points (slice-and-dice treemap). Column width is a source, tile height is an item, top 40 items. The dashed square is a typical day (median of days with points) at the same scale. Task tiles open the item. Negative awards are left out and totalled below." />
          </p>
          <div className="an-sq" role="img" aria-label="Points by source and item, area is points">
            {(["habit", "bonus", "task"] as const).map((src) => {
              const items = squares.filter((q) => q.src === src)
              const sum = items.reduce((t, q) => t + q.points, 0)
              if (sum <= 0) return null
              return (
                <div key={src} className="an-sq-group" style={{ width: `${(sum / squaresTotal) * 100}%` }} title={`${SOURCE_NAME[src]}: ${round2(sum)} pts`}>
                  {items.map((q) => (
                    <button
                      key={q.id}
                      type="button"
                      className="an-sq-cell"
                      style={{ height: `${(q.points / sum) * 100}%`, background: SOURCE_FILL[src] }}
                      title={`${q.name}: ${round2(q.points)} pts · ${Math.round((q.points / squaresTotal) * 100)}% of shown`}
                      disabled={src !== "task"}
                      onClick={() => openItemsInLists({ taskIds: [q.id] })}
                    >
                      <span>{q.name}</span> <b>{round2(q.points)}</b>
                    </button>
                  ))}
                </div>
              )
            })}
            {typicalDay > 0 && typicalDay < squaresTotal ? (
              <span
                className="an-sq-anchor"
                style={{ width: `${Math.sqrt(typicalDay / squaresTotal / 3) * 100}%` }}
                title={`A typical day: ${round2(typicalDay)} pts (median of days with points), drawn to the same scale`}
              >
                typical day
              </span>
            ) : null}
          </div>
          <div className="an-bv-key">
            {(["habit", "bonus", "task"] as const).map((k) => (
              <span key={k}>
                <i style={{ background: SOURCE_FILL[k] }} />
                {SOURCE_NAME[k]}
              </span>
            ))}
            <span>
              <i style={{ background: STUDIO_EMPTY }} />
              typical day
            </span>
            {negatives < 0 ? <span>deductions {round2(negatives)} pts</span> : null}
          </div>
        </div>
      )}
      <div>
        <p className="an-canvas-title">Top point earners</p>
        {topTasks.length === 0 ? (
          <ChartFrame empty emptySentence="Complete tasks to earn points." />
        ) : (
          <>
            <ul className="an-list">
              {topTasks.map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => openItemsInLists({ taskIds: [t.id] })}>
                    <span className="truncate">{t.name}</span>
                    <span className="an-n">{round2(t.points)} pts</span>
                  </button>
                </li>
              ))}
            </ul>
            <OpenInListsButton taskIds={topTasks.map((t) => t.id)} />
          </>
        )}
      </div>
      <PointsLedger />
    </div>
  )
}
