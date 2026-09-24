/**
 * components/Analytics/Observatory.tsx — Linked findings over the shared range
 *
 * Classical connections (Pearson r + n) plus the Cross-section density. Thin
 * overlap is watermarked, never a finding.
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useMetricsStore } from "@/lib/metrics-store"
import { calculateDayPercentageAV } from "@/lib/calculations"
import { exemptionTest } from "@/lib/habit-exemption"
import { parseLocalDate } from "@/lib/date-utils"
import { uniqueMinutesByDate } from "@/lib/tracking-summary"
import { resolveNights } from "@/lib/sleep-inference"
import { sleepMinutes } from "@/lib/sleep-log"
import { contextSwitchSeries } from "@/lib/metrics"
import { entriesForDay } from "@/lib/time-entries"
import { dateKeyOf } from "./analytics-range"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { CrossSection } from "./CrossSection"
import { FindingBlock } from "./studio-kit"
import { dailySeries, observatoryFindings, OBSERVATORY_FLOOR, type ObservatoryPair } from "./observatory-findings"

function weekdayIndex(key: string): number {
  const d = parseLocalDate(key)
  return d ? d.getDay() : 0
}

export function Observatory() {
  const allTasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const trackingEntries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const loggedNights = useSleepStore((s) => s.nights)
  const datapoints = useMetricsStore((s) => s.datapoints)
  const { dateKeys, label } = useAnalyticsRange()
  const activity = scopes.find((s) => s.name === "Activity") ?? scopes[0]

  const findings = useMemo(() => {
    const trackingByDay = uniqueMinutesByDate(trackingEntries)
    const stScope = scopes.find((s) => s.id === "screentime" || s.name.trim().toLowerCase() === "screen time")
    const activityOcc = uniqueMinutesByDate(
      activity ? trackingEntries.filter((e) => e.scopeId === activity.id) : [],
    )
    const screenOcc = uniqueMinutesByDate(
      stScope ? trackingEntries.filter((e) => e.scopeId === stScope.id) : [],
    )
    const nights = resolveNights(loggedNights, { scopes, entries: trackingEntries }, dateKeys)
    const sleepByDay: Record<string, number | null> = {}
    const habitsByDay: Record<string, number | null> = {}
    const pointsByDay: Record<string, number> = {}
    const switchesByDay: Record<string, number> = {}
    const joyByDay: Record<string, number> = {}

    for (const key of dateKeys) {
      sleepByDay[key] = sleepMinutes(nights[key])
      habitsByDay[key] = habitTasks.length
        ? calculateDayPercentageAV(key, habitTasks as never, weeklyData as never, weekdayIndex(key), exemptionTest(habitExemptions, "daily"))
        : null
    }
    for (const e of pointsHistory) {
      if (dateKeys.includes(e.date)) pointsByDay[e.date] = (pointsByDay[e.date] ?? 0) + e.points
    }
    if (activity) {
      const series = contextSwitchSeries(
        dateKeys.map((key) => ({
          date: key,
          sequence: entriesForDay(trackingEntries, key, activity.id).map((e) => e.penId),
        })),
      )
      for (const p of series) {
        if (entriesForDay(trackingEntries, p.date, activity.id).length > 0) {
          switchesByDay[p.date] = p.switches
        }
      }
    }
    for (const dp of datapoints) {
      const key = dateKeyOf(dp.at)
      if (!key || joyByDay[key] !== undefined) continue
      if (dp.values.joy !== undefined) joyByDay[key] = dp.values.joy
    }

    const pairs: ObservatoryPair[] = [
      {
        id: "habits-tracking",
        aLabel: "Habit completion",
        bLabel: "tracked minutes",
        a: dailySeries(dateKeys, habitsByDay),
        b: dailySeries(dateKeys, trackingByDay),
      },
      {
        id: "switches-sleep",
        aLabel: "Context switches",
        bLabel: "sleep minutes",
        a: dailySeries(dateKeys, switchesByDay),
        b: dailySeries(dateKeys, sleepByDay),
      },
      {
        id: "points-habits",
        aLabel: "Points",
        bLabel: "habit completion",
        a: dailySeries(dateKeys, pointsByDay),
        b: dailySeries(dateKeys, habitsByDay),
      },
      {
        id: "joy-habits",
        aLabel: "Joy",
        bLabel: "habit completion",
        a: dailySeries(dateKeys, joyByDay),
        b: dailySeries(dateKeys, habitsByDay),
      },
      {
        id: "joy-sleep",
        aLabel: "Joy",
        bLabel: "sleep minutes",
        a: dailySeries(dateKeys, joyByDay),
        b: dailySeries(dateKeys, sleepByDay),
      },
      {
        id: "activity-screentime",
        aLabel: "Activity occupancy",
        bLabel: "Screen Time occupancy",
        a: dailySeries(dateKeys, activityOcc),
        b: dailySeries(dateKeys, screenOcc),
      },
    ]
    return observatoryFindings(pairs, OBSERVATORY_FLOOR)
  }, [
    activity,
    datapoints,
    dateKeys,
    habitTasks,
    loggedNights,
    pointsHistory,
    scopes,
    trackingEntries,
    weeklyData,
    habitExemptions,
  ])

  const completed = useMemo(
    () => allTasks.filter((t) => t.completed && dateKeys.includes(dateKeyOf(t.completedDate ?? t.createdAt) ?? "")).length,
    [allTasks, dateKeys],
  )

  const ready = findings.filter((f) => !f.thin)
  const thin = findings.filter((f) => f.thin)

  return (
    <div
      className="an-canvas an-stack"
      data-testid="observatory"
      data-ui-name="Observatory"
      data-ui-docs="components/Analytics/README.md"
      data-ui-docs-anchor="studio-views"
    >
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Observatory</p>
          <p className="an-canvas-kicker">
            {label} · classical links across habits, tracking, sleep, points, and joy · n floor {OBSERVATORY_FLOOR}
          </p>
        </div>
        <p className="an-canvas-hint">{completed} completions in the window. Correlation is not causation.</p>
      </header>

      {findings.length === 0 ? (
        <ChartFrame empty emptySentence={`Nothing recorded in the ${label} to connect yet.`} />
      ) : (
        <>
          {ready.map((f) => (
            <FindingBlock
              key={f.id}
              sentence={f.sentence}
              n={`n = ${f.n} overlapping days · r = ${f.r.toFixed(2)}`}
              caveat="Pearson r on inner-joined calendar days. Not a cause."
            />
          ))}
          {thin.map((f) => (
            <ChartFrame key={f.id} thin thinSentence={f.sentence} />
          ))}
        </>
      )}

      <CrossSection />
    </div>
  )
}
