/**
 * components/Analytics/RegretView.tsx — Regret accrual ledger
 *
 * Regret is the accrued cost of important items sitting undone past their due
 * date. Shared Analytics range; a thin window is not a finding. KPI cards stay
 * dark when there is nothing to total. Docs: docs/analytics/accuracy-regret.md.
 */
"use client"

import { useEffect, useMemo, useState } from "react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts"
import { useTaskStore } from "@/lib/task-store"
import { useRegretStore, regretCost, daysOverdue, dailyRegretIncrement } from "@/lib/regret-store"
import { itemTitle } from "@/lib/item-utils"
import { parseLocalDate } from "@/lib/date-utils"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, isThinSample, thinWindowSentence } from "./analytics-range"
import { openItemsInLists } from "./open-in-lists"
import { STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP, StudioReadout } from "./studio-kit"
import { squareSide } from "./accuracy-stats"
import "./accuracy-views.css"

type OverdueSort = "cost" | "days" | "perDay"

const BLOCKED_REASON_LABELS: Record<string, string> = {
  "no-energy": "No energy",
  "missing-input": "Missing input",
  procrastination: "Procrastination",
  "no-time": "No time",
  "blocked-by-other": "Blocked by other",
  other: "Other",
  unspecified: "Unspecified",
}

