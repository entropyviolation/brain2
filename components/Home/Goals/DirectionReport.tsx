/**
 * components/Home/Goals/DirectionReport.tsx — "Direction in life" report (Feature 1)
 *
 * Coverage CRT, day tape, drift dates, neglected goals. Math stays in
 * lib/objectives.ts. No yellow chips — mill dates + phosphor readout.
 */
"use client"

import { useMemo } from "react"
import { format } from "date-fns"
import { useGoalsStore } from "@/lib/goals-store"
import { useTaskStore } from "@/lib/task-store"
import { parseLocalDate } from "@/lib/date-utils"
import type { Task } from "@/lib/types"
import { directionReport, type ActionRecord } from "@/lib/objectives"

function taskCompletionDate(task: Task): Date | undefined {
  if (task.completedDate) return new Date(task.completedDate)
  if (task.completionReview?.completedAt) return new Date(task.completionReview.completedAt)
  const chunks = task.completedChunks ?? []
  if (chunks.length) {
    const last = chunks[chunks.length - 1]
    if (last?.date) return new Date(last.date)
  }
  if (task.scheduledDate) return new Date(task.scheduledDate)
  return task.createdAt ? new Date(task.createdAt) : undefined
}

function toActionRecords(tasks: Task[]): ActionRecord[] {
  return tasks.map((t) => {
    const contributed = [
      ...(t.contributesToObjectiveIds ?? []),
      ...(t.contributesToGoalIds ?? []),
    ].map((targetId) => ({ id: `contrib-${t.id}-${targetId}`, relation: "action-of", targetId }))
    return {
      id: t.id,
      completed: !!t.completed,
      completedDate: taskCompletionDate(t),
      links: [...(t.links ?? []), ...contributed],
    }
  })
}

function formatDriftDay(key: string): string {
  const date = parseLocalDate(key)
  return date ? format(date, "MMM d") : key
}

const WINDOW_DAYS = 30
const STALE_DAYS = 14

export function DirectionReport() {
  const goals = useGoalsStore((s) => s.goals)
  const objectives = useGoalsStore((s) => s.objectives)
  const tasks = useTaskStore((s) => s.tasks)

  const report = useMemo(
    () => directionReport(goals, objectives, toActionRecords(tasks), { days: WINDOW_DAYS, staleDays: STALE_DAYS }),
    [goals, objectives, tasks],
  )

  const coveragePips = report.coverageScore === null ? 0 : Math.round(report.coverageScore / 10)

  return (
    <div className="gol-section">
      <div className="gol-section-head">
        <div>
          <h3 className="gol-legend">Direction in Life</h3>
          <p className="gol-hint">
            Did the last {WINDOW_DAYS} days move your goals forward? Recomputed from your task links.
          </p>
        </div>
      </div>

      <div className="gol-dir-console">
        <div className="gol-dir-readout">
          <div className="gol-dir-crt" aria-label="Coverage">
            {report.coverageScore === null ? "—" : `${report.coverageScore}%`}
          </div>
          <div className="gol-dir-copy">
            <strong>
              {report.directedDays}/{report.activeDays} active days served a goal
            </strong>
            <div className="gol-pips gol-dir-pips" aria-hidden>
              {Array.from({ length: 10 }, (_, i) => (
                <span key={i} className={`gol-pip${i < coveragePips ? " is-on" : ""}`} />
              ))}
            </div>
          </div>
        </div>

        <div className="gol-dir-tape" role="img" aria-label="Last 30 days: served, drift, or idle">
          {report.days.map((d) => {
            const kind = d.servedCount > 0 ? " is-served" : d.completedCount > 0 ? " is-drift" : ""
            return (
              <div
                key={d.key}
                title={`${d.key}: ${d.servedCount}/${d.completedCount} served`}
                className={`gol-day${kind}`}
              />
            )
          })}
        </div>
        <div className="gol-dir-key">
          <span>
            <i className="is-served" />
            served
          </span>
          <span>
            <i className="is-drift" />
            drift
          </span>
          <span>
            <i />
            idle
          </span>
        </div>
      </div>

      <div className="gol-dir-split">
        <div className="gol-dir-well">
          <h4 className="gol-legend">
            Drift days <span className="gol-cap">({report.driftDays.length})</span>
          </h4>
          {report.driftDays.length === 0 ? (
            <p className="gol-hint">No drift days — all your work served a goal.</p>
          ) : (
            <div className="gol-dir-dates">
              {report.driftDays.map((key) => (
                <span key={key} className="gol-dir-date" title={key}>
                  {formatDriftDay(key)}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="gol-dir-well">
          <h4 className="gol-legend">
            Neglected goals <span className="gol-cap">({report.staleGoals.length})</span>
          </h4>
          {report.staleGoals.length === 0 ? (
            <p className="gol-hint">Every active goal has a recent linked action.</p>
          ) : (
            <ul className="gol-dir-list m-0 p-0 list-none">
              {report.staleGoals.map(({ goal, daysSinceLastAction, hasAnyAction }) => (
                <li key={goal.id} className="gol-row">
                  <span className="gol-row-name">{goal.title}</span>
                  <span className="gol-meta">{hasAnyAction ? `${daysSinceLastAction}d ago` : "never"}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
