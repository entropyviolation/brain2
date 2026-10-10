/**
 * components/Home/points-stats.tsx — Points wells for the Home overview strip
 *
 * Math is unchanged (ledger totals + possible-points fill). Overview wells
 * share one metal face and one CRT glass; detail adds sparkline trends.
 * `instrument` still packs all four for callers that want the set.
 */
"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Trophy, Target, Calendar, TrendingUp } from "lucide-react"
import { addCalendarDays } from "@/lib/date-utils"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useThemeStore } from "@/lib/theme-store"
import { HabitSlotGem } from "@/components/Home/Habits/habit-gems"
import type { HabitGemSlot } from "@/lib/habit-gems"
import { HOME_WIDGET_LABEL, homeInstrumentColorVars, type HomeWidgetId } from "@/lib/home-widgets"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"
import { cn } from "@/lib/utils"

interface PointsStatsProps {
  currentDate: Date
  /** Four phosphor wells instead of Cards. */
  instrument?: boolean
}

export type WellKind = "alltime" | "today" | "week" | "month"

const WELL_GEM: Record<WellKind, HabitGemSlot> = {
  alltime: "incremental",
  today: "goal",
  week: "boolean",
  month: "text",
}

export function useHomePoints(currentDate: Date) {
  const tasks = useTaskStore((s) => s.tasks)
  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const [mounted, setMounted] = useState(false)
  const [todayFlash, setTodayFlash] = useState(false)
  const prevDayPoints = useRef<number | null>(null)

  useEffect(() => setMounted(true), [])

  const getTotalPoints = usePointsStore((s) => s.getTotalPoints)
  const getDayPoints = usePointsStore((s) => s.getDayPoints)
  const getWeekPoints = usePointsStore((s) => s.getWeekPoints)
  const getMonthPoints = usePointsStore((s) => s.getMonthPoints)
  const getPossibleDayPoints = usePointsStore((s) => s.getPossibleDayPoints)
  const getPossibleWeekPoints = usePointsStore((s) => s.getPossibleWeekPoints)
  const getPossibleMonthPoints = usePointsStore((s) => s.getPossibleMonthPoints)

  const totalPoints = mounted ? getTotalPoints() : 0
  const dayPoints = mounted ? getDayPoints(currentDate) : 0
  const weekPoints = mounted ? getWeekPoints(currentDate) : 0
  const monthPoints = mounted ? getMonthPoints(currentDate) : 0

  const possibleDayPoints = mounted ? getPossibleDayPoints(currentDate, tasks) : 0
  const possibleWeekPoints = mounted ? getPossibleWeekPoints(currentDate, tasks) : 0
  const possibleMonthPoints = mounted ? getPossibleMonthPoints(currentDate, tasks) : 0

  const dayProgress = possibleDayPoints > 0 ? (dayPoints / (dayPoints + possibleDayPoints)) * 100 : 0
  const weekProgress = possibleWeekPoints > 0 ? (weekPoints / (weekPoints + possibleWeekPoints)) * 100 : 0
  const monthProgress = possibleMonthPoints > 0 ? (monthPoints / (monthPoints + possibleMonthPoints)) * 100 : 0

  void pointsHistory
  void weeklyData

  const fmt = (n: number) => (mounted ? n.toLocaleString() : "—")

  useEffect(() => {
    if (!mounted) return
    if (prevDayPoints.current !== null && prevDayPoints.current !== dayPoints) {
      setTodayFlash(true)
      const t = window.setTimeout(() => setTodayFlash(false), 360)
      prevDayPoints.current = dayPoints
      return () => window.clearTimeout(t)
    }
    prevDayPoints.current = dayPoints
  }, [dayPoints, mounted])

  return {
    todayFlash,
    alltime: { caption: "All Time Points", score: fmt(totalPoints), sub: "Total earned" as string | undefined, fill: undefined as number | undefined },
    today: {
      caption: "Today's Points",
      score: fmt(dayPoints),
      sub: mounted && possibleDayPoints > 0 ? `+${possibleDayPoints} possible` : undefined,
      fill: mounted && possibleDayPoints > 0 ? dayProgress : undefined,
    },
    week: {
      caption: "This Week",
      score: fmt(weekPoints),
      sub: mounted && possibleWeekPoints > 0 ? `+${possibleWeekPoints} possible` : undefined,
      fill: mounted && possibleWeekPoints > 0 ? weekProgress : undefined,
    },
    month: {
      caption: "This Month",
      score: fmt(monthPoints),
      sub: mounted && possibleMonthPoints > 0 ? `+${possibleMonthPoints} possible` : undefined,
      fill: mounted && possibleMonthPoints > 0 ? monthProgress : undefined,
    },
  }
}

