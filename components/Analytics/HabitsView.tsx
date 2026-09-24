/**
 * components/Analytics/HabitsView.tsx — Habit density, rates, grades, Good days
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useHabitsStore } from "@/lib/habits-store"
import { calculateDayPercentageAV, calculatePeriodGrade, calculateWeekToDateGrade } from "@/lib/calculations"
import { exemptionTest, isHabitPeriodExempt } from "@/lib/habit-exemption"
import { useExemptionContext } from "@/lib/sleep-store"
import { formatLocalDateKey, getMonthDates, getWeekDates, getWeekStartDate, parseLocalDate } from "@/lib/date-utils"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { goodDaySummary } from "@/lib/habit-accomplishment"
import { incrementalDataForTask, incrementalGoalOn, incrementalLoggedValue } from "@/lib/incremental-habits"
import { activeTrackingLink } from "@/lib/habit-tracking"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { useAnalyticsRange } from "./analytics-range-store"
import { inRange } from "./analytics-range"
import { DensityCalendar, PhosphorTrace, StudioBars, StudioReadout } from "./studio-kit"
import { HorizonChart, Slopegraph } from "./studio-plots"
import { weekdayWeekendRates } from "./studio-plot-stats"
import { autocorrelation } from "@/lib/metrics"

function addDays(d: Date, n: number) {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function heatColor(pct: number): string {
  if (pct <= 0) return "#b0b0b0"
  if (pct < 25) return "hsl(152 40% 18%)"
  if (pct < 50) return "hsl(152 50% 28%)"
  if (pct < 75) return "hsl(158 62% 38%)"
  return "hsl(166 72% 48%)"
}

export function HabitsView() {
  const allTasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const exemptionCtx = useExemptionContext()
  const gradeTolerance = useHabitsStore((s) => s.gradeTolerance)
  const accomplishmentThreshold = useHabitsStore((s) => s.accomplishmentThreshold)
  const range = useAnalyticsRange()

  const completedInRange = useMemo(
    () => allTasks.filter((t) => t.completed && inRange(t.completedDate ?? t.createdAt, range.keySet)).length,
    [allTasks, range.keySet],
  )
  const tasksTouched = useMemo(
    () => allTasks.filter((t) => inRange(t.completedDate ?? t.createdAt, range.keySet)).length,
    [allTasks, range.keySet],
  )
  const completionRate = tasksTouched ? Math.round((completedInRange / tasksTouched) * 100) : 0
  const totalPoints = useMemo(
    () => pointsHistory.filter((e) => range.keySet.has(e.date)).reduce((s, e) => s + e.points, 0),
    [pointsHistory, range.keySet],
  )
  const hasHeadline = totalPoints > 0 || completedInRange > 0 || habitTasks.length > 0

  const heatmap = useMemo(() => {
    if (range.dateKeys.length === 0) return []
    const start = parseLocalDate(range.dateKeys[0]) ?? new Date()
    const weekday = (start.getDay() + 6) % 7
    const aligned = addDays(start, -weekday)
    const today = parseLocalDate(range.dateKeys[range.dateKeys.length - 1]) ?? new Date()
    const totalDays = Math.round((today.getTime() - aligned.getTime()) / 86400000) + 1
    const weeks = Math.ceil(totalDays / 7)
    const cols: { key: string; value: number; out?: boolean }[][] = []
    for (let w = 0; w < weeks; w++) {
      const col: { key: string; value: number; out?: boolean }[] = []
      for (let day = 0; day < 7; day++) {
        const d = addDays(aligned, w * 7 + day)
        const key = formatLocalDateKey(d)
        const inWindow = range.keySet.has(key)
        const pct =
          inWindow && habitTasks.length
            ? calculateDayPercentageAV(key, habitTasks as never, weeklyData as never, day, exemptionTest(habitExemptions, "daily", exemptionCtx))
            : 0
        col.push({ key, value: pct, out: !inWindow || d > today })
      }
      cols.push(col)
    }
    return cols
  }, [habitTasks, weeklyData, habitExemptions, exemptionCtx, range.dateKeys, range.keySet])

  const habitRates = useMemo(() => {
    return habitTasks
      .map((task) => {
        let done = 0
        let required = 0
        for (const key of range.dateKeys) {
          if (isHabitPeriodExempt(task, key, "daily", habitExemptions, exemptionCtx)) continue
          required++
          const c = weeklyData[key]?.[task.id]
          if (!c) continue
          if (isHabitGoalMet(task, c, { date: parseLocalDate(key) ?? undefined, weeklyData })) done++
        }
        if (required === 0) return null
        return { name: task.name, value: Math.round((done / required) * 100) }
      })
      .filter((row): row is { name: string; value: number } => row !== null)
      .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
  }, [habitTasks, weeklyData, habitExemptions, exemptionCtx, range.dateKeys])

  const asOf = parseLocalDate(range.dateKeys[range.dateKeys.length - 1]) ?? new Date()
  const weekDates = getWeekDates(getWeekStartDate(asOf))
  const weekGrade = useMemo(
    () => calculateWeekToDateGrade(habitTasks as never, weeklyData, weekDates, asOf, gradeTolerance, exemptionTest(habitExemptions, "daily", exemptionCtx)),
    [habitTasks, weeklyData, habitExemptions, exemptionCtx, weekDates, asOf, gradeTolerance],
  )
  const goods = useMemo(
    () =>
      goodDaySummary(
        habitTasks,
        weeklyData,
        asOf,
        accomplishmentThreshold,
        undefined,
        undefined,
        exemptionTest(habitExemptions, "daily", exemptionCtx),
      ),
    [habitTasks, weeklyData, habitExemptions, exemptionCtx, asOf, accomplishmentThreshold],
  )
  const monthGrade = useMemo(() => {
    const periods = getMonthDates(asOf).map((date) => ({ key: formatLocalDateKey(date), date }))
    return calculatePeriodGrade(habitTasks as never, weeklyData, periods, asOf, gradeTolerance, exemptionTest(habitExemptions, "daily", exemptionCtx))
  }, [habitTasks, weeklyData, habitExemptions, exemptionCtx, asOf, gradeTolerance])
  const climbs = useMemo(
    () =>
      habitTasks.flatMap((task) => {
        const data = incrementalDataForTask(task)
        if (!data) return []
        const logged = incrementalLoggedValue(weeklyData[formatLocalDateKey(asOf)]?.[task.id])
        const goal = incrementalGoalOn(task, weeklyData, asOf)
        return [{ name: task.name, value: Math.round(logged ?? goal), unit: data.unit ? ` ${data.unit}` : "" }]
      }),
    [habitTasks, weeklyData, habitExemptions, exemptionCtx, asOf],
  )
  const linkedCount = habitTasks.filter((t) => activeTrackingLink(t)).length
  const habitPctSeries = useMemo(() => {
    if (habitTasks.length === 0) return []
    return range.dateKeys.map((key) => {
      const d = parseLocalDate(key)
      const dow = d ? (d.getDay() + 6) % 7 : 0
      return { date: key, value: calculateDayPercentageAV(key, habitTasks as never, weeklyData as never, dow, exemptionTest(habitExemptions, "daily", exemptionCtx)) }
    })
  }, [habitTasks, weeklyData, habitExemptions, exemptionCtx, range.dateKeys])
  const habitR1 = autocorrelation(habitPctSeries.map((p) => p.value), 1)
  const habitR7 = autocorrelation(habitPctSeries.map((p) => p.value), 7)
  const slopes = useMemo(() => {
    return habitTasks
      .map((task) => {
        const cut = weekdayWeekendRates(range.dateKeys, (key) => {
          const c = weeklyData[key]?.[task.id]
          if (!c) return false
          return isHabitGoalMet(task, c, { date: parseLocalDate(key) ?? undefined, weeklyData })
        })
        return { id: task.id, name: task.name, left: cut.weekday, right: cut.weekend }
      })
      .sort((a, b) => Math.abs(b.right - b.left) - Math.abs(a.right - a.left) || a.name.localeCompare(b.name))
  }, [habitTasks, weeklyData, habitExemptions, exemptionCtx, range.dateKeys])

  return (
    <div className="an-canvas an-stack">
      {!hasHeadline ? (
        <ChartFrame empty emptySentence={`Nothing in the ${range.label} to total yet.`} />
      ) : (
        <div className="an-readouts">
          <StudioReadout label="Points" value={totalPoints} note={range.label} />
          <StudioReadout label="Tasks completed" value={completedInRange} note={range.label} />
          {tasksTouched > 0 ? (
            <StudioReadout label="Completion rate" value={`${completionRate}%`} note={`${tasksTouched} items`} />
          ) : (
            <ChartFrame empty emptySentence="No items in this window to rate." />
          )}
          <StudioReadout label="Active habits" value={habitTasks.length} />
        </div>
      )}

      {habitTasks.length > 0 && (
        <div className="an-readouts">
          <StudioReadout
            label="Week grade"
            value={`${Math.round(weekGrade.grade)}%`}
            note={`raw ${Math.round(weekGrade.rawGrade)}% · ${weekGrade.daysIncluded} days`}
          />
          <StudioReadout
            label="Good days"
            value={goods.streak}
            note={`${goods.last30Count} in last 30 · threshold ${goods.threshold}%`}
          />
          <StudioReadout
            label="Month grade"
            value={`${Math.round(monthGrade.grade)}%`}
            note={`raw ${Math.round(monthGrade.rawGrade)}% · ${monthGrade.daysIncluded} days`}
          />
          <StudioReadout
            label="Tracking-linked"
            value={`${linkedCount}/${habitTasks.length}`}
            note="vs manual"
          />
        </div>
      )}
      {climbs.length > 0 && (
        <div>
          <p className="an-canvas-title">Climb</p>
          <StudioBars rows={climbs.map((c) => ({ name: c.name, value: c.value }))} max={Math.max(...climbs.map((c) => c.value), 1)} unit={climbs[0]?.unit ?? ""} />
        </div>
      )}

      <div>
        <p className="an-canvas-title">Daily habit completion heatmap</p>
        {habitTasks.length === 0 ? (
          <ChartFrame empty emptySentence="No habits yet — the heatmap stays blank until there is a series." />
        ) : (
          <>
            <DensityCalendar weeks={heatmap} color={heatColor} />
            <div className="an-legend">
              <span>Less</span>
              {[0, 20, 40, 70, 100].map((p) => (
                <i key={p} style={{ background: heatColor(p) }} />
              ))}
              <span>More</span>
            </div>
          </>
        )}
      </div>

      <div>
        <p className="an-canvas-title">Habit completion ({range.label})</p>
        {habitRates.length === 0 ? (
          <ChartFrame empty emptySentence="No habits yet." />
        ) : (
          <>
            <StudioBars rows={habitRates} max={100} />
            <OpenInListsButton habits />
          </>
        )}
      </div>

      {habitPctSeries.length >= 3 && (
        <div>
          <p className="an-canvas-title">Habit % lag</p>
          <PhosphorTrace
            title="Daily habit completion percent"
            points={habitPctSeries.map((p) => ({ x: p.date.slice(5), y: p.value }))}
            unit="%"
          />
          <p className="an-canvas-hint">
            Autocorrelation of this series: r(1) = {habitR1.toFixed(2)} (next day), r(7) = {habitR7.toFixed(2)} (a
            week later). Pearson of the series against itself — not a weekly grade.
          </p>
        </div>
      )}

      {habitPctSeries.length > 0 && (
        <HorizonChart
          values={habitPctSeries.map((p) => p.value)}
          labels={habitPctSeries.map((p) => p.date)}
          title="Horizon · daily %"
          help="Horizon chart (Reijner; Heer & van Wijk 2009): three folded bands of 0–33 / 33–66 / 66–100% daily habit completion. Darker overlap is a higher day. Space-efficient small-multiples of one series."
          empty="No habit % series in this window."
        />
      )}

      {slopes.length > 0 && (
        <Slopegraph
          rows={slopes}
          leftLabel="Weekday"
          rightLabel="Weekend"
          title="Weekday vs weekend"
          help="Tufte slopegraph: each habit's completion rate Mon–Fri versus Sat–Sun in this window. Days with no log count as unmet. Teal rises on weekends; maroon falls."
          empty="No habits to slope."
        />
      )}
    </div>
  )
}
