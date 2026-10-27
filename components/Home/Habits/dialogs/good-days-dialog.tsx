/**
 * components/Home/Habits/good-days-dialog.tsx — Good day / week / month / season plate
 *
 * Presentational. The top line is how many whole points the current period
 * still needs (`pointsStillNeededPhrase`). Daily lists the last 30 days and
 * reads yesterday, the prior 7, the prior 30, and this week's raw average
 * against last week, this year, and all weeks with data. Week, month, and
 * season reuse this plate with that period's noun, streak, and lookback.
 * Separate from Week grade / Perfect output.
 */
"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  GOOD_DAYS_LOOKBACK,
  pointsStillNeededPhrase,
  type GoodDaySummary,
  type GoodPeriodSummary,
  type OlderAverageVsToday,
} from "@/lib/habit-accomplishment"
import { PriorityMathPanel } from "@/components/Home/Habits/priority-math"
import { format } from "date-fns"

interface GoodDaysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  summary: GoodDaySummary
  /** Week, month, or season plate. Daily leaves this unset. */
  period?: GoodPeriodSummary | null
  onThresholdChange: (value: number) => void
  onBonusChange: (value: number) => void
  usePriority?: boolean
  onUsePriorityChange?: (value: boolean) => void
  todayOverall?: number
  todayPriority?: number | null
}

function pointsNoun(points: number): string {
  return points === 1 ? "point" : "points"
}

/** Whole-percent gap between an older figure and the one it is compared with. */
function averageVsDetail(
  average: number,
  todayRaw: number,
  subject = "today",
): { vs: OlderAverageVsToday; phrase: string } {
  const older = Math.round(Number.isFinite(average) ? average : 0)
  const today = Math.round(Number.isFinite(todayRaw) ? todayRaw : 0)
  const delta = older - today
  if (delta > 0) return { vs: "higher", phrase: `${delta} ${pointsNoun(delta)} higher than ${subject}` }
  if (delta < 0) {
    const points = Math.abs(delta)
    return { vs: "lower", phrase: `${points} ${pointsNoun(points)} lower than ${subject}` }
  }
  return { vs: "same", phrase: `same as ${subject}` }
}

function AverageReading({
  testId,
  label,
  average,
  todayRaw,
  subject = "today",
}: {
  testId: string
  label: string
  average: number
  todayRaw: number
  subject?: string
}) {
  const percent = Math.round(average)
  const { vs, phrase } = averageVsDetail(average, todayRaw, subject)
  return (
    <p data-testid={testId}>
      <span className="good-days-average-label">{label}</span>
      <span className="good-days-average-line">
        <strong className="good-days-average-value">{percent}%</strong>
        <span className="good-days-average-vs" data-comparison={vs}>
          {phrase}
        </span>
      </span>
    </p>
  )
}