export function RegretView() {
  const tasks = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const [aheadDays, setAheadDays] = useState(7)
  const [query, setQuery] = useState("")
  const [sortBy, setSortBy] = useState<OverdueSort>("cost")
  const regretHistory = useRegretStore((s) => s.regretHistory)
  const accrueOverdue = useRegretStore((s) => s.accrueOverdue)
  const getDayRegret = useRegretStore((s) => s.getDayRegret)
  const getTopRegretTasks = useRegretStore((s) => s.getTopRegretTasks)
  const getRegretByReason = useRegretStore((s) => s.getRegretByReason)
  const { dateKeys, keySet, label } = useAnalyticsRange()

  useEffect(() => {
    accrueOverdue(tasks)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const now = new Date()

  const outstanding = useMemo(
    () => tasks.reduce((total, t) => total + regretCost(t, now), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, regretHistory],
  )

  const inWindow = useMemo(
    () => regretHistory.filter((e) => keySet.has(e.date)),
    [regretHistory, keySet],
  )

  const trend = useMemo(
    () =>
      dateKeys.map((key) => {
        const d = parseLocalDate(key) ?? new Date()
        return {
          label: d.toLocaleDateString("en-US", { month: "numeric", day: "numeric" }),
          regret: getDayRegret(d),
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateKeys, regretHistory],
  )

  const daysWithRegret = trend.filter((d) => d.regret > 0).length
  const windowTotal = inWindow.reduce((s, e) => s + e.regret, 0)
  const topTasks = useMemo(() => getTopRegretTasks(8), [regretHistory, getTopRegretTasks])
  const byReason = useMemo(
    () =>
      Object.entries(getRegretByReason())
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1]),
    [regretHistory, getRegretByReason],
  )

  const overdue = useMemo(
    () =>
      tasks
        .map((t) => ({
          id: t.id,
          name: itemTitle(t),
          listId: t.lists?.[0] ?? "",
          days: daysOverdue(t, now),
          perDay: dailyRegretIncrement(t),
          cost: regretCost(t, now),
        }))
        .filter((r) => r.cost > 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, regretHistory],
  )
  const ratePerDay = overdue.reduce((s, r) => s + r.perDay, 0)
  const projected = outstanding + ratePerDay * aheadDays
  const listName = useMemo(() => new Map(lists.map((l) => [l.id, l.name])), [lists])
  const byList = useMemo(() => {
    const groups = new Map<string, number>()
    for (const r of overdue) groups.set(r.listId, (groups.get(r.listId) ?? 0) + r.cost)
    return [...groups.entries()]
      .map(([id, cost]) => ({ id, name: listName.get(id) ?? "Unlisted", cost }))
      .sort((a, b) => b.cost - a.cost)
  }, [overdue, listName])
  const squareMax = byList[0]?.cost ?? 0
  const anchor = overdue.reduce((m, r) => Math.max(m, r.perDay), 0)
  const shownOverdue = useMemo(() => {
    const q = query.trim().toLowerCase()
    return overdue
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort((a, b) => b[sortBy] - a[sortBy])
  }, [overdue, query, sortBy])

  const empty = inWindow.length === 0 && outstanding <= 0
  const thin = !empty && isThinSample(daysWithRegret, SAMPLE_FLOORS.regretDays)

  return (
    <div className="an-canvas an-stack">
      <p className="an-caveat">
        Regret is the accrued cost of important items sitting undone past their due date — the mirror of points.
      </p>

      {empty ? (
        <ChartFrame
          empty
          emptySentence={`No regret in the ${label} — nothing important is overdue. It accumulates each day a scheduled item slips.`}
        />
      ) : thin ? (
        <ChartFrame thin thinSentence={thinWindowSentence(daysWithRegret, SAMPLE_FLOORS.regretDays, label)} />
      ) : (
        <>
          <p className="an-n">
            n = {daysWithRegret} day{daysWithRegret === 1 ? "" : "s"} with accrued regret · {Math.round(windowTotal)} in
            the {label} · {Math.round(outstanding)} still outstanding
          </p>

          <div className="an-frame">
            <p className="an-canvas-title">Regret accrued ({label})</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={trend} margin={{ left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={STUDIO_GRID} />
                <XAxis dataKey="label" fontSize={10} interval="preserveStartEnd" minTickGap={18} stroke={STUDIO_AXIS} tick={{ fill: STUDIO_AXIS }} />
                <YAxis allowDecimals={false} fontSize={11} stroke={STUDIO_AXIS} tick={{ fill: STUDIO_AXIS }} />
                <Tooltip contentStyle={STUDIO_TOOLTIP} formatter={(v: number) => [`${Math.round(v)}`, "Regret"]} />
                <Bar dataKey="regret" fill="#f87171" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="an-split">
            <div>
              <p className="an-canvas-title">Heaviest regrets</p>
              {topTasks.length === 0 ? (
                <p className="an-canvas-kicker">No items have accrued regret yet.</p>
              ) : (
                <>
                  <ul className="an-list">
                    {topTasks.map((t) => (
                      <li key={t.taskId}>
                        <button
                          type="button"
                          onClick={() => openItemsInLists({ taskIds: [t.taskId] })}
                        >
                          <span className="truncate">{t.taskDescription}</span>
                          <span className="an-n">{Math.round(t.regret)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                  <OpenInListsButton taskIds={topTasks.map((t) => t.taskId)} />
                </>
              )}
            </div>

            <div>
              <p className="an-canvas-title">By reason</p>
              {byReason.length === 0 ? (
                <p className="an-canvas-kicker">
                  No structured reasons captured yet. Record why items were blocked during your reviews.
                </p>
              ) : (
                <ul className="an-list">
                  {byReason.map(([reason, value]) => (
                    <li key={reason} className="an-list-row">
                      <span>{BLOCKED_REASON_LABELS[reason] ?? reason}</span>
                      <span className="an-n">{Math.round(value)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {overdue.length > 0 && (
        <>
          <div className="an-acc-plate">
            <p className="an-canvas-title">Regret clock</p>
            <div className="an-readouts">
              <StudioReadout label="Accruing now" value={`${Math.round(ratePerDay)}/day`} note={`${overdue.length} overdue`} />
              <StudioReadout label="Per hour awake" value={(ratePerDay / 16).toFixed(1)} note="÷ 16 waking hours" />
              <StudioReadout label={`In ${aheadDays} days`} value={Math.round(projected)} note="if nothing moves" />
            </div>
            <div className="an-acc-tools">
              <label>
                Look ahead {aheadDays} days
                <input
                  type="range"
                  min={1}
                  max={60}
                  value={aheadDays}
                  aria-label="Days to look ahead"
                  onChange={(e) => setAheadDays(Number(e.target.value))}
                />
              </label>
            </div>
            <p className="an-acc-math">
              Each overdue item costs importance + urgency + reward per day (minimum weight when all are empty).
              Projection = outstanding + daily rate × days. It is a straight line: finishing anything bends it down.
            </p>
          </div>

          {byList.length > 0 && (
            <div className="an-acc-plate">
              <p className="an-canvas-title">Outstanding regret by list</p>
              <div className="an-acc-squares">
                {anchor > 0 && (
                  <div className="an-acc-square-group">
                    <span
                      className="an-acc-square is-anchor"
                      style={{ width: squareSide(anchor, squareMax, 140), height: squareSide(anchor, squareMax, 140) }}
                    />
                    <span>Anchor: one day of the heaviest item ({Math.round(anchor)})</span>
                  </div>
                )}
                {byList.map((g) => {
                  const side = squareSide(g.cost, squareMax, 140)
                  return (
                    <div key={g.id || "none"} className="an-acc-square-group">
                      <span className="an-acc-square" style={{ width: side, height: side }} title={`${Math.round(g.cost)}`} />
                      <span>
                        {g.name} · {Math.round(g.cost)}
                      </span>
                    </div>
                  )
                })}
              </div>
              <p className="an-acc-math">Area ∝ outstanding regret. Compare each square to the outlined anchor.</p>
            </div>
          )}

          {overdue.length > 0 && (
            <div className="an-acc-plate">
              <p className="an-canvas-title">Every overdue item</p>
              <div className="an-acc-tools">
                <input
                  type="search"
                  placeholder="Search"
                  value={query}
                  aria-label="Search overdue items"
                  onChange={(e) => setQuery(e.target.value)}
                />
                <span className="an-n">
                  {shownOverdue.length} of {overdue.length}
                </span>
              </div>
              <details className="an-acc-fold" open={overdue.length <= 12}>
                <summary>Table</summary>
                <table className="an-acc-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      {(
                        [
                          ["days", "Days late"],
                          ["perDay", "Per day"],
                          ["cost", "Cost"],
                        ] as const
                      ).map(([key, text]) => (
                        <th key={key} aria-sort={sortBy === key ? "descending" : "none"}>
                          <button type="button" onClick={() => setSortBy(key)}>
                            {text}
                            {sortBy === key ? " ▾" : ""}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shownOverdue.map((r) => (
                      <tr key={r.id}>
                        <td>
                          <button type="button" onClick={() => openItemsInLists({ taskIds: [r.id] })}>
                            {r.name}
                          </button>
                        </td>
                        <td>{r.days}</td>
                        <td>{Math.round(r.perDay)}</td>
                        <td>{Math.round(r.cost)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            </div>
          )}

        </>
      )}
    </div>
  )
}

export default RegretView
