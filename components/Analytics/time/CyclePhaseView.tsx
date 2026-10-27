/**
 * components/Analytics/CyclePhaseView.tsx — Time → Cycle phase
 *
 * Days in the shared window. The phase shown is assessCycleDay.
 * A bleed or ovulation mark stays marked. A guess is labeled estimated
 * and is not painted as a logged phase. Means and medians use marked days.
 * Unknown stays visible. Spotting is not a phase. Not a diagnosis.
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useHabitsStore } from "@/lib/habits-store"
import { findIphoneScreenTimeScope, findScreenTimeScope, useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useRegretStore } from "@/lib/regret-store"
import { useMetricsStore, METRIC_DEFINITIONS } from "@/lib/metrics-store"
import { useCycleMarksStore } from "@/lib/cycle-marks"
import type { CycleBasis } from "@/lib/cycle-estimate"
import { calculateDayPercentageAV } from "@/lib/calculations"
import { exemptionTest } from "@/lib/habit-exemption"
import { parseLocalDate } from "@/lib/date-utils"
import { uniqueMinutesByDate } from "@/lib/tracking-summary"
import { resolveNights } from "@/lib/sleep-inference"
import { sleepMinutes } from "@/lib/sleep-log"
import { MOOD_RANK_KEYS, RANK_LABEL, compactMoodReading } from "@/lib/mood-reading"
import {
  asLogEntry,
  classifyLogInstant,
} from "@/components/Home/Tracking/tracking-log-model"
import { ChartFrame } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { dateKeyOf } from "./analytics-range"
import { CanvasTitle, StudioBars, StudioReadout } from "./studio-kit"
import {
  cyclePhaseEmptySentence,
  cyclePhaseReport,
  dailyMean,
  formatPhaseNumber,
  zeroFill,
  PHASE_LABEL,
  type CyclePhaseMetricFormat,
  type CyclePhaseMetricInput,
  type PhaseComparison,
} from "./cycle-phase-stats"

function weekdayIndex(key: string): number {
  const d = parseLocalDate(key)
  return d ? d.getDay() : 0
}

function formatCell(format: CyclePhaseMetricFormat, value: number | null): string {
  if (value === null) return "—"
  if (format === "hours") return `${formatPhaseNumber(value / 60)} h`
  if (format === "minutes") return `${formatPhaseNumber(value)} m`
  if (format === "percent") return `${formatPhaseNumber(value)}%`
  return formatPhaseNumber(value)
}

function PhaseTable({
  title,
  format,
  rows,
  basis,
}: {
  title: string
  format: CyclePhaseMetricFormat
  rows: PhaseComparison[]
  basis: CycleBasis
}) {
  const marked = basis === "marked"
  const basisWord = marked ? "Marked" : "Estimated"
  return (
    <div className="an-plot-well">
      <table className="an-phase-table" aria-label={`${title} on ${basis} days`} data-basis={basis}>
        <thead>
          <tr>
            <th title="The phase this tab shows. Unknown is its own bucket.">Phase</th>
            <th
              title={
                marked
                  ? "Marked days in this window with this phase. An estimated day is not in this count."
                  : "Estimated days shown in this phase. Not a day logged as this phase."
              }
            >
              {basisWord}
            </th>
            <th title="Days that contributed a number. A blank reading is not in n.">n</th>
            <th title="Mean of those n days.">Mean</th>
            <th title="Median of those n days. An even n averages the two middle values.">Median</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.phase} data-phase={row.phase}>
              <td>{PHASE_LABEL[row.phase]}</td>
              <td>{row.days}</td>
              <td>{row.n}</td>
              <td>{formatCell(format, row.mean)}</td>
              <td>{formatCell(format, row.median)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CyclePhaseView() {
  const tasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const loggedNights = useSleepStore((s) => s.nights)
  const regretHistory = useRegretStore((s) => s.regretHistory)
  const datapoints = useMetricsStore((s) => s.datapoints)
  const marks = useCycleMarksStore((s) => s.marks)
  const { dateKeys, keySet, label } = useAnalyticsRange()

  const report = useMemo(() => {
    const metrics: CyclePhaseMetricInput[] = []

    const nights = resolveNights(loggedNights, { scopes, entries }, dateKeys)
    const sleep: Record<string, number | null> = {}
    for (const key of dateKeys) sleep[key] = sleepMinutes(nights[key])
    metrics.push({
      id: "sleep",
      title: "Sleep",
      note: "Hours asleep. Same night key as Sleep. A night without both ends is left out, not counted as zero.",
      format: "hours",
      values: sleep,
    })

    for (const def of METRIC_DEFINITIONS) {
      const samples: { date: string; value: number }[] = []
      for (const point of datapoints) {
        const value = point.values[def.key]
        const date = dateKeyOf(point.at)
        if (value === undefined || !date || !keySet.has(date)) continue
        samples.push({ date, value })
      }
      metrics.push({
        id: def.key,
        title: def.name,
        note: "0–100. Several readings on one day are averaged first. A day with no reading is left out.",
        format: "score",
        values: dailyMean(samples),
      })
    }

    const mood = scopes.find((scope) => scope.name === "Mood")
    if (mood) {
      const samples: Record<string, { date: string; value: number }[]> = {}
      for (const key of MOOD_RANK_KEYS) samples[key] = []
      for (const entry of entries) {
        if (entry.scopeId !== mood.id || !keySet.has(entry.date)) continue
        const packed = compactMoodReading(entry.moodReading)
        if (!packed) continue
        for (const key of MOOD_RANK_KEYS) {
          const value = packed[key]
          if (value === undefined) continue
          samples[key]?.push({ date: entry.date, value })
        }
      }
      for (const key of MOOD_RANK_KEYS) {
        metrics.push({
          id: `mood-${key}`,
          title: RANK_LABEL[key],
          note: "1–10 on Mood stretches that set this mark. A blank is left out, not zero. One day’s stretches are averaged first.",
          format: "score",
          values: dailyMean(samples[key] ?? []),
        })
      }
    }

    const penName = new Map<string, string>()
    for (const scope of scopes) {
      for (const pen of scope.pens) penName.set(pen.id, pen.name)
    }
    const logDates: Record<"food" | "drink" | "drug" | "intake", string[]> = {
      food: [],
      drink: [],
      drug: [],
      intake: [],
    }
    for (const entry of entries) {
      if (!keySet.has(entry.date)) continue
      const row = classifyLogInstant(asLogEntry(entry), penName.get(entry.penId))
      if (!row) continue
      if (row.list === "food" || row.list === "drink" || row.list === "drug" || row.list === "intake") {
        logDates[row.list].push(entry.date)
      }
    }
    const logNotes: Record<"food" | "drink" | "drug" | "intake", { title: string; note: string }> = {
      food: {
        title: "Food logs",
        note: "Logged food events per day. A day with no food log is 0. This is not an amount eaten.",
      },
      drink: {
        title: "Drink logs",
        note: "Logged drink events per day. A day with no drink log is 0. This is not an amount drunk.",
      },
      drug: {
        title: "Drug logs",
        note: "Logged drug events per day. A day with no drug log is 0. This is not a dose.",
      },
      intake: {
        title: "Intake logs",
        note: "Unclassed intake events per day. Food, drink, and drug stay in their own rows. A day with none is 0.",
      },
    }
    for (const list of ["food", "drink", "drug", "intake"] as const) {
      const counts: Record<string, number> = {}
      for (const date of logDates[list]) counts[date] = (counts[date] ?? 0) + 1
      metrics.push({
        id: `log-${list}`,
        title: logNotes[list].title,
        note: logNotes[list].note,
        format: "count",
        values: zeroFill(dateKeys, counts),
        skipIfAllZero: true,
      })
    }

    const minuteSeries: { id: string; title: string; note: string; scopeId: string | undefined }[] = [
      {
        id: "screentime",
        title: "Screen Time",
        note: "Occupied minutes on the Screen Time scope, the same one as the Screen Time tab. A day with no paint is 0. iPhone Screen Time is separate.",
        scopeId: findScreenTimeScope(scopes)?.id,
      },
      {
        id: "iphone-screentime",
        title: "iPhone Screen Time",
        note: "Occupied minutes on the iPhone Screen Time scope. Not mixed into Screen Time. A day with no paint is 0.",
        scopeId: findIphoneScreenTimeScope(scopes)?.id,
      },
      {
        id: "activity",
        title: "Activity",
        note: "Occupied minutes on Activity. Overlapping blocks count once. A day with no paint is 0.",
        scopeId: scopes.find((scope) => scope.id === "activity" || scope.name === "Activity")?.id,
      },
    ]
    for (const series of minuteSeries) {
      if (!series.scopeId) continue
      const byDay = uniqueMinutesByDate(entries.filter((entry) => entry.scopeId === series.scopeId))
      metrics.push({
        id: series.id,
        title: series.title,
        note: series.note,
        format: "minutes",
        values: zeroFill(dateKeys, byDay),
        skipIfAllZero: true,
      })
    }

    const completions: Record<string, number> = {}
    for (const task of tasks) {
      if (!task.completed) continue
      const doneKey = dateKeyOf(task.completedDate ?? task.createdAt)
      if (!doneKey || !keySet.has(doneKey)) continue
      completions[doneKey] = (completions[doneKey] ?? 0) + 1
    }
    metrics.push({
      id: "tasks",
      title: "Tasks completed",
      note: "Tasks marked complete that day. A day with none is 0.",
      format: "count",
      values: zeroFill(dateKeys, completions),
      skipIfAllZero: true,
    })

    if (habitTasks.length > 0) {
      const habits: Record<string, number> = {}
      for (const key of dateKeys) {
        if (!weeklyData[key]) continue
        habits[key] = calculateDayPercentageAV(
          key,
          habitTasks as never,
          weeklyData as never,
          weekdayIndex(key),
          exemptionTest(habitExemptions, "daily"),
        )
      }
      metrics.push({
        id: "habits",
        title: "Habit completion",
        note: "Daily habit % on days that have a habit log. A day with no log is left out, not scored as zero.",
        format: "percent",
        values: habits,
      })
    }

    const points: Record<string, number> = {}
    for (const entry of pointsHistory) {
      if (!keySet.has(entry.date)) continue
      points[entry.date] = (points[entry.date] ?? 0) + entry.points
    }
    metrics.push({
      id: "points",
      title: "Points",
      note: "Points logged that day. A day with no entry is 0.",
      format: "count",
      values: zeroFill(dateKeys, points),
      skipIfAllZero: true,
    })

    const regret: Record<string, number> = {}
    for (const entry of regretHistory) {
      if (!keySet.has(entry.date)) continue
      regret[entry.date] = (regret[entry.date] ?? 0) + entry.regret
    }
    metrics.push({
      id: "regret",
      title: "Regret",
      note: "Regret logged that day, the same store as the Regret tab. A day with no row is 0.",
      format: "count",
      values: zeroFill(dateKeys, regret),
      skipIfAllZero: true,
    })

    return cyclePhaseReport(dateKeys, marks, metrics)
  }, [
    datapoints,
    dateKeys,
    entries,
    habitExemptions,
    habitTasks,
    keySet,
    loggedNights,
    marks,
    pointsHistory,
    regretHistory,
    scopes,
    tasks,
    weeklyData,
  ])

  const unknown = report.counts.find((row) => row.phase === "unknown")?.days ?? 0
  const markedBars = report.counts.map((row) => ({ name: PHASE_LABEL[row.phase], value: row.marked }))
  const estimatedBars = report.counts
    .filter((row) => row.estimated > 0)
    .map((row) => ({ name: PHASE_LABEL[row.phase], value: row.estimated }))

  return (
    <div className="an-canvas an-stack" data-testid="cycle-phase-view">
      <header className="an-canvas-head">
        <div>
          <CanvasTitle
            title="Cycle phase"
            help="Days in this window. A bleed day or an ovulation mark is marked. A day with no ovulation in that cycle may show an estimate, labeled estimated, and is not counted as a logged phase. Means and medians are on marked days, with n. An estimated split stays labeled and is not a finding. Spotting is not a phase. Unknown days stay in their own bucket. This describes your logs. It is not a diagnosis."
          />
          <p className="an-canvas-kicker">
            {label} · marked from bleed days and ovulation marks. An estimate is labeled and is not a logged phase.
            Marks before this window still label the days inside it.
          </p>
        </div>
      </header>
      <p className="an-caveat">This describes your own logs. It is not a diagnosis.</p>

      {!report.hasMarks ? (
        <ChartFrame empty emptySentence={cyclePhaseEmptySentence(marks)} />
      ) : (
        <>
          <section className="an-plate" data-testid="cycle-phase-mix">
            <p className="an-canvas-title">Days in each phase</p>
            <p className="an-canvas-kicker">
              {dateKeys.length} days in this window. Marked and estimated are counted apart. Unknown is its own
              bucket. Spotting does not set a phase.
            </p>
            <div className="an-readouts">
              <StudioReadout label="Days" value={dateKeys.length} note={label} />
              <StudioReadout label="Marked" value={report.markedDays} note="logged phase" />
              <StudioReadout label="Estimated" value={report.estimatedDays} note="a guess, not a log" />
              <StudioReadout label="Unknown" value={unknown} note="kept, not dropped" />
            </div>
            <div className="an-plot-well">
              <table className="an-phase-table" aria-label="Days by phase and basis" data-testid="cycle-phase-mix-table">
                <thead>
                  <tr>
                    <th title="The phase this tab shows. Unknown is its own bucket.">Phase</th>
                    <th title="Days whose phase comes from a bleed or an ovulation mark.">Marked</th>
                    <th title="Days whose phase is a guess. Not a logged phase.">Estimated</th>
                  </tr>
                </thead>
                <tbody>
                  {report.counts.map((row) => (
                    <tr key={row.phase} data-phase={row.phase}>
                      <td>{PHASE_LABEL[row.phase]}</td>
                      <td>{row.marked}</td>
                      <td>{row.estimated}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="an-canvas-kicker">Marked days</p>
            <StudioBars rows={markedBars} max={Math.max(...markedBars.map((row) => row.value), 1)} unit="" />
            {estimatedBars.length > 0 ? (
              <div data-testid="cycle-phase-estimated-bars">
                <p className="an-canvas-kicker">Estimated days. A guess, not a logged phase.</p>
                <StudioBars
                  rows={estimatedBars}
                  max={Math.max(...estimatedBars.map((row) => row.value), 1)}
                  unit=""
                />
              </div>
            ) : null}
            <p className="an-n">
              n = {dateKeys.length} days · {report.markedDays} marked · {report.estimatedDays} estimated
            </p>
            <p className="an-caveat" data-testid="cycle-phase-basis">
              {report.basisNote}
            </p>
            {report.mixNote ? <p className="an-caveat">{report.mixNote}</p> : null}
          </section>

          {report.metrics.length === 0 ? (
            <p className="an-canvas-hint">No dated readings in the {label} to set beside these phases.</p>
          ) : (
            report.metrics.map((metric) => (
              <section key={metric.id} className="an-plate" data-testid={`cycle-phase-${metric.id}`}>
                <p className="an-canvas-title">{metric.title}</p>
                <p className="an-canvas-kicker">{metric.note}</p>
                <p className="an-canvas-kicker">Marked days</p>
                <PhaseTable title={metric.title} format={metric.format} rows={metric.rows} basis="marked" />
                {metric.thinNote ? <p className="an-caveat">{metric.thinNote}</p> : null}
                {metric.estimatedRows ? (
                  <>
                    <p className="an-canvas-kicker">Estimated days. A guess, not a logged phase.</p>
                    <PhaseTable
                      title={metric.title}
                      format={metric.format}
                      rows={metric.estimatedRows}
                      basis="estimated"
                    />
                    {metric.estimatedNote ? <p className="an-caveat">{metric.estimatedNote}</p> : null}
                  </>
                ) : null}
              </section>
            ))
          )}
        </>
      )}
    </div>
  )
}