export function GoodDaysDialog({
  open,
  onOpenChange,
  summary,
  period = null,
  onThresholdChange,
  onBonusChange,
  usePriority = false,
  onUsePriorityChange,
  todayOverall,
  todayPriority = null,
}: GoodDaysDialogProps) {
  const noun = period?.noun ?? "day"
  const plural = period?.plural ?? "days"
  const phrase = period?.pointsPhrase ?? pointsStillNeededPhrase(summary.todayCompletionRaw, summary.threshold, "day")
  const streak = period?.streak ?? summary.streak
  const count = period?.lookbackCount ?? summary.last30Count
  const countOf = period?.lookbackSize ?? GOOD_DAYS_LOOKBACK
  const streakLabel = period?.streakLabel ?? "Good day streak"
  const countLabel = period?.countLabel ?? "Good days in the last month"
  const threshold = period?.threshold ?? summary.threshold
  const bonus = period?.bonus ?? summary.bonus
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Good {plural}</DialogTitle>
          <DialogDescription>
            {period
              ? `A good ${noun} is that ${noun}'s raw daily-completion average at or above your accomplishment threshold — the same line as a Good day. Independent of Span grade and Perfect output.`
              : "A Good day is overall daily-habit completion at or above your accomplishment threshold. Independent of Week grade and Perfect output."}
          </DialogDescription>
        </DialogHeader>

        <div className="good-days-averages" data-testid="good-period-points">
          <p className="good-days-averages-note">{phrase}</p>
          {period && (
            <p className="good-days-averages-note">
              This {noun} is{" "}
              <strong className="good-days-average-value" data-testid="good-period-current-raw">
                {Math.round(period.currentRaw)}%
              </strong>
              .
            </p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <p>
            <span className="text-muted-foreground block text-xs">{streakLabel}</span>
            <strong className="text-base tabular-nums">{streak}</strong>
          </p>
          <p>
            <span className="text-muted-foreground block text-xs">{countLabel}</span>
            <strong className="text-base tabular-nums">
              {count}
            </strong>
            <span className="text-muted-foreground"> / {countOf}</span>
          </p>
        </div>

        {!period && (
        <>
        <div className="good-days-averages" data-testid="good-days-averages">
          <p className="good-days-averages-note">
            Raw completion on the days before today. Today is{" "}
            <strong className="good-days-average-value" data-testid="good-days-today-raw">
              {Math.round(summary.todayCompletionRaw)}%
            </strong>
            .
          </p>
          <div className="good-days-averages-grid">
            <AverageReading
              testId="good-days-avg-30"
              label="Last 30 days"
              average={summary.prior30Average}
              todayRaw={summary.todayCompletionRaw}
            />
            <AverageReading
              testId="good-days-avg-7"
              label="Prior 7 days"
              average={summary.prior7Average}
              todayRaw={summary.todayCompletionRaw}
            />
            <AverageReading
              testId="good-days-yesterday"
              label="Yesterday"
              average={summary.yesterdayCompletionRaw}
              todayRaw={summary.todayCompletionRaw}
            />
          </div>
        </div>

        <div className="good-days-averages" data-testid="good-days-week-averages">
          <p className="good-days-averages-note">
            Week raw average of the days that have happened, including today. This week is{" "}
            <strong className="good-days-average-value" data-testid="good-days-this-week-raw">
              {Math.round(summary.weeks.thisWeek)}%
            </strong>
            .
          </p>
          <div className="good-days-averages-grid">
            <AverageReading
              testId="good-days-week-last"
              label="Last week"
              average={summary.weeks.lastWeek}
              todayRaw={summary.weeks.thisWeek}
              subject="this week"
            />
            <AverageReading
              testId="good-days-week-year"
              label="This year"
              average={summary.weeks.thisYear}
              todayRaw={summary.weeks.thisWeek}
              subject="this week"
            />
            <AverageReading
              testId="good-days-week-all"
              label="All time"
              average={summary.weeks.allTime}
              todayRaw={summary.weeks.thisWeek}
              subject="this week"
            />
          </div>
        </div>

        {onUsePriorityChange && (
          <PriorityMathPanel
            enabled={usePriority}
            onEnabledChange={onUsePriorityChange}
            overall={todayOverall ?? summary.todayRaw}
            priority={todayPriority}
            label="prioritized habits for Good days"
          />
        )}
        </>
        )}

        <div className="space-y-3 border-t pt-3">
          <div className="space-y-1">
            <Label htmlFor="accomplishment-threshold">Completion to feel accomplished</Label>
            <div className="flex items-center gap-2">
              <Input
                id="accomplishment-threshold"
                type="number"
                min={1}
                max={100}
                step={1}
                value={threshold}
                onChange={(e) => onThresholdChange(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">% overall = a Good {noun}</span>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="accomplishment-bonus">Accomplishment bonus</Label>
            <div className="flex items-center gap-2">
              <Input
                id="accomplishment-bonus"
                type="number"
                min={0}
                max={10000}
                step={1}
                value={bonus}
                onChange={(e) => onBonusChange(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">points on a Good {noun}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Same settings live under Daily habits → Settings.{" "}
            {period
              ? `This ${noun} is ${Math.round(period.currentRaw)}%${period.currentGood ? ` (Good ${noun})` : ` (not yet a good ${noun})`}.`
              : `Today is ${summary.todayRaw.toFixed(0)}%${summary.todayGood ? " (Good day)" : " (not yet a Good day)"}.`}
          </p>
        </div>

        {period ? (
          period.lookback.length > 0 ? (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-1 font-medium capitalize">{noun}</th>
                  <th className="py-1 font-medium text-right">Raw</th>
                  <th className="py-1 font-medium text-right">Good {noun}</th>
                </tr>
              </thead>
              <tbody>
                {[...period.lookback].reverse().map((row) => (
                  <tr key={row.dateKey} className="border-b border-border/60">
                    <td className="py-1">{row.label}</td>
                    <td className="py-1 text-right tabular-nums">{Math.round(row.raw)}%</td>
                    <td className="py-1 text-right">{row.good ? "Yes" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-sm text-muted-foreground">No {plural} in the lookback window yet.</p>
          )
        ) : summary.last30.length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-muted-foreground border-b">
                <th className="py-1 font-medium">Day</th>
                <th className="py-1 font-medium text-right">Raw</th>
                <th className="py-1 font-medium text-right">Good day</th>
              </tr>
            </thead>
            <tbody>
              {[...summary.last30].reverse().map((d) => (
                <tr key={d.dateKey} className="border-b border-border/60">
                  <td className="py-1">{format(d.date, "EEE M/d")}</td>
                  <td className="py-1 text-right tabular-nums">{d.raw.toFixed(0)}%</td>
                  <td className="py-1 text-right">{d.good ? "Yes" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-sm text-muted-foreground">No days in the lookback window yet.</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
