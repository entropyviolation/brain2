/**
 * components/Analytics/StreaksWidget.tsx — Streaks (Brain2 §8b / §9.5)
 *
 * Current + longest streaks for habits and the daily review ritual. Not
 * clipped to the Analytics window. Home glance stays on Home.
 */
"use client"

import { useMemo, useState } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { isHabitPeriodExempt, streakSkippingExemptDays } from "@/lib/habit-exemption"
import { useExemptionContext } from "@/lib/sleep-store"
import { computeStreak, type StreakResult } from "@/lib/streaks"
import { formatLocalDateKey, parseLocalDate, getWeekStartDate } from "@/lib/date-utils"
import { habitWeekStreakSummary } from "@/lib/habit-week-streaks"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { StudioBars, StudioHelp, StudioReadout } from "./studio-kit"
import { runContinuation, runsOver, type DayMark, type Run } from "./behavior-stats"
import "./behavior-views.css"

const FOLD = 8

/** Every local day key from `first` through today. */
function daysThrough(first: string | undefined, today: Date): string[] {
  const start = first ? parseLocalDate(first) : null
  if (!start) return []
  const out: string[] = []
  const d = new Date(start)
  const end = formatLocalDateKey(today)
  for (let guard = 0; guard < 4000; guard++) {
    const key = formatLocalDateKey(d)
    out.push(key)
    if (key >= end) break
    d.setDate(d.getDate() + 1)
  }
  return out
}

interface StreakRow {
  id: string
  name: string
  streak: StreakResult
  week: { current: number; longest: number }
}

