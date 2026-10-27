/**
 * components/Analytics/HabitsView.tsx — Habit density, rates, grades, Good days
 */
"use client"

import { useMemo, useState } from "react"
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
import { formatCrtNumber } from "@/lib/crt-number"
import { DensityCalendar, PhosphorTrace, StudioBars, StudioHelp, StudioReadout, StudioSelect } from "./studio-kit"
import { HorizonChart, Slopegraph } from "./studio-plots"
import { weekdayWeekendRates } from "./studio-plot-stats"
import { autocorrelation } from "@/lib/metrics"
import { biggestMoves, projectRate, type DayMark } from "./behavior-stats"
import { StudioCheck } from "./studio-kit"
import "./behavior-views.css"

const FOLD = 8
const MARK_LABEL: Record<DayMark, string> = { met: "done", partial: "partial", missed: "missed", exempt: "exempt" }

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
  const [partialCounts, setPartialCounts] = useState(false)
  const [barcodeSort, setBarcodeSort] = useState<"rate" | "slip" | "name">("rate")
  const [barcodeQuery, setBarcodeQuery] = useState("")
  const [showAllRates, setShowAllRates] = useState(false)
  const [showAllStrips, setShowAllStrips] = useState(false)
  const [showAllSlopes, setShowAllSlopes] = useState(false)
  // One mark per habit per window day: the barcode, the moves and the projection share it.
  const marks = useMemo(() => {
    return habitTasks.map((task) => {
      const row: DayMark[] = range.dateKeys.map((key) => {
        if (isHabitPeriodExempt(task, key, "daily", habitExemptions, exemptionCtx)) return "exempt"
        const c = weeklyData[key]?.[task.id]
        if (!c) return "missed"
        return isHabitGoalMet(task, c, { date: parseLocalDate(key) ?? undefined, weeklyData }) ? "met" : "partial"
      })
      return { id: task.id, name: task.name, row }
    })
  }, [habitTasks, weeklyData, habitExemptions, exemptionCtx, range.dateKeys])
  const strips = useMemo(() => {
    const q = barcodeQuery.trim().toLowerCase()
    return marks
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .map((m) => {
        const counted = m.row.filter((x) => x !== "exempt")
        const done = counted.filter((x) => x === "met" || (partialCounts && x === "partial")).length
        let lastSlip = -1
        m.row.forEach((x, i) => {
          if (x === "missed" || (!partialCounts && x === "partial")) lastSlip = i
        })
        return { ...m, done, required: counted.length, rate: counted.length ? done / counted.length : 0, lastSlip }
      })
      .sort((a, b) =>
        barcodeSort === "name"
          ? a.name.localeCompare(b.name)
          : barcodeSort === "slip"
            ? b.lastSlip - a.lastSlip || a.rate - b.rate
            : b.rate - a.rate || a.name.localeCompare(b.name),
      )
  }, [marks, barcodeQuery, barcodeSort, partialCounts])
  const totals = useMemo(() => {
    let done = 0
    let required = 0
    for (const m of marks)
      for (const x of m.row) {
        if (x === "exempt") continue
        required++
        if (x === "met") done++
      }
    // Last 7 window days, the default for the projection's rate.
    let doneRecent = 0
    let reqRecent = 0
    const from = Math.max(0, range.dateKeys.length - 7)
    for (const m of marks)
      for (let i = from; i < m.row.length; i++) {
        if (m.row[i] === "exempt") continue
        reqRecent++
        if (m.row[i] === "met") doneRecent++
      }
    return {
      done,
      required,
      perDay: range.dateKeys.length ? required / range.dateKeys.length : 0,
      recentPct: reqRecent ? Math.round((doneRecent / reqRecent) * 100) : 0,
    }
  }, [marks, range.dateKeys.length])
  const nowPct = totals.required ? Math.round((totals.done / totals.required) * 100) : 0
  const [projRate, setProjRate] = useState<number | null>(null)
  const [projDays, setProjDays] = useState(14)
  const [projTarget, setProjTarget] = useState<number | null>(null)
  const rateIn = projRate ?? totals.recentPct
  const targetIn = projTarget ?? Math.min(99, Math.max(50, nowPct + 10))
  const projection = projectRate(totals.done, totals.required, totals.perDay, rateIn / 100, projDays, targetIn / 100)
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
  const moves = useMemo(() => {
    const m = biggestMoves(habitPctSeries.map((p) => p.value), 3)
    const flipped = (i: number, up: boolean) =>
      marks
        .filter((h) => (up ? h.row[i] === "met" && h.row[i - 1] !== "met" : h.row[i] !== "met" && h.row[i - 1] === "met"))
        .map((h) => h.name)
    const tag = (d: { i: number; delta: number }, up: boolean) => ({ ...d, date: habitPctSeries[d.i]?.date ?? "", habits: flipped(d.i, up) })
    return [...m.rises.map((d) => tag(d, true)), ...m.falls.map((d) => tag(d, false))]
  }, [habitPctSeries, marks])
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
      <div>
        <p className="an-canvas-title an-canvas-title-row">
          Daily habit completion
          <StudioHelp text="Density calendar of daily habit % in this window. Gray is out of range or empty. Lead instrument — readouts and rates sit under it." />
        </p>
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
            value={`${formatCrtNumber(weekGrade.grade)}%`}
            note={`raw ${formatCrtNumber(weekGrade.rawGrade)}% · ${weekGrade.daysIncluded} days`}
          />
          <StudioReadout
            label="Good-day streak"
            value={goods.streak}
            note={`${goods.last30Count} in last 30 · threshold ${goods.threshold}%`}
          />
          <StudioReadout
            label="Month grade"
            value={`${formatCrtNumber(monthGrade.grade)}%`}
            note={`raw ${formatCrtNumber(monthGrade.rawGrade)}% · ${monthGrade.daysIncluded} days`}
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
          <StudioBars
            rows={climbs.map((c) => ({ name: c.unit ? `${c.name} (${c.unit.trim()})` : c.name, value: c.value }))}
            max={Math.max(...climbs.map((c) => c.value), 1)}
            unit=""
          />
        </div>
      )}

      <div>
        <p className="an-canvas-title">Habit completion ({range.label})</p>
        {habitRates.length === 0 ? (
          <ChartFrame empty emptySentence="No habits yet." />
        ) : (
          <>
            <StudioBars rows={showAllRates ? habitRates : habitRates.slice(0, FOLD)} max={100} />
            {habitRates.length > FOLD ? (
              <button type="button" className="an-bv-fold" onClick={() => setShowAllRates((v) => !v)}>
                {showAllRates ? "Show top 8" : `Show all ${habitRates.length}`}
              </button>
            ) : null}
            <OpenInListsButton habits />
          </>
        )}
      </div>

      {marks.length > 0 && range.dateKeys.length > 0 && (
        <div data-testid="habit-barcode">
          <p className="an-canvas-title an-canvas-title-row">
            Truth barcode
            <StudioHelp text="One strip per habit, one cell per day in the window. Dark is done, pale is logged but short of the goal, gray is missed, hatched is exempt. Exempt days do not count toward the rate." />
          </p>
          <div className="an-bv-tools">
            <input
              type="search"
              placeholder="Filter habits"
              aria-label="Filter habits"
              value={barcodeQuery}
              onChange={(e) => setBarcodeQuery(e.target.value)}
            />
            <StudioSelect label="Sort" value={barcodeSort} onChange={(v) => setBarcodeSort(v as typeof barcodeSort)}>
              <option value="rate">By rate</option>
              <option value="slip">By latest slip</option>
              <option value="name">By name</option>
            </StudioSelect>
            <StudioCheck id="habit-barcode-partial" checked={partialCounts} onChange={setPartialCounts}>
              Count partial as done
            </StudioCheck>
            <span className="an-n">n={strips.length} · {range.dateKeys.length} days</span>
          </div>
          <div className="an-barcode">
            {(showAllStrips ? strips : strips.slice(0, FOLD)).map((s) => (
              <div key={s.id} className="an-barcode-row">
                <span className="an-barcode-name" title={s.name}>{s.name}</span>
                <span className="an-barcode-strip" aria-label={`${s.name}: ${s.done} of ${s.required} days`}>
                  {s.row.map((x, i) => {
                    const shown = partialCounts && x === "partial" ? "met" : x
                    return <i key={i} className={`an-barcode-cell an-mark-${shown}`} title={`${range.dateKeys[i]}: ${MARK_LABEL[x]}`} />
                  })}
                </span>
                <span className="an-barcode-rate">{Math.round(s.rate * 100)}%</span>
              </div>
            ))}
          </div>
          {strips.length > FOLD ? (
            <button type="button" className="an-bv-fold" onClick={() => setShowAllStrips((v) => !v)}>
              {showAllStrips ? "Show top 8" : `Show all ${strips.length}`}
            </button>
          ) : null}
          <div className="an-bv-key">
            {(["met", "partial", "missed", "exempt"] as const).map((m) => (
              <span key={m}>
                <i className={`an-mark-${m}`} />
                {MARK_LABEL[m]}
              </span>
            ))}
          </div>
        </div>
      )}

      {totals.required > 0 && (
        <div data-testid="habit-projection">
          <p className="an-canvas-title an-canvas-title-row">
            If I keep this up
            <StudioHelp text="Projects the window's done rate (all habits, exempt days left out) forward. New rate = (done + r·s·N) / (required + s·N), where s is habit slots per day. Perfect days to target = ⌈(T·required − done) / (s·(1 − T))⌉." />
          </p>
          <div className="an-bv-tools">
            <label className="an-bv-slider">
              Rate
              <input type="range" min={0} max={100} value={rateIn} onChange={(e) => setProjRate(Number(e.target.value))} />
              <output>{rateIn}%</output>
            </label>
            <label className="an-bv-slider">
              For
              <input type="range" min={1} max={90} value={projDays} onChange={(e) => setProjDays(Number(e.target.value))} />
              <output>{projDays} d</output>
            </label>
            <label className="an-bv-slider">
              Target
              <input type="range" min={50} max={99} value={targetIn} onChange={(e) => setProjTarget(Number(e.target.value))} />
              <output>{targetIn}%</output>
            </label>
          </div>
          <div className="an-readouts">
            <StudioReadout label="Now" value={`${nowPct}%`} note={`${totals.done}/${totals.required} slots`} />
            <StudioReadout label={`After ${projDays} days`} value={`${Math.round(projection.projected * 100)}%`} note={projRate === null ? `at last 7 days' ${rateIn}%` : `at ${rateIn}% a day`} />
            <StudioReadout
              label={`Perfect days to ${targetIn}%`}
              value={projection.perfectDays === null ? "—" : projection.perfectDays}
              note={projection.perfectDays === null ? "already there" : `${totals.perDay.toFixed(1)} slots a day`}
            />
          </div>
        </div>
      )}

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
          {moves.length > 0 && (
            <ul className="an-bv-moves" aria-label="Biggest day-to-day moves">
              {moves.map((m) => (
                <li key={`${m.date}-${m.delta}`}>
                  <b>{m.delta > 0 ? "▲" : "▼"} {Math.round(Math.abs(m.delta))} pp</b> {m.date}
                  {m.habits.length ? ` · ${m.habits.slice(0, 2).join(", ")}${m.habits.length > 2 ? ` and ${m.habits.length - 2} more` : ""}` : ""}
                </li>
              ))}
            </ul>
          )}
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
        <div>
        <Slopegraph
          rows={showAllSlopes ? slopes : slopes.slice(0, FOLD)}
          leftLabel="Weekday"
          rightLabel="Weekend"
          title="Weekday vs weekend"
          help="Tufte slopegraph: each habit's completion rate Mon–Fri versus Sat–Sun in this window. Days with no log count as unmet. Teal rises on weekends; maroon falls."
          empty="No habits to slope."
        />
          {slopes.length > FOLD ? (
            <button type="button" className="an-bv-fold" onClick={() => setShowAllSlopes((v) => !v)}>
              {showAllSlopes ? "Show the 8 biggest gaps" : `Show all ${slopes.length}`}
            </button>
          ) : null}
        </div>
      )}
    </div>
  )
}
