/**
 * components/Analytics/GoalsAnalytics.tsx — Objective contribution + neglected goals
 *
 * Docs: docs/analytics/accuracy-goals.md.
 */
"use client"

import { useMemo, useState } from "react"
import { useGoalsStore } from "@/lib/goals-store"
import { useTaskStore } from "@/lib/task-store"
import { goalProgressPercent, goalsNeedingAttention } from "@/lib/objectives"
import { itemTitle } from "@/lib/item-utils"
import { summarizeCompletionReviews } from "@/lib/completion-review"
import { GoalTexturePlate } from "./CompletionReviewPlates"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import { StudioBars, StudioReadout } from "./studio-kit"
import { openItemsInLists } from "./open-in-lists"
import { goalPace } from "./accuracy-stats"
import "./accuracy-views.css"

type PaceSort = "gap" | "progress" | "daysLeft"

export function GoalsAnalytics() {
  const goals = useGoalsStore((s) => s.goals)
  const objectives = useGoalsStore((s) => s.objectives)
  const tasks = useTaskStore((s) => s.tasks)
  const { keySet, label } = useAnalyticsRange()

  const activeGoals = goals.filter((g) => !g.completed)
  const seasonGoals = goals.filter((g) => g.periodKind === "quarter")
  const atTarget = goals.filter((g) => g.target > 0 && g.current >= g.target)
  const stale = useMemo(
    () =>
      goalsNeedingAttention(
        goals,
        tasks.map((t) => ({
          id: t.id,
          completed: t.completed,
          completedDate: t.completedDate,
          links: t.links,
        })),
      ),
    [goals, tasks],
  )

  const served = useMemo(
    () =>
      tasks.filter(
        (t) =>
          inRange(t.completedDate ?? t.createdAt, keySet) &&
          ((t.contributesToGoalIds?.length ?? 0) > 0 || (t.contributesToObjectiveIds?.length ?? 0) > 0),
      ),
    [tasks, keySet],
  )

  const rows = useMemo(
    () =>
      activeGoals
        .map((g) => ({ name: g.title, value: Math.round(goalProgressPercent(g)) }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 12),
    [activeGoals],
  )

  const reviewSummary = useMemo(
    () =>
      summarizeCompletionReviews({
        tasks,
        goals: goals.map((goal) => ({ id: goal.id, title: goal.title })),
        objectives: objectives.map((objective) => ({ id: objective.id, title: objective.title })),
        inWindow: (date) => inRange(date, keySet),
        titleOf: (row) => itemTitle(row),
      }),
    [tasks, goals, objectives, keySet],
  )

  const [paceSort, setPaceSort] = useState<PaceSort>("gap")
  const [paceKind, setPaceKind] = useState<string>("all")
  const staleIds = useMemo(() => new Set(stale.map((s) => s.goal.id)), [stale])
  const paceRows = useMemo(() => {
    const now = new Date()
    return activeGoals
      .filter((g) => paceKind === "all" || g.periodKind === paceKind)
      .map((g) => ({ goal: g, pace: goalPace(g, now) }))
      .sort((a, b) => {
        if (paceSort === "progress") return b.pace.progress - a.pace.progress
        if (paceSort === "daysLeft") return (a.pace.daysLeft ?? Infinity) - (b.pace.daysLeft ?? Infinity)
        return (a.pace.gap ?? Infinity) - (b.pace.gap ?? Infinity)
      })
  }, [activeGoals, paceKind, paceSort])
  const kinds = useMemo(() => [...new Set(activeGoals.map((g) => g.periodKind))], [activeGoals])
  const bubbles = useMemo(
    () =>
      activeGoals
        .map((g) => {
          const ids = served.filter((t) => t.contributesToGoalIds?.includes(g.id)).map((t) => t.id)
          return { goal: g, ids }
        })
        .sort((a, b) => b.ids.length - a.ids.length),
    [activeGoals, served],
  )
  const bubbleMax = Math.max(1, ...bubbles.map((b) => b.ids.length))

  const empty = goals.length === 0 && objectives.length === 0

  return (
    <div className="an-canvas an-stack" data-testid="goals-analytics">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Goals</p>
          <p className="an-canvas-kicker">
            {label} · {objectives.length} objectives · {served.length} contributing completions
          </p>
        </div>
      </header>
      {empty ? (
        <ChartFrame empty emptySentence="No goals or objectives yet." />
      ) : (
        <>
          <div className="an-readouts">
            <StudioReadout label="At target" value={`${atTarget.length}/${goals.length}`} />
            <StudioReadout label="Season goals" value={seasonGoals.length} note="period Season" />
            <StudioReadout label="Neglected" value={stale.length} note="no action in 14 days" />
          </div>
          <p className="an-canvas-title">Progress toward target</p>
          {rows.length === 0 ? (
            <ChartFrame empty emptySentence="No open goals to chart." />
          ) : (
            <StudioBars rows={rows} max={100} />
          )}
          {paceRows.length > 0 && (
            <div className="an-acc-plate">
              <p className="an-canvas-title">On pace?</p>
              <div className="an-acc-tools">
                <label>
                  Period
                  <select className="an-chip" value={paceKind} aria-label="Goal period" onChange={(e) => setPaceKind(e.target.value)}>
                    <option value="all">All</option>
                    {kinds.map((k) => (
                      <option key={k} value={k}>
                        {k === "quarter" ? "season" : k}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Sort
                  <select
                    className="an-chip"
                    value={paceSort}
                    aria-label="Sort goals"
                    onChange={(e) => setPaceSort(e.target.value as PaceSort)}
                  >
                    <option value="gap">Most behind first</option>
                    <option value="progress">Most progress first</option>
                    <option value="daysLeft">Ending soonest</option>
                  </select>
                </label>
              </div>
              <table className="an-acc-table">
                <thead>
                  <tr>
                    <th>Goal</th>
                    <th>Progress vs pace line</th>
                    <th>Gap</th>
                    <th>Days left</th>
                    <th>Needed / day</th>
                  </tr>
                </thead>
                <tbody>
                  {paceRows.map(({ goal, pace }) => (
                    <tr key={goal.id}>
                      <td title={goal.title}>{goal.title}</td>
                      <td>
                        <div className="an-acc-pace" title={`${Math.round(pace.progress * 100)}% done`}>
                          <span style={{ width: `${pace.progress * 100}%` }} />
                          {pace.elapsed !== null && <i style={{ left: `calc(${pace.elapsed * 100}% - 1px)` }} />}
                        </div>
                      </td>
                      <td>{pace.gap === null ? "—" : `${pace.gap >= 0 ? "+" : ""}${Math.round(pace.gap * 100)} pt`}</td>
                      <td>{pace.daysLeft ?? "—"}</td>
                      <td>
                        {pace.neededPerDay === null
                          ? "—"
                          : `${pace.neededPerDay < 10 ? pace.neededPerDay.toFixed(1) : Math.round(pace.neededPerDay)}${goal.unit ? ` ${goal.unit}` : ""}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="an-acc-math">
                The orange tick is where a straight line from start (or creation) to deadline says you should be. Gap =
                progress − time elapsed, in percentage points. Needed / day = (target − current) ÷ days left. Goals
                with no end date show —.
              </p>
            </div>
          )}
          {bubbles.length > 0 && (
            <div className="an-acc-plate">
              <p className="an-canvas-title">Where the work went ({label})</p>
              <div className="an-acc-bubbles" role="list">
                {bubbles.map(({ goal, ids }) => {
                  const d = 56 + Math.sqrt(ids.length / bubbleMax) * 72
                  return (
                    <button
                      key={goal.id}
                      type="button"
                      role="listitem"
                      className="an-acc-bubble"
                      style={{
                        width: d,
                        height: d,
                        background: ids.length ? "#173a7a" : staleIds.has(goal.id) ? "#c2571a" : "#8b939d",
                      }}
                      title={`${goal.title}: ${ids.length} contributing completion(s)`}
                      onClick={() => ids.length && openItemsInLists({ taskIds: ids })}
                    >
                      {goal.title.length > 22 ? `${goal.title.slice(0, 20)}…` : goal.title}
                      <br />
                      {ids.length}
                    </button>
                  )
                })}
              </div>
              <div className="an-acc-key">
                <span><i style={{ background: "#173a7a" }} />Has linked work</span>
                <span><i style={{ background: "#c2571a" }} />Nothing in window, neglected 14+ days</span>
                <span><i style={{ background: "#8b939d" }} />Nothing in window</span>
                <span>Area ∝ contributing completions</span>
              </div>
            </div>
          )}
          {stale.length > 0 && <p className="an-canvas-title">Neglected goals (days since last linked action)</p>}
          {stale.length > 0 && (
            <ul className="an-list">
              {stale.slice(0, 8).map((s) => (
                <li key={s.goal.id} className="an-list-row">
                  <span className="truncate">{s.goal.title}</span>
                  <span className="an-n">
                    {s.daysSinceLastAction === null ? "never" : `${s.daysSinceLastAction}d`}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <OpenInListsButton taskIds={served.map((t) => t.id)} />
          <GoalTexturePlate summary={reviewSummary} />
        </>
      )}
    </div>
  )
}
