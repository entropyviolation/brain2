/**
 * components/Home/points-stats.tsx — Points wells for the Home overview strip
 *
 * Math is unchanged (ledger totals + possible-points fill). The overview tile
 * is a market ticker (`lib/points-ticker.ts`): D / W / M / ALL keys choose the
 * period, the screen shows its total, the change against the previous period
 * (▲ / ▼, points and percent), and a chart with the previous value dashed.
 * The chosen period is a per-device convenience in localStorage. Detail keeps
 * the four wells with their current vs possible meters, then one ticker plate
 * per period (D / W / M / Y / ALL) with New / Cumulative keys
 * (`points-detail.tsx`). `instrument` still packs all four for callers that want the set.
 */
"use client"

import { CopyCaption, useCopySetting, useCopySettingsWriter, useWidgetFrame } from "@/components/Home/widgets/copy-context"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Trophy, Target, Calendar, TrendingUp } from "lucide-react"
import { usePointsStore } from "@/lib/points-store"
import { useTaskStore } from "@/lib/task-store"
import { useHabitsStore } from "@/lib/habits-store"
import { useThemeStore } from "@/lib/theme-store"
import { HabitSlotGem } from "@/components/Home/Habits/habit-gems"
import type { HabitGemSlot } from "@/lib/habit-gems"
import { HOME_WIDGET_LABEL, homeInstrumentColorVars, type HomeWidgetId } from "@/lib/home-widgets"
import { HomeWidgetDialog, TileHide, TileOpen, WidgetWell, WidgetWells } from "@/components/Home/home-widget-dialog"
import { cn } from "@/lib/utils"
import { PointsPeriodsDetail } from "@/components/Home/points-detail"
import {
  TICKER_PERIODS,
  formatTickerChange,
  formatTickerDelta,
  formatTickerPoints,
  pointsTicker,
  type PointsTicker,
  type TickerPeriod,
} from "@/lib/points-ticker"

const TICKER_PERIOD_KEY = "brain2-home-points-period"

function readTickerPeriod(): TickerPeriod {
  try {
    const raw = window.localStorage.getItem(TICKER_PERIOD_KEY)
    if (raw === "day" || raw === "week" || raw === "month" || raw === "all") return raw
  } catch {
    // Storage blocked: the default period still works.
  }
  return "day"
}

function isTickerPeriod(value: unknown): value is TickerPeriod {
  return value === "day" || value === "week" || value === "month" || value === "all"
}

/**
 * The ticker period. On the Visual dashboard each Points copy keeps its own
 * (the gear's Period, or the face keys); outside it, the per-device key.
 */
function useTickerPeriod(): [TickerPeriod, (p: TickerPeriod) => void] {
  const frame = useWidgetFrame()
  const copyPeriod = useCopySetting<string>("period", "")
  const writeCopy = useCopySettingsWriter()
  const [period, setPeriod] = useState<TickerPeriod>("day")
  useEffect(() => setPeriod(readTickerPeriod()), [])
  if (frame && isTickerPeriod(copyPeriod)) {
    return [copyPeriod, (p) => writeCopy({ period: p })]
  }
  const choose = (p: TickerPeriod) => {
    setPeriod(p)
    try {
      window.localStorage.setItem(TICKER_PERIOD_KEY, p)
    } catch {
      // Not remembered this time.
    }
  }
  return [period, choose]
}