const POINT_ROWS: { kind: WellKind; short: string }[] = [
  { kind: "alltime", short: "All time" },
  { kind: "today", short: "Today" },
  { kind: "week", short: "Week" },
  { kind: "month", short: "Month" },
]

function pointsSeries(currentDate: Date, days: number, getDayPoints: (d: Date) => number): number[] {
  const end = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate())
  const out: number[] = []
  for (let i = days - 1; i >= 0; i -= 1) {
    out.push(getDayPoints(addCalendarDays(end, -i)))
  }
  return out
}

function PointsSparkline({ values, label }: { values: number[]; label: string }) {
  const hasSignal = values.some((v) => v !== 0)
  if (!hasSignal) {
    return (
      <div className="home-widget-chart">
        <span className="home-widget-chart-label">{label}</span>
        <p className="home-widget-spark-empty">No points in this window yet.</p>
      </div>
    )
  }
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const span = max - min || 1
  const w = 320
  const h = 56
  const padT = 6
  const padB = 6
  const innerH = h - padT - padB
  const pts = values.map((v, i) => {
    const x = values.length === 1 ? w / 2 : (i / (values.length - 1)) * w
    const y = padT + innerH - ((v - min) / span) * innerH
    return { x, y }
  })
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ")
  const area = `${d} L ${pts[pts.length - 1]!.x.toFixed(1)} ${h - padB} L ${pts[0]!.x.toFixed(1)} ${h - padB} Z`
  return (
    <div className="home-widget-chart" role="img" aria-label={label}>
      <span className="home-widget-chart-label">{label}</span>
      <svg className="home-widget-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={56}>
        <path className="home-widget-spark-area" d={area} />
        <path className="home-widget-spark-line" d={d} />
      </svg>
    </div>
  )
}

/** One overview tile for all four point periods. */
export function PointsBoard({ currentDate, onHide }: { currentDate: Date; onHide: () => void }) {
  const points = useHomePoints(currentDate)
  const getDayPoints = usePointsStore((s) => s.getDayPoints)
  const percentLedTint = useHabitsStore((s) => s.percentLedTint)
  const gradeTubeColor = useHabitsStore((s) => s.gradeTubeColor)
  const outputGradeTubeColor = useHabitsStore((s) => s.outputGradeTubeColor)
  const colorVars = homeInstrumentColorVars(percentLedTint, gradeTubeColor, outputGradeTubeColor)
  const [open, setOpen] = useState(false)

  const last14 = useMemo(() => pointsSeries(currentDate, 14, getDayPoints), [currentDate, getDayPoints])
  const last30 = useMemo(() => pointsSeries(currentDate, 30, getDayPoints), [currentDate, getDayPoints])

  return (
    <>
      <div className="home-tile hab-score-well is-points" data-widget="points" data-testid="home-points-tile">
        <TileHide id="points" onHide={onHide} />
        <TileOpen label="Points" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Points</span>
          </div>
          <div className="home-crt home-points-crt is-hero-readout">
            <div
              className={cn("hab-score-readout", points.todayFlash && "is-flash")}
              data-centered="true"
              suppressHydrationWarning
            >
              {points.today.score}
            </div>
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub" suppressHydrationWarning>
              Today
              {points.today.sub ? ` · ${points.today.sub}` : ""}
              {" · "}
              all-time {points.alltime.score}
            </p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Points">
        <div style={colorVars as CSSProperties}>
          <WidgetWells>
            {POINT_ROWS.map((row) => (
              <WidgetWell key={row.kind} label={points[row.kind].caption}>
                <strong suppressHydrationWarning>{points[row.kind].score}</strong>
                {points[row.kind].sub ? <em>{points[row.kind].sub}</em> : null}
                {points[row.kind].fill != null ? (
                  <span className="home-widget-meter" aria-hidden="true">
                    <span style={{ width: `${points[row.kind].fill}%` }} />
                  </span>
                ) : null}
              </WidgetWell>
            ))}
          </WidgetWells>
          <PointsSparkline values={last14} label="Last 14 days" />
          <PointsSparkline values={last30} label="Last 30 days" />
        </div>
      </HomeWidgetDialog>
    </>
  )
}

