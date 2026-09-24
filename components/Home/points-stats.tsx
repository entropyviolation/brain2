/**
 * components/Home/points-stats.tsx — Points wells for the Home overview strip
 *
 * Math is unchanged (ledger totals + possible-points fill). Overview wells
 * share one metal face and one CRT glass; `instrument` still packs all four
 * for callers that want the set.
 */
"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Trophy, Target, Calendar, TrendingUp } from "lucide-react"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useThemeStore } from "@/lib/theme-store"
import { HabitSlotGem } from "@/components/Home/Habits/habit-gems"
import type { HabitGemSlot } from "@/lib/habit-gems"
import { HOME_WIDGET_LABEL, type HomeWidgetId } from "@/lib/home-widgets"
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

/** One overview tile for all four point periods. */
export function PointsBoard({ currentDate, onHide }: { currentDate: Date; onHide: () => void }) {
  const points = useHomePoints(currentDate)
  const [open, setOpen] = useState(false)

  return (
    <>
      <div className="home-tile hab-score-well is-points" data-widget="points" data-testid="home-points-tile">
        <TileHide id="points" onHide={onHide} />
        <TileOpen label="Points" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>Points</span>
          </div>
          <div className="home-crt is-stack home-points-crt">
            {POINT_ROWS.map((row) => (
              <div key={row.kind} className="home-points-line" data-kind={row.kind}>
                <span>{row.short}</span>
                <span
                  className={cn(row.kind === "today" && points.todayFlash && "is-flash")}
                  suppressHydrationWarning
                >
                  {points[row.kind].score}
                </span>
              </div>
            ))}
          </div>
          <div className="home-tile-foot">
            <p className="hab-score-sub">{points.today.sub || points.alltime.sub || "\u00a0"}</p>
          </div>
        </TileOpen>
      </div>
      <HomeWidgetDialog open={open} onOpenChange={setOpen} title="Points">
        <WidgetWells>
          {POINT_ROWS.map((row) => (
            <WidgetWell key={row.kind} label={points[row.kind].caption} tone="nixie">
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
