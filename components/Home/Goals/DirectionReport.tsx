/**
 * components/Home/Goals/DirectionReport.tsx — "Direction in life" report (Feature 1)
 *
 * Recomputes, on read, how well recent action served the user's goals/objectives:
 *  • a coverage score (share of active days that served a goal/objective)
 *  • "drift" days where work happened but served no goal
 *  • goals with no recent linked action (neglected goals)
 *
 * All math is the pure lib/objectives.ts helpers; this component only maps live
 * tasks → ActionRecord (deriving each task's completion date + serving links).
 * It never touches the completeTask path.
 */
"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Compass, AlertTriangle, CalendarOff } from "lucide-react"
import { useGoalsStore } from "@/lib/goals-store"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { directionReport, type ActionRecord } from "@/lib/objectives"

/** Best-effort completion timestamp for a task. */
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
    // Synthesize serving links from the contribution fields (and keep any
    // explicit typed links) so the pure coverage helpers see what each action served.
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

  const scoreColor =
    report.coverageScore === null
      ? "text-muted-foreground"
      : report.coverageScore >= 70
        ? "text-green-600"
        : report.coverageScore >= 40
          ? "text-amber-600"
          : "text-red-600"

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Compass className="h-5 w-5" /> Direction in Life
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Did the last {WINDOW_DAYS} days move your goals forward? Recomputed from your task links.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-baseline gap-3">
          <span className={`text-3xl font-bold ${scoreColor}`}>
            {report.coverageScore === null ? "—" : `${report.coverageScore}%`}
          </span>
          <span className="text-sm text-muted-foreground">
            of active days served a goal ({report.directedDays}/{report.activeDays} days)
          </span>
        </div>

        {/* Per-day strip: green = served a goal, amber = worked but drifted, gray = idle. */}
        <div className="flex flex-wrap gap-1">
          {report.days.map((d) => {
            const cls =
              d.servedCount > 0
                ? "bg-green-500"
                : d.completedCount > 0
                  ? "bg-amber-400"
                  : "bg-muted"
            return <div key={d.key} title={`${d.key}: ${d.servedCount}/${d.completedCount} served`} className={`h-4 w-3 rounded-sm ${cls}`} />
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <CalendarOff className="h-4 w-4" /> Drift days
              <Badge variant="outline">{report.driftDays.length}</Badge>
            </h4>
            {report.driftDays.length === 0 ? (
              <p className="text-xs text-muted-foreground">No drift days — all your work served a goal.</p>
            ) : (
              <div className="flex flex-wrap gap-1">
                {report.driftDays.map((key) => (
                  <Badge key={key} className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{key}</Badge>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
              <AlertTriangle className="h-4 w-4" /> Neglected goals
              <Badge variant="outline">{report.staleGoals.length}</Badge>
            </h4>
            {report.staleGoals.length === 0 ? (
              <p className="text-xs text-muted-foreground">Every active goal has a recent linked action.</p>
            ) : (
              <ul className="space-y-1">
                {report.staleGoals.map(({ goal, daysSinceLastAction, hasAnyAction }) => (
                  <li key={goal.id} className="text-xs flex justify-between gap-2">
                    <span className="truncate">{goal.title}</span>
                    <span className="text-muted-foreground shrink-0">
                      {hasAnyAction ? `${daysSinceLastAction}d ago` : "never"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