export function PointsStats({ currentDate, instrument = false }: PointsStatsProps) {
  const colors = useThemeStore((s) => s.colors)
  const points = useHomePoints(currentDate)

  if (instrument) {
    return (
      <div className="hab-score-quad">
        <ScoreWell kind="alltime" caption={points.alltime.caption} score={points.alltime.score} sub={points.alltime.sub} />
        <ScoreWell kind="today" caption={points.today.caption} score={points.today.score} sub={points.today.sub} flash={points.todayFlash} />
        <ScoreWell kind="week" caption={points.week.caption} score={points.week.score} sub={points.week.sub} />
        <ScoreWell kind="month" caption={points.month.caption} score={points.month.score} sub={points.month.sub} />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card className="card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: colors.pointsAllTime }} />
            All Time Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ color: colors.pointsAllTime }} suppressHydrationWarning>
            {points.alltime.score}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Total earned</p>
        </CardContent>
      </Card>

      <Card className="card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Target className="h-4 w-4" style={{ color: colors.pointsToday }} />
            Today&apos;s Points
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ color: colors.pointsToday }} suppressHydrationWarning>
            {points.today.score}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{points.today.sub}</div>
          {points.today.fill != null && <Progress value={points.today.fill} className="mt-2 h-2" />}
        </CardContent>
      </Card>

      <Card className="card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" style={{ color: colors.pointsWeek }} />
            This Week
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ color: colors.pointsWeek }} suppressHydrationWarning>
            {points.week.score}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{points.week.sub}</div>
          {points.week.fill != null && <Progress value={points.week.fill} className="mt-2 h-2" />}
        </CardContent>
      </Card>

      <Card className="card-hover">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" style={{ color: colors.pointsMonth }} />
            This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold" style={{ color: colors.pointsMonth }} suppressHydrationWarning>
            {points.month.score}
          </div>
          <div className="text-xs text-muted-foreground mt-1">{points.month.sub}</div>
          {points.month.fill != null && <Progress value={points.month.fill} className="mt-2 h-2" />}
        </CardContent>
      </Card>
    </div>
  )
}

export function ScoreWell({
  kind,
  caption,
  score,
  sub,
  flash,
  onHide,
}: {
  kind: WellKind
  caption: string
  score: string
  sub?: string
  flash?: boolean
  onHide?: () => void
}) {
  return (
    <div className={cn("home-tile hab-score-well", `is-${kind}`)} data-widget={kind}>
      {onHide && (
        <button
          type="button"
          className="home-tile-hide"
          aria-label={`Hide ${HOME_WIDGET_LABEL[kind as HomeWidgetId]}`}
          onClick={onHide}
        >
          ×
        </button>
      )}
      <div className="hab-score-caption">
        <HabitSlotGem slot={WELL_GEM[kind]} className="hab-score-gem" title={caption} />
        <span>{caption}</span>
      </div>
      <div
        className={cn("hab-score-readout", flash && "is-flash")}
        data-centered="true"
        suppressHydrationWarning
      >
        {score}
      </div>
      <div className="home-tile-foot">
        <p className={cn("hab-score-sub", !sub && "hab-score-sub-empty")}>{sub || "\u00a0"}</p>
      </div>
    </div>
  )
}
