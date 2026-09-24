/**
 * components/Analytics/ReflectionView.tsx — Completion-review trajectories
 */
"use client"

import { useMemo, useState } from "react"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { useTaskStore } from "@/lib/task-store"
import type { Task } from "@/lib/types"
import { itemTitle } from "@/lib/item-utils"
import { parseLocalDate } from "@/lib/date-utils"
import { PostMortemDialog } from "@/components/Reviews/PostMortemDialog"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import { STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP } from "./studio-kit"

export function ReflectionView() {
  const allTasks = useTaskStore((s) => s.tasks)
  const range = useAnalyticsRange()
  const [reflectTask, setReflectTask] = useState<Task | null>(null)

  const reflectedTasks = useMemo(
    () => allTasks.filter((t) => t.completionReview && inRange(t.completionReview.completedAt, range.keySet)),
    [allTasks, range.keySet],
  )
  const reflectableTasks = useMemo(
    () =>
      allTasks
        .filter((t) => t.completed && !t.completionReview)
        .sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime())
        .slice(0, 20),
    [allTasks],
  )
  const postMortemSummary = useMemo(() => {
    if (reflectedTasks.length === 0) return null
    const avg = (pick: (r: NonNullable<Task["completionReview"]>) => number) =>
      reflectedTasks.reduce((s, t) => s + pick(t.completionReview!), 0) / reflectedTasks.length
    return {
      count: reflectedTasks.length,
      satisfaction: avg((r) => r.satisfaction),
      resistance: avg((r) => r.resistance),
      focus: avg((r) => r.focus),
      distraction: avg((r) => r.distraction),
    }
  }, [reflectedTasks])

  const trajectory = useMemo(
    () =>
      reflectedTasks
        .slice()
        .sort(
          (a, b) =>
            new Date(a.completionReview!.completedAt).getTime() - new Date(b.completionReview!.completedAt).getTime(),
        )
        .map((t) => {
          const r = t.completionReview!
          const d = parseLocalDate(r.completedAt) ?? new Date(r.completedAt)
          return {
            label: d.toLocaleDateString(undefined, { month: "numeric", day: "numeric" }),
            satisfaction: r.satisfaction,
            resistance: r.resistance,
            focus: r.focus,
            distraction: r.distraction,
          }
        }),
    [reflectedTasks],
  )

  return (
    <div className="an-canvas an-stack">
      {postMortemSummary ? (
        <p className="an-finding">
          {postMortemSummary.count} reflection{postMortemSummary.count === 1 ? "" : "s"} in the {range.label}:
          satisfaction {postMortemSummary.satisfaction.toFixed(1)}, resistance {postMortemSummary.resistance.toFixed(1)},
          focus {postMortemSummary.focus.toFixed(1)}, distraction {postMortemSummary.distraction.toFixed(1)} (1–10).
        </p>
      ) : (
        <ChartFrame empty emptySentence={`No reflections in the ${range.label}.`} />
      )}

      {trajectory.length >= 2 && (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={trajectory}>
            <CartesianGrid stroke={STUDIO_GRID} vertical={false} />
            <XAxis dataKey="label" fontSize={11} stroke={STUDIO_AXIS} />
            <YAxis domain={[1, 10]} fontSize={11} stroke={STUDIO_AXIS} />
            <Tooltip contentStyle={STUDIO_TOOLTIP} />
            <Line type="monotone" dataKey="satisfaction" stroke="#34d399" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="focus" stroke="#60a5fa" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="resistance" stroke="#f87171" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="distraction" stroke="#fbbf24" dot={false} strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      )}

      <div>
        <p className="an-canvas-title">Reflect on completed tasks</p>
        {reflectableTasks.length === 0 ? (
          <p className="an-canvas-kicker">
            {reflectedTasks.length > 0
              ? "All completed tasks have been reflected on."
              : "Complete tasks to capture a post-mortem reflection."}
          </p>
        ) : (
          <ul className="an-list">
            {reflectableTasks.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setReflectTask(t)}>
                  <span className="truncate">{itemTitle(t)}</span>
                  <span>Reflect</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {reflectedTasks.length > 0 && (
        <div>
          <p className="an-canvas-title">Prompt history ({reflectedTasks.length})</p>
          <ul className="an-list">
            {reflectedTasks
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.completionReview!.completedAt).getTime() -
                  new Date(a.completionReview!.completedAt).getTime(),
              )
              .map((t) => {
                const r = t.completionReview!
                return (
                  <li key={t.id}>
                    <button type="button" onClick={() => setReflectTask(t)}>
                      <span>
                        <span className="block truncate">{itemTitle(t)}</span>
                        <span className="an-n">
                          sat {r.satisfaction} · resist {r.resistance} · focus {r.focus} · distract {r.distraction}
                        </span>
                      </span>
                      <span className="an-n">{new Date(r.completedAt).toLocaleDateString()}</span>
                    </button>
                  </li>
                )
              })}
          </ul>
          <OpenInListsButton taskIds={reflectedTasks.map((t) => t.id)} />
        </div>
      )}

      <PostMortemDialog task={reflectTask} open={!!reflectTask} onClose={() => setReflectTask(null)} />
    </div>
  )
}