/** Line + area over the period, previous value dashed, last value marked. */
function TickerChart({ ticker }: { ticker: PointsTicker }) {
  const values = ticker.series
  const w = 200
  const h = 80
  const pad = 6
  const max = Math.max(...values, ticker.previous, 0)
  const min = Math.min(...values, ticker.previous, 0)
  const span = max - min || 1
  const y = (v: number) => pad + (h - pad * 2) * (1 - (v - min) / span)
  const x = (i: number) => (values.length <= 1 ? w / 2 : (i / (values.length - 1)) * w)
  const line = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ")
  const area = `${line} L${w} ${h} L0 ${h} Z`
  const last = values[values.length - 1] ?? 0
  const prevY = y(ticker.previous)
  return (
    <div className="home-ticker-chart" aria-hidden="true">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
        <defs>
          <linearGradient id="home-ticker-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.32" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line className="home-ticker-prev" x1="0" x2={w} y1={prevY} y2={prevY} vectorEffect="non-scaling-stroke" />
        <path className="home-ticker-area" d={area} fill="url(#home-ticker-fill)" />
        <path className="home-ticker-line" d={line} vectorEffect="non-scaling-stroke" />
      </svg>
      <span className="home-ticker-dot" style={{ top: `${(y(last) / h) * 100}%` }} />
      <span className="home-ticker-hi">{formatTickerPoints(max)}</span>
      <span className="home-ticker-lo">{formatTickerPoints(min)}</span>
    </div>
  )
}

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
  const percentLedTint = useHabitsStore((s) => s.percentLedTint)
  const gradeTubeColor = useHabitsStore((s) => s.gradeTubeColor)
  const outputGradeTubeColor = useHabitsStore((s) => s.outputGradeTubeColor)
  const colorVars = homeInstrumentColorVars(percentLedTint, gradeTubeColor, outputGradeTubeColor)
  const [open, setOpen] = useState(false)

  const pointsHistory = usePointsStore((s) => s.pointsHistory)
  const [period, setPeriod] = useTickerPeriod()
  const showChart = useCopySetting<boolean>("chart", true)
  const showKeys = useCopySetting<boolean>("keys", true)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const ticker = useMemo(
    () => pointsTicker(pointsHistory, period, currentDate),
    [pointsHistory, period, currentDate],
  )
  const periodMeta = TICKER_PERIODS.find((p) => p.id === period) ?? TICKER_PERIODS[0]!


  return (
    <>
      <div
        className="home-tile hab-score-well is-points is-ticker"
        data-widget="points"
        data-testid="home-points-tile"
        data-direction={ticker.direction}
      >
        <TileHide id="points" onHide={onHide} />
        <TileOpen label="Points" onOpen={() => setOpen(true)}>
          <div className="hab-score-caption">
            <span>
              <CopyCaption>Points</CopyCaption>
            </span>
          </div>
          <div className="home-crt home-points-crt home-ticker-crt" data-chart={showChart ? "on" : "off"}>
            <div className="home-ticker-quote">
              <span className="home-ticker-symbol">
                PTS <em>{periodMeta.label}</em>
              </span>
              <div
                className={cn("hab-score-readout home-ticker-value", points.todayFlash && "is-flash")}
                data-centered="true"
                suppressHydrationWarning
              >
                {mounted ? formatTickerPoints(ticker.value) : "—"}
              </div>
              <span className="home-ticker-change" suppressHydrationWarning>
                <span aria-hidden="true">{ticker.direction === "down" ? "▼" : ticker.direction === "up" ? "▲" : "■"}</span>{" "}
                {mounted ? `${formatTickerDelta(ticker.delta)} (${formatTickerChange(ticker)})` : "—"}
              </span>
              <span className="home-ticker-vs">{periodMeta.vs}</span>
            </div>
            {showChart ? mounted ? <TickerChart ticker={ticker} /> : <div className="home-ticker-chart" /> : null}
          </div>
        </TileOpen>
        <div className="home-tile-foot home-ticker-foot">
          <p className="hab-score-sub" suppressHydrationWarning>
            all-time {points.alltime.score}
            {points.today.sub ? ` · ${points.today.sub}` : ""}
          </p>
          {showKeys ? (
          <div className="home-ticker-keys" role="group" aria-label="Points period">
            {TICKER_PERIODS.map((p) => (
              <button
                key={p.id}
                type="button"
                className="home-ticker-key"
                aria-pressed={period === p.id}
                aria-label={p.label}
                title={`${p.label} ${p.vs}`}
                onClick={() => setPeriod(p.id)}
              >
                {p.key}
              </button>
            ))}
          </div>
          ) : null}
        </div>
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
          <PointsPeriodsDetail
            currentDate={currentDate}
            meters={{ day: points.today, week: points.week, month: points.month }}
          />
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
