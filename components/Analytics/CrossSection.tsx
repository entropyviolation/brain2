/**
 * components/Analytics/CrossSection.tsx — Linked density over the shared range
 *
 * Small multiples of daily activity from habits, tracking, sleep, completions,
 * points, operations, and regret. One shared x-axis. Hover/pin a day to light
 * the same column in every series. Missing nights stay blank; empty series
 * keep the frame and say so. n is always on the row.
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useRegretStore } from "@/lib/regret-store"
import { useGoalsStore } from "@/lib/goals-store"
import { calculateDayPercentageAV } from "@/lib/calculations"
import { exemptionTest } from "@/lib/habit-exemption"
import { parseLocalDate } from "@/lib/date-utils"
import { useMetricsStore } from "@/lib/metrics-store"
import { uniqueMinutesByDate } from "@/lib/tracking-summary"
import { resolveNights } from "@/lib/sleep-inference"
import { sleepMinutes } from "@/lib/sleep-log"
import { buildHeatmap, isOperation } from "@/lib/operations"
import { contextSwitchSeries } from "@/lib/metrics"
import { entriesForDay } from "@/lib/time-entries"
import { dateKeyOf, inRange } from "./analytics-range"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import {
  buildCrossSection,
  intensity,
  presenceOf,
  readoutFor,
  type DensitySeries,
} from "./cross-section"

function weekdayIndex(key: string): number {
  const d = parseLocalDate(key)
  return d ? d.getDay() : 0
}

function cellFill(hue: number, value: number | null, domainMax: number): string {
  const kind = presenceOf(value)
  if (kind === "missing") return "transparent"
  if (kind === "zero") return `hsl(${hue} 18% 16% / 0.55)`
  const t = intensity(value, domainMax)
  const light = 14 + t * 46
  const sat = 42 + t * 38
  return `hsl(${hue} ${sat}% ${light}%)`
}

function tickLabel(key: string, index: number, total: number): string | null {
  const d = parseLocalDate(key)
  if (!d) return null
  if (total <= 14) return `${d.getMonth() + 1}/${d.getDate()}`
  if (d.getDate() === 1) return `${d.getMonth() + 1}/1`
  if (d.getDay() === 1 || index === 0 || index === total - 1) return String(d.getDate())
  return null
}

export function CrossSection() {
  const allTasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const trackingEntries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const loggedNights = useSleepStore((s) => s.nights)
  const regretHistory = useRegretStore((s) => s.regretHistory)
  const goals = useGoalsStore((s) => s.goals)
  const objectives = useGoalsStore((s) => s.objectives)
  const datapoints = useMetricsStore((s) => s.datapoints)
  const { dateKeys, keySet, label } = useAnalyticsRange()
  const [pinned, setPinned] = useState<string | null>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  const active = hovered ?? pinned ?? dateKeys[dateKeys.length - 1] ?? null

  const series = useMemo(() => {
    const trackingByDay = uniqueMinutesByDate(trackingEntries)
    const nights = resolveNights(loggedNights, { scopes, entries: trackingEntries }, dateKeys)
    const sleepByDay: Record<string, number | null> = {}
    for (const key of dateKeys) {
      sleepByDay[key] = sleepMinutes(nights[key])
    }

    const habitsByDay: Record<string, number | null> = {}
    for (const key of dateKeys) {
      habitsByDay[key] = habitTasks.length
        ? calculateDayPercentageAV(key, habitTasks as never, weeklyData as never, weekdayIndex(key), exemptionTest(habitExemptions, "daily"))
        : null
    }

    const completions: Record<string, number> = {}
    for (const key of dateKeys) completions[key] = 0
    for (const task of allTasks) {
      const doneKey = dateKeyOf(task.completedDate ?? (task.completed ? task.createdAt : null))
      if (task.completed && doneKey && keySet.has(doneKey)) completions[doneKey] = (completions[doneKey] ?? 0) + 1
    }

    const points: Record<string, number> = {}
    for (const key of dateKeys) points[key] = 0
    for (const e of pointsHistory) {
      if (keySet.has(e.date)) points[e.date] = (points[e.date] ?? 0) + e.points
    }

    const start = parseLocalDate(dateKeys[0] ?? "") ?? new Date()
    const end = parseLocalDate(dateKeys[dateKeys.length - 1] ?? "") ?? new Date()
    const heat = dateKeys.length
      ? buildHeatmap(allTasks, { start, end, days: dateKeys.length })
      : []
    const operations: Record<string, number> = {}
    for (const key of dateKeys) operations[key] = 0
    for (const cell of heat) {
      if (keySet.has(cell.date)) operations[cell.date] = cell.minutes
    }

    const regret: Record<string, number> = {}
    for (const key of dateKeys) regret[key] = 0
    for (const e of regretHistory) {
      if (keySet.has(e.date)) regret[e.date] = (regret[e.date] ?? 0) + e.regret
    }

    const moodScope = scopes.find((s) => s.name === "Mood")
    const mood: Record<string, number> = {}
    const switches: Record<string, number> = {}
    const joy: Record<string, number | null> = {}
    const location: Record<string, number> = {}
    const goalProgress: Record<string, number> = {}
    for (const key of dateKeys) {
      mood[key] = 0
      switches[key] = 0
      joy[key] = null
      location[key] = 0
      goalProgress[key] = 0
    }
    if (moodScope) {
      const byDay = uniqueMinutesByDate(trackingEntries.filter((e) => e.scopeId === moodScope.id))
      for (const key of dateKeys) mood[key] = byDay[key] ?? 0
    }
    const screentime: Record<string, number> = {}
    for (const key of dateKeys) screentime[key] = 0
    const stScope = scopes.find((s) => s.id === "screentime" || s.name.trim().toLowerCase() === "screen time")
    if (stScope) {
      const byDay = uniqueMinutesByDate(trackingEntries.filter((e) => e.scopeId === stScope.id))
      for (const key of dateKeys) screentime[key] = byDay[key] ?? 0
    }

    const loc = scopes.find((s) => s.name === "Location")
    if (loc) {
      for (const key of dateKeys) {
        location[key] = new Set(entriesForDay(trackingEntries, key, loc.id).map((e) => e.penId)).size
      }
    }
    for (const task of allTasks) {
      if (!task.completed) continue
      if (!(task.contributesToGoalIds?.length || task.contributesToObjectiveIds?.length)) continue
      const doneKey = dateKeyOf(task.completedDate ?? task.createdAt)
      if (doneKey && keySet.has(doneKey)) goalProgress[doneKey] = (goalProgress[doneKey] ?? 0) + 1
    }
    const activity = scopes.find((s) => s.name === "Activity") ?? scopes[0]
    if (activity) {
      const series = contextSwitchSeries(
        dateKeys.map((key) => ({
          date: key,
          sequence: entriesForDay(trackingEntries, key, activity.id).map((e) => e.penId),
        })),
      )
      for (const p of series) switches[p.date] = p.switches
    }
    for (const dp of datapoints) {
      const key = dateKeyOf(dp.at)
      if (!key || !keySet.has(key) || dp.values.joy === undefined) continue
      if (joy[key] === null) joy[key] = dp.values.joy
    }

    return buildCrossSection({
      dateKeys,
      habits: habitsByDay,
      tracking: trackingByDay,
      sleep: sleepByDay,
      completions,
      points,
      operations,
      regret,
      mood,
      joy,
      switches,
      location,
      goals: goalProgress,
      screentime,
    })
  }, [
    allTasks,
    dateKeys,
    habitTasks,
    keySet,
    loggedNights,
    pointsHistory,
    regretHistory,
    scopes,
    trackingEntries,
    weeklyData,
    habitExemptions,
    datapoints,
  ])

  const operationCount = useMemo(() => allTasks.filter((t) => isOperation(t)).length, [allTasks])
  const goalsAtTarget = useMemo(
    () => goals.filter((g) => g.target > 0 && g.current >= g.target).length,
    [goals],
  )
  const itemsInWindow = useMemo(
    () => allTasks.filter((t) => inRange(t.completedDate ?? t.createdAt, keySet)).length,
    [allTasks, keySet],
  )

  const anySeries = series.some((s) => s.n > 0)
  const readout = active ? readoutFor(series, active) : ""
  const activeDate = active ? parseLocalDate(active) : null

  return (
    <div
      className="an-canvas"
      data-testid="cross-section"
      data-ui-name="Cross-section"
      data-ui-docs="components/Analytics/README.md"
      data-ui-docs-anchor="studio-views"
    >
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Cross-section</p>
          <p className="an-canvas-kicker">
            {`${label} · n = ${dateKeys.length} days · ${itemsInWindow} items touched · ${operationCount} operation${
              operationCount === 1 ? "" : "s"
            } · ${goalsAtTarget}/${goals.length} goals at target · ${objectives.length} objectives`}
          </p>
        </div>
        <p className="an-canvas-hint">Hover a day; click to pin. Missing nights stay blank.</p>
      </header>

      {!anySeries ? (
        <ChartFrame empty emptySentence={`Nothing recorded in the ${label} to align yet.`} />
      ) : (
        <>
          <div
            className="an-density"
            style={{ ["--an-cols" as string]: String(Math.max(dateKeys.length, 1)) }}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="an-density-axis" aria-hidden>
              <span className="an-density-label" />
              <div className="an-density-cells">
                {dateKeys.map((key, i) => (
                  <span key={key} className="an-density-tick">
                    {tickLabel(key, i, dateKeys.length) ?? ""}
                  </span>
                ))}
              </div>
              <span className="an-density-n">n</span>
            </div>
            {series.map((row) => (
              <DensityRow
                key={row.id}
                series={row}
                active={active}
                onHover={setHovered}
                onPin={setPinned}
              />
            ))}
          </div>
          <p className="an-canvas-readout" aria-live="polite">
            {activeDate
              ? `${activeDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · ${readout}`
              : "Move across the window."}
          </p>
          <OpenInListsButton
            taskIds={allTasks.filter((t) => t.completed && inRange(t.completedDate ?? t.createdAt, keySet)).map((t) => t.id)}
          />
        </>
      )}
    </div>
  )
}

function DensityRow({
  series,
  active,
  onHover,
  onPin,
}: {
  series: DensitySeries
  active: string | null
  onHover: (date: string) => void
  onPin: (date: string) => void
}) {
  const empty = series.n === 0
  return (
    <div className="an-density-row">
      <span className="an-density-label">{series.label}</span>
      <div className="an-density-cells" role="img" aria-label={`${series.label}, n = ${series.n}`}>
        {empty ? (
          <span className="an-density-empty">No observations in this window.</span>
        ) : (
          series.points.map((p) => {
            const kind = presenceOf(p.value)
            return (
              <button
                key={p.date}
                type="button"
                className={`an-density-cell${active === p.date ? " is-active" : ""}`}
                style={{ background: cellFill(series.hue, p.value, series.domainMax) }}
                data-kind={kind}
                title={
                  p.value === null
                    ? `${p.date}: no ${series.label.toLowerCase()} observation`
                    : `${p.date}: ${series.format(p.value)}`
                }
                onMouseEnter={() => onHover(p.date)}
                onFocus={() => onHover(p.date)}
                onClick={() => onPin(p.date)}
              />
            )
          })
        )}
      </div>
      <span className="an-density-n">n={series.n}</span>
    </div>
  )
}
