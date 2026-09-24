/**
 * components/Analytics/PointsView.tsx — Daily / cumulative points + source split
 */
"use client"

import { useMemo } from "react"
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts"
import { usePointsStore } from "@/lib/points-store"
import { parseLocalDate } from "@/lib/date-utils"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { openItemsInLists } from "./open-in-lists"
import { STUDIO_AXIS, STUDIO_GRID, STUDIO_TOOLTIP, StudioBars } from "./studio-kit"

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
              <Bar dataKey="habit" stackId="p" fill="#34d399" />
              <Bar dataKey="bonus" stackId="p" fill="#fbbf24" />
              <Bar dataKey="task" stackId="p" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
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
                    <span className="an-n">{t.points} pts</span>
                  </button>
                </li>
              ))}
            </ul>
            <OpenInListsButton taskIds={topTasks.map((t) => t.id)} />
          </>
        )}
      </div>
    </div>
  )
}
