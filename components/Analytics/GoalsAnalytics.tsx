/**
 * components/Analytics/GoalsAnalytics.tsx — Objective contribution + neglected goals
 */
"use client"

import { useMemo } from "react"
import { useGoalsStore } from "@/lib/goals-store"
import { useTaskStore } from "@/lib/task-store"
import { goalProgressPercent, goalsNeedingAttention } from "@/lib/objectives"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import { StudioBars, StudioReadout } from "./studio-kit"

export function GoalsAnalytics() {
  const goals = useGoalsStore((s) => s.goals)
  const objectives = useGoalsStore((s) => s.objectives)
  const tasks = useTaskStore((s) => s.tasks)
  const { keySet, label } = useAnalyticsRange()

  const activeGoals = goals.filter((g) => !g.completed)
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
            <StudioReadout label="Neglected" value={stale.length} note="no action in 14 days" />
          </div>
          {rows.length === 0 ? (
            <ChartFrame empty emptySentence="No open goals to chart." />
          ) : (
            <StudioBars rows={rows} max={100} />
          )}
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
        </>
      )}
    </div>
  )
}
