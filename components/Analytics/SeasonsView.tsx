/**
 * components/Analytics/SeasonsView.tsx — Life by season
 *
 * Four calendar quarters, named Spring / Summer / Fall / Winter.
 * This year and last year sit side by side: completions, points, and
 * quarter rituals. Season goals (period kind Season) are listed once.
 */
"use client"

import { useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { usePointsStore } from "@/lib/points-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useGoalsStore } from "@/lib/goals-store"
import { getTaskCompletionDate } from "@/lib/completion-status"
import { goalProgressPercent } from "@/lib/objectives"
import { parseLocalDate } from "@/lib/date-utils"
import {
  SEASON_BY_QUARTER,
  SEASON_ORDER,
  SEASON_STYLE,
  quarterKey,
  quarterLabel,
  seasonOfDate,
  seasonSlug,
  type SeasonName,
} from "@/lib/seasons"
import { CanvasTitle, StudioReadout, StudioSelect } from "./studio-kit"
import { MirrorSplit, round1 } from "./behavior-kit"

type Measure = "completions" | "points" | "reviews"
const MEASURE_LABEL: Record<Measure, string> = {
  completions: "Completions",
  points: "Points",
  reviews: "Season rituals",
}

/** Two-ring wheel: one wedge per season, inner ring last year, outer this year. Radius ∝ √value. */
function SeasonWheel({ last, now, year }: { last: Record<string, number>; now: Record<string, number>; year: number }) {
  const max = Math.max(1, ...Object.values(last), ...Object.values(now))
  const C = 150
  const arc = (i: number, r0: number, r1: number) => {
    const a0 = (i * Math.PI) / 2 - Math.PI / 2 + 0.03
    const a1 = ((i + 1) * Math.PI) / 2 - Math.PI / 2 - 0.03
    const p = (r: number, a: number) => `${C + r * Math.cos(a)} ${C + r * Math.sin(a)}`
    return `M ${p(r0, a0)} L ${p(r1, a0)} A ${r1} ${r1} 0 0 1 ${p(r1, a1)} L ${p(r0, a1)} A ${r0} ${r0} 0 0 0 ${p(r0, a0)} Z`
  }
  const inner = (v: number) => 24 + Math.sqrt(v / max) * 56
  const outer = (v: number) => 84 + Math.sqrt(v / max) * 60
  return (
    <div className="an-plot-well an-wheel">
      <svg viewBox="0 0 300 300" role="img" aria-label={`Seasons wheel, ${year - 1} inside and ${year} outside`}>
        <circle cx={C} cy={C} r={82} fill="none" stroke="#d0d0d0" />
        {SEASON_ORDER.map((season, i) => {
          const st = SEASON_STYLE[season]
          const mid = ((i + 0.5) * Math.PI) / 2 - Math.PI / 2
          return (
            <g key={season}>
              <path d={arc(i, 20, inner(last[season] ?? 0))} fill={st.wash} stroke={st.accent}>
                <title>{`${season} ${year - 1}: ${last[season] ?? 0}`}</title>
              </path>
              <path d={arc(i, 84, outer(now[season] ?? 0))} fill={st.accent} fillOpacity={0.85}>
                <title>{`${season} ${year}: ${now[season] ?? 0}`}</title>
              </path>
              <text
                x={C + 136 * Math.cos(mid)}
                y={C + 136 * Math.sin(mid) + 4}
                textAnchor="middle"
                fontSize="11"
                fontWeight={700}
                fill={st.ink}
              >
                {season}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

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
      const next: SeasonStat = {
        key,
        season,
        completions: 0,
        points: 0,
        reviews: 0,
      }
      map.set(key, next)
      return next
    }
    for (const y of [year - 1, year]) {
      for (const key of yearQuarters(y)) {
        const q = Number(key.slice(-1)) as 1 | 2 | 3 | 4
        const season = SEASON_BY_QUARTER[q]
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

  const [measure, setMeasure] = useState<Measure>("completions")
  const perSeason = (y: number) =>
    Object.fromEntries(yearQuarters(y).map((key) => [byKey.get(key)!.season, byKey.get(key)![measure]]))
  const lastYear = perSeason(year - 1)
  const thisYear = perSeason(year)
  const mirrorRows = SEASON_ORDER.map((season) => ({
    id: season,
    name: season,
    left: lastYear[season] ?? 0,
    right: thisYear[season] ?? 0,
  }))

  // Pace: where the current quarter is heading at its rate so far.
  const pace = useMemo(() => {
    const now = new Date()
    const q = Math.floor(now.getMonth() / 3)
    const start = new Date(now.getFullYear(), q * 3, 1)
    const end = new Date(now.getFullYear(), q * 3 + 3, 1)
    const DAY = 86_400_000
    const total = Math.round((end.getTime() - start.getTime()) / DAY)
    const elapsed = Math.max(1, Math.ceil((now.getTime() - start.getTime()) / DAY))
    const sofar = byKey.get(nowKey)?.[measure] ?? 0
    const lastKey = `${year - 1}-Q${q + 1}`
    const lastTotal = byKey.get(lastKey)?.[measure] ?? 0
    return {
      total,
      elapsed,
      sofar,
      projected: (sofar / elapsed) * total,
      lastTotal,
    }
  }, [byKey, nowKey, measure, year])

  const sortedGoals = seasonGoals
    .map((goal) => ({ goal, pct: Math.round(goalProgressPercent(goal)) }))
    .sort((a, b) => b.pct - a.pct)

  const renderYear = (y: number) => (
    <div className="season-year">
      <p className="an-canvas-title">{y}</p>
      <div className="season-grid">
        {yearQuarters(y).map((key) => {
          const stat = byKey.get(key)
          const season = stat?.season ?? seasonOfDate(new Date(y, (Number(key.slice(-1)) - 1) * 3, 1))
          return (
            <article
              key={key}
              className="season-card"
              data-season={seasonSlug(season)}
              data-current={key === nowKey ? "true" : "false"}
            >
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
            Calendar quarters · {quarterLabel(nowKey)} is now. Counts are this year and last year, not the shared
            window.
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
      {renderYear(year)}
      {renderYear(year - 1)}

      <div className="an-bx-tools">
        <StudioSelect label="Measure" value={measure} onChange={(v) => setMeasure(v as Measure)}>
          {(Object.keys(MEASURE_LABEL) as Measure[]).map((m) => (
            <option key={m} value={m}>
              {MEASURE_LABEL[m]}
            </option>
          ))}
        </StudioSelect>
      </div>
      <div className="an-bx-two">
        <section className="an-plate" data-testid="seasons-mirror">
          <CanvasTitle
            title={`${year - 1} vs ${year}`}
            help="Last year grows left, this year grows right, from the season names. The orange side is the bigger year."
          />
          <MirrorSplit
            rows={mirrorRows}
            leftLabel={String(year - 1)}
            rightLabel={String(year)}
            format={(v) => String(Math.round(v))}
          />
          <p className="an-n">
            Total {MEASURE_LABEL[measure].toLowerCase()}: {Math.round(mirrorRows.reduce((a, r) => a + r.left, 0))} →{" "}
            {Math.round(mirrorRows.reduce((a, r) => a + r.right, 0))}
          </p>
        </section>
        <section className="an-plate" data-testid="seasons-wheel">
          <CanvasTitle
            title="Season wheel"
            help="Each quarter of the circle is a season. Pale inner wedge = last year, solid outer wedge = this year. Wedge depth grows with the square root of the count, so area tracks the amount."
          />
          <SeasonWheel last={lastYear} now={thisYear} year={year} />
          <p className="an-bx-legend">
            <span>
              <i style={{ background: "#e3eef6", boxShadow: "inset 0 0 0 1px #4a7eaa" }} />
              Inner: {year - 1}
            </span>
            <span>
              <i style={{ background: "#4a7eaa" }} />
              Outer: {year}
            </span>
          </p>
        </section>
      </div>

      <section className="an-plate" data-testid="seasons-pace">
        <CanvasTitle
          title={`${quarterLabel(nowKey)} pace`}
          help="Straight-line projection: so far ÷ days elapsed × days in the quarter. The black tick is the same quarter last year."
        />
        <div className="an-readouts">
          <StudioReadout label="So far" value={Math.round(pace.sofar)} note={`day ${pace.elapsed} of ${pace.total}`} />
          <StudioReadout label="Projected" value={`~${Math.round(pace.projected)}`} note="at this rate" />
          <StudioReadout
            label="Last year"
            value={Math.round(pace.lastTotal)}
            note={
              pace.lastTotal
                ? `${pace.projected >= pace.lastTotal ? "+" : ""}${round1(((pace.projected - pace.lastTotal) / pace.lastTotal) * 100)}% projected`
                : "no data"
            }
          />
        </div>
        <span className="an-meter" aria-hidden>
          <span
            style={{
              width: `${Math.min(100, (pace.sofar / Math.max(1, pace.projected, pace.lastTotal)) * 100)}%`,
            }}
          />
          {pace.lastTotal > 0 && (
            <i
              style={{
                left: `${Math.min(100, (pace.lastTotal / Math.max(1, pace.projected, pace.lastTotal)) * 100)}%`,
              }}
            />
          )}
        </span>
        <p className="an-caveat">A straight line. Quarters rarely run evenly, so early projections swing.</p>
      </section>

      <p className="an-canvas-title">Season goals</p>
      {seasonGoals.length === 0 ? (
        <p className="an-n">No goals with period Season yet. Add one on Home → Goals.</p>
      ) : (
        <ul className="an-list">
          {sortedGoals.map(({ goal, pct }) => (
            <li key={goal.id} className="an-list-row" style={{ cursor: "default" }}>
              <span className="truncate" style={{ flex: 1 }}>
                {goal.title}
              </span>
              <span className="an-meter" style={{ width: 120 }} aria-hidden>
                <span style={{ width: `${Math.min(100, pct)}%` }} />
              </span>
              <span className="an-n" style={{ minWidth: "3em", textAlign: "right" }}>
                {pct}%
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
