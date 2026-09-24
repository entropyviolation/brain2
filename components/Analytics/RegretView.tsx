/**
 * components/Analytics/RegretView.tsx — Regret accrual ledger
 *
 * Regret is the accrued cost of important items sitting undone past their due
 * date. Shared Analytics range; a thin window is not a finding. KPI cards stay
 * dark when there is nothing to total.
 */
"use client"

import { useEffect, useMemo } from "react"
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
import { useRegretStore, regretCost } from "@/lib/regret-store"
import { parseLocalDate } from "@/lib/date-utils"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { SAMPLE_FLOORS, isThinSample, thinWindowSentence } from "./analytics-range"
import { openItemsInLists } from "./open-in-lists"
import { STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP } from "./studio-kit"

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
                <XAxis dataKey="label" fontSize={10} interval={1} stroke={STUDIO_AXIS} tick={{ fill: STUDIO_AXIS }} />
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
    </div>
  )
}

export default RegretView
