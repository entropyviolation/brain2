/**
 * components/Analytics/StreaksWidget.tsx — Streaks (Brain2 §8b / §9.5)
 *
 * Current + longest streaks for habits and the daily review ritual. Not
 * clipped to the Analytics window. Home glance stays on Home.
 */
"use client"

import { useMemo } from "react"
import { useHabitsStore } from "@/lib/habits-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { isHabitGoalMet } from "@/lib/habit-utils"
import { isHabitPeriodExempt, streakSkippingExemptDays } from "@/lib/habit-exemption"
import { useExemptionContext } from "@/lib/sleep-store"
import { computeStreak, type StreakResult } from "@/lib/streaks"
import { parseLocalDate, getWeekStartDate } from "@/lib/date-utils"
import { habitWeekStreakSummary } from "@/lib/habit-week-streaks"
import { ChartFrame, OpenInListsButton } from "./chart-frame"
import { StudioReadout } from "./studio-kit"

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
  const weekStart = getWeekStartDate(new Date())

  const habitStreaks = useMemo<StreakRow[]>(() => {
    return habitTasks
      .map((task) => {
        const dates: string[] = []
        const exempt = (dateKey: string) => isHabitPeriodExempt(task, dateKey, "daily", habitExemptions)
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

  const topHabitStreak = habitStreaks[0]?.streak.current ?? 0

  return (
    <div className="an-canvas an-stack">
      <p className="an-canvas-kicker">Current and longest runs — not clipped to the Analytics date range.</p>
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
            {habitStreaks.map((row) => (
              <li key={row.id} className="an-list-row">
                <span className="truncate">{row.name}</span>
                <span className="an-n">
                  {row.streak.current} now · best {row.streak.longest}
                  {row.week.current > 0 ? ` · ${row.week.current} week streak` : ""}
                </span>
              </li>
            ))}
          </ul>
          <OpenInListsButton habits />
        </>
      )}
    </div>
  )
}

export default StreaksWidget
