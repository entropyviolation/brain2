/**
 * components/Analytics/Observatory.tsx — Linked findings over the shared range
 *
 * Classical connections (Pearson r + n) plus the Cross-section density. Thin
 * overlap is watermarked, never a finding.
 */
"use client"

import { useMemo, useState } from "react"
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
import { FindingBlock, StudioHelp } from "./studio-kit"
import { dailySeries, observatoryFindings, OBSERVATORY_FLOOR, type ObservatoryPair } from "./observatory-findings"
import { fisherInterval, intervalClearsZero } from "./meta-math"
import { ForestPlot } from "./meta-plots"

type ForestSort = "strength" | "n" | "name"

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
      {
        id: "habits-sleep",
        aLabel: "Habit completion",
        bLabel: "sleep minutes",
        a: dailySeries(dateKeys, habitsByDay),
        b: dailySeries(dateKeys, sleepByDay),
      },
      {
        id: "switches-habits",
        aLabel: "Context switches",
        bLabel: "habit completion",
        a: dailySeries(dateKeys, switchesByDay),
        b: dailySeries(dateKeys, habitsByDay),
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
  const [sortBy, setSortBy] = useState<ForestSort>("strength")
  const [showThin, setShowThin] = useState(false)
  const [picked, setPicked] = useState<string | null>(null)
  const forestRows = useMemo(() => {
    const rows = findings
      .filter((f) => showThin || !f.thin)
      .map((f) => ({ id: f.id, label: PAIR_LABELS[f.id] ?? f.id, r: f.r, n: f.n, thin: f.thin }))
    if (sortBy === "n") rows.sort((a, b) => b.n - a.n)
    else if (sortBy === "name") rows.sort((a, b) => a.label.localeCompare(b.label))
    else rows.sort((a, b) => Math.abs(b.r) - Math.abs(a.r))
    return rows
  }, [findings, showThin, sortBy])
  const clears = ready.filter((f) => intervalClearsZero(f.r, f.n)).length
  const pickedFinding = findings.find((f) => f.id === picked) ?? null
  const pickedCi = pickedFinding ? fisherInterval(pickedFinding.r, pickedFinding.n) : null

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
          <p className="an-canvas-title an-canvas-title-row">
            Observatory
            <StudioHelp
              text={`${label}. Classical Pearson links across habits, tracking, sleep, points, and joy (n floor ${OBSERVATORY_FLOOR}). ${completed} completions in the window. Correlation is not causation.`}
            />
          </p>
        </div>
      </header>

      <CrossSection />

      {findings.length === 0 ? (
        <ChartFrame empty emptySentence={`Nothing recorded in the ${label} to connect yet.`} />
      ) : (
        <>
          {forestRows.length > 0 ? (
            <section className="an-plate" data-testid="observatory-forest">
              <p className="an-canvas-title">Every link at a glance</p>
              <p className="an-canvas-hint">
                Dot = r, size = overlapping days, whisker = 95% interval (Fisher z). Shaded edges are |r| ≥ 0.3. A whisker
                that crosses 0 could be chance. {clears} of {ready.length} links clear 0.
              </p>
              <div className="an-meta-tools">
                <span>Sort</span>
                {(["strength", "n", "name"] as const).map((key) => (
                  <button key={key} type="button" className="an-meta-chip" aria-pressed={sortBy === key} onClick={() => setSortBy(key)}>
                    {key === "strength" ? "|r|" : key === "n" ? "days" : "name"}
                  </button>
                ))}
                <label>
                  <input type="checkbox" checked={showThin} onChange={(e) => setShowThin(e.target.checked)} />
                  Show thin ({thin.length})
                </label>
              </div>
              <ForestPlot rows={forestRows} floor={OBSERVATORY_FLOOR} onPick={setPicked} activeId={picked} />
              {pickedFinding ? (
                <p className="an-canvas-readout" aria-live="polite">
                  {pickedFinding.sentence}
                  {pickedCi ? ` 95% interval ${pickedCi.lo.toFixed(2)} to ${pickedCi.hi.toFixed(2)}.` : ""}
                </p>
              ) : null}
            </section>
          ) : null}
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
    </div>
  )
}

const PAIR_LABELS: Record<string, string> = {
  "habits-tracking": "Habits ↔ tracked min",
  "switches-sleep": "Switches ↔ sleep",
  "points-habits": "Points ↔ habits",
  "joy-habits": "Joy ↔ habits",
  "joy-sleep": "Joy ↔ sleep",
  "activity-screentime": "Activity ↔ Screen Time",
  "habits-sleep": "Habits ↔ sleep",
  "switches-habits": "Switches ↔ habits",
}