export function StreaksWidget() {
  const habitTasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const exemptionCtx = useExemptionContext()
  const reviews = useReviewsStore((s) => s.reviews)
  const todayKey = formatLocalDateKey(new Date())
  // Keyed on the day so the memos below do not rerun every render.
  const weekStart = useMemo(() => getWeekStartDate(parseLocalDate(todayKey) ?? new Date()), [todayKey])
  const [spanDays, setSpanDays] = useState(90)
  const [showAllEras, setShowAllEras] = useState(false)
  const [showAllRows, setShowAllRows] = useState(false)

  const habitStreaks = useMemo<StreakRow[]>(() => {
    return habitTasks
      .map((task) => {
        const dates: string[] = []
        const exempt = (dateKey: string) => isHabitPeriodExempt(task, dateKey, "daily", habitExemptions, exemptionCtx)
        for (const dateKey of Object.keys(weeklyData)) {
          if (exempt(dateKey)) continue
          const completion = weeklyData[dateKey]?.[task.id]
          if (completion && isHabitGoalMet(task, completion, { date: parseLocalDate(dateKey) ?? undefined, weeklyData })) {
            dates.push(dateKey)
          }
        }
        const run = streakSkippingExemptDays(dates, exempt, new Date())
        return {
          id: task.id,
          name: task.name,
          streak: { ...computeStreak(dates, { unit: "day" }), current: run.current, longest: run.longest },
          week: habitWeekStreakSummary(task, weeklyData, weekStart, new Date(), exempt),
        }
      })
      .sort((a, b) => b.streak.current - a.streak.current || b.streak.longest - a.streak.longest)
  }, [habitTasks, weeklyData, habitExemptions, exemptionCtx, weekStart])

  const reviewStreak = useMemo<StreakResult>(() => {
    const dayKeys = reviews.filter((r) => r.period === "day").map((r) => r.periodKey)
    return computeStreak(dayKeys, { unit: "day" })
  }, [reviews])

  // Every run, all time, per habit. Exempt days bridge a run, as on Home.
  const eras = useMemo(() => {
    const days = daysThrough(Object.keys(weeklyData).sort()[0], new Date())
    return habitTasks
      .map((task) => {
        const markOf = (key: string): DayMark => {
          if (isHabitPeriodExempt(task, key, "daily", habitExemptions, exemptionCtx)) return "exempt"
          const c = weeklyData[key]?.[task.id]
          if (!c) return "missed"
          return isHabitGoalMet(task, c, { date: parseLocalDate(key) ?? undefined, weeklyData }) ? "met" : "partial"
        }
        const runs = runsOver(days, markOf)
        const best = runs.reduce<Run | null>((b, r) => (!b || r.length > b.length ? r : b), null)
        return { id: task.id, name: task.name, runs, best }
      })
      .filter((e) => e.runs.length > 0)
      .sort((a, b) => (b.best?.length ?? 0) - (a.best?.length ?? 0) || a.name.localeCompare(b.name))
  }, [habitTasks, weeklyData, habitExemptions, exemptionCtx, todayKey])
  const allRuns = useMemo(() => eras.flatMap((e) => e.runs), [eras])
  const continuation = useMemo(() => runContinuation(allRuns, 10), [allRuns])
  const spanStart = useMemo(() => {
    const d = parseLocalDate(todayKey) ?? new Date()
    d.setDate(d.getDate() - (spanDays - 1))
    return d
  }, [todayKey, spanDays])
  const spanStartKey = formatLocalDateKey(spanStart)
  const dayIndex = (key: string) => {
    const d = parseLocalDate(key)
    return d ? Math.round((d.getTime() - spanStart.getTime()) / 86_400_000) : 0
  }
  const eraMax = Math.max(1, ...eras.map((e) => e.best?.length ?? 0))
  const ghostMax = Math.max(1, ...habitStreaks.map((r) => r.streak.longest))
  const weakest = continuation
    .filter((c) => c.goOn !== null && c.atRisk >= 3)
    .reduce<(typeof continuation)[number] | null>((w, c) => (!w || (c.goOn ?? 1) < (w.goOn ?? 1) ? c : w), null)
  const meanRun = allRuns.length ? allRuns.reduce((s, r) => s + r.length, 0) / allRuns.length : 0

  const topHabitStreak = habitStreaks[0]?.streak.current ?? 0

  return (
    <div className="an-canvas an-stack">
      <div className="an-readouts">
        <StudioReadout label="Best active habit streak" value={topHabitStreak} />
        <StudioReadout label="Daily review streak" value={reviewStreak.current} note={`best ${reviewStreak.longest}`} />
      </div>

      <p className="an-canvas-title">Habit streaks</p>
      {habitStreaks.length === 0 ? (
        <ChartFrame empty emptySentence="No habits yet. Streaks are current runs, not limited to the Analytics window." />
      ) : (
        <>
          <ul className="an-list">
            {(showAllRows ? habitStreaks : habitStreaks.slice(0, FOLD)).map((row) => (
              <li key={row.id} className="an-list-row">
                <span className="truncate">{row.name}</span>
                <span className="an-n">
                  {row.streak.current} now · best {row.streak.longest}
                  {row.week.current > 0 ? ` · ${row.week.current} week streak` : ""}
                </span>
              </li>
            ))}
          </ul>
          {habitStreaks.length > FOLD ? (
            <button type="button" className="an-bv-fold" onClick={() => setShowAllRows((v) => !v)}>
              {showAllRows ? "Show top 8" : `Show all ${habitStreaks.length}`}
            </button>
          ) : null}
          <OpenInListsButton habits />
        </>
      )}

      {habitStreaks.length > 0 && (
        <div data-testid="streak-ghost-bars">
          <p className="an-canvas-title an-canvas-title-row">
            Now against best
            <StudioHelp text="Each habit's current run (solid) over its all-time longest (dashed ghost). The gap is how far the record is." />
          </p>
          <div className="an-barcode">
            {habitStreaks.slice(0, showAllEras ? undefined : FOLD).map((row) => (
              <div key={row.id} className="an-barcode-row is-wide">
                <span className="an-barcode-name" title={row.name}>{row.name}</span>
                <span className="an-ghost-track">
                  <span className="an-ghost-best" style={{ width: `${(row.streak.longest / ghostMax) * 100}%` }} />
                  <span className="an-ghost-now" style={{ width: `${(row.streak.current / ghostMax) * 100}%` }} />
                </span>
                <span className="an-barcode-rate">
                  {row.streak.longest > 0 && row.streak.current >= row.streak.longest ? "record" : `${row.streak.longest - row.streak.current} to go`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {eras.length > 0 && (
        <div data-testid="streak-eras">
          <p className="an-canvas-title an-canvas-title-row">
            Era bars
            <StudioHelp text="Every run on the calendar, one row per habit. Height is the run's length against the longest run of any habit. Black is that habit's record. An amber edge means the run is still going. Hover for start and end." />
          </p>
          <div className="an-bv-tools">
            <label className="an-bv-slider">
              Last
              <input type="range" min={14} max={365} step={7} value={spanDays} onChange={(e) => setSpanDays(Number(e.target.value))} />
              <output>{spanDays} d</output>
            </label>
            <span className="an-n">
              {allRuns.length} runs · mean {meanRun.toFixed(1)} d
            </span>
          </div>
          {eras.slice(0, showAllEras ? undefined : FOLD).map((e) => (
            <div key={e.id} className="an-era-row">
              <span className="an-barcode-name" title={e.name}>{e.name}</span>
              <span className="an-era-track">
                {e.runs
                  .filter((r) => r.end >= spanStartKey)
                  .map((r) => {
                    const a = Math.max(0, dayIndex(r.start))
                    const b = dayIndex(r.end) + 1
                    return (
                      <span
                        key={r.start}
                        className="an-era-span"
                        data-best={r === e.best}
                        data-open={r.open}
                        title={`${r.start} → ${r.end} · ${r.length} d${r.open ? " · still going" : ""}`}
                        style={{
                          left: `${(a / spanDays) * 100}%`,
                          width: `${((b - a) / spanDays) * 100}%`,
                          height: `${Math.max(12, (r.length / eraMax) * 100)}%`,
                        }}
                      />
                    )
                  })}
              </span>
              <span className="an-barcode-rate">best {e.best?.length ?? 0}</span>
            </div>
          ))}
          <div className="an-era-row" aria-hidden>
            <span />
            <span className="an-era-axis">
              <span>{spanStartKey}</span>
              <span>{todayKey}</span>
            </span>
            <span />
          </div>
          {Math.max(eras.length, habitStreaks.length) > FOLD ? (
            <button type="button" className="an-bv-fold" onClick={() => setShowAllEras((v) => !v)}>
              {showAllEras ? "Show top 8" : `Show all ${Math.max(eras.length, habitStreaks.length)}`}
            </button>
          ) : null}
        </div>
      )}

      {continuation.length > 1 && (
        <div data-testid="streak-continuation">
          <p className="an-canvas-title an-canvas-title-row">
            Odds a run goes on
            <StudioHelp text="Pooled over every habit, all time. For runs that reached k days: the share that made it to k + 1. Runs still going count as at risk but never as broken (Kaplan–Meier style). Low n at high k is noisy." />
          </p>
          <StudioBars
            rows={continuation
              .filter((c) => c.goOn !== null)
              .map((c) => ({ name: `day ${c.k} → ${c.k + 1} (n=${c.atRisk})`, value: Math.round((c.goOn ?? 0) * 100) }))}
            max={100}
          />
          {weakest ? (
            <p className="an-canvas-hint">
              Runs break most often after day {weakest.k}: {Math.round((weakest.goOn ?? 0) * 100)}% go on (n={weakest.atRisk}).
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default StreaksWidget
