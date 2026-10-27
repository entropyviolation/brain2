/**
 * components/Analytics/SeasonsView.tsx — Life by season
 *
 * Four calendar quarters, named Spring / Summer / Fall / Winter.
 * This year and last year sit side by side: completions, points, and
 * quarter rituals. Season goals (period kind Season) are listed once.
 */
"use client"

import { useMemo } from "react"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useGoalsStore } from "@/lib/goals-store"
import { getTaskCompletionDate } from "@/lib/completion-status"
import { goalProgressPercent } from "@/lib/objectives"
import { parseLocalDate } from "@/lib/date-utils"
import {
  SEASON_ORDER,
  quarterKey,
  quarterLabel,
  seasonOfDate,
  seasonSlug,
  type SeasonName,
} from "@/lib/seasons"
import { StudioReadout } from "./studio-kit"

interface SeasonStat {
  key: string
  season: SeasonName
  completions: number
  points: number
  reviews: number
}

function yearQuarters(year: number): string[] {
  return [1, 2, 3, 4].map((q) => `${year}-Q${q}`)
}

export function SeasonsView() {
  const tasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const reviews = useReviewsStore((s) => s.reviews)
  const goals = useGoalsStore((s) => s.goals)
  const year = new Date().getFullYear()

  const byKey = useMemo(() => {
    const map = new Map<string, SeasonStat>()
    const ensure = (key: string, season: SeasonName) => {
      const row = map.get(key)
      if (row) return row
      const next: SeasonStat = { key, season, completions: 0, points: 0, reviews: 0 }
      map.set(key, next)
      return next
    }
    for (const y of [year - 1, year]) {
      for (const key of yearQuarters(y)) {
        const q = Number(key.slice(-1)) as 1 | 2 | 3 | 4
        const season = (["Spring", "Summer", "Fall", "Winter"] as const)[q - 1]
        ensure(key, season)
      }
    }
    for (const task of tasks) {
      const done = getTaskCompletionDate(task)
      if (!done) continue
      const key = quarterKey(done)
      const row = map.get(key)
      if (row) row.completions += 1
    }
    for (const entry of pointsHistory) {
      const date = parseLocalDate(entry.date)
      if (!date) continue
      const row = map.get(quarterKey(date))
      if (row) row.points += entry.points || 0
    }
    for (const review of reviews) {
      if (review.period !== "quarter") continue
      const row = map.get(review.periodKey)
      if (row) row.reviews += 1
    }
    return map
  }, [tasks, pointsHistory, reviews, year])

  const climate = useMemo(() => {
    const totals: Record<SeasonName, { completions: number; points: number; reviews: number }> = {
      Spring: { completions: 0, points: 0, reviews: 0 },
      Summer: { completions: 0, points: 0, reviews: 0 },
      Fall: { completions: 0, points: 0, reviews: 0 },
      Winter: { completions: 0, points: 0, reviews: 0 },
    }
    for (const row of byKey.values()) {
      totals[row.season].completions += row.completions
      totals[row.season].points += row.points
      totals[row.season].reviews += row.reviews
    }
    return totals
  }, [byKey])

  const seasonGoals = goals.filter((g) => g.periodKind === "quarter")
  const nowKey = quarterKey(new Date())

  const YearRow = ({ y }: { y: number }) => (
    <div className="season-year">
      <p className="an-canvas-title">{y}</p>
      <div className="season-grid">
        {yearQuarters(y).map((key) => {
          const stat = byKey.get(key)
          const season = stat?.season ?? seasonOfDate(new Date(y, (Number(key.slice(-1)) - 1) * 3, 1))
          return (
            <article key={key} className="season-card" data-season={seasonSlug(season)} data-current={key === nowKey ? "true" : "false"}>
              <header>{quarterLabel(key)}</header>
              <StudioReadout label="Completions" value={stat?.completions ?? 0} />
              <StudioReadout label="Points" value={stat?.points ?? 0} />
              <StudioReadout label="Season rituals" value={stat?.reviews ?? 0} />
            </article>
          )
        })}
      </div>
    </div>
  )

  return (
    <div className="an-canvas an-stack" data-testid="seasons-view">
      <header className="an-canvas-head">
        <div>
          <p className="an-canvas-title">Seasons</p>
          <p className="an-canvas-kicker">
            Calendar quarters · {quarterLabel(nowKey)} is now. Counts are this year and last year, not the shared window.
          </p>
        </div>
      </header>
      <p className="an-canvas-title">By season, both years</p>
      <div className="season-grid">
        {SEASON_ORDER.map((season) => (
          <article key={season} className="season-card" data-season={seasonSlug(season)}>
            <header>{season}</header>
            <StudioReadout label="Completions" value={climate[season].completions} />
            <StudioReadout label="Points" value={climate[season].points} />
            <StudioReadout label="Rituals" value={climate[season].reviews} />
          </article>
        ))}
      </div>
      <YearRow y={year} />
      <YearRow y={year - 1} />
      <p className="an-canvas-title">Season goals</p>
      {seasonGoals.length === 0 ? (
        <p className="an-n">No goals with period Season yet. Add one on Home → Goals.</p>
      ) : (
        <ul className="an-list">
          {seasonGoals.map((goal) => (
            <li key={goal.id} className="an-list-row">
              <span className="truncate">{goal.title}</span>
              <span className="an-n">{Math.round(goalProgressPercent(goal))}%</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
