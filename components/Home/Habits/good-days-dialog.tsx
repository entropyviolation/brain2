/**
 * components/Home/Habits/good-days-dialog.tsx — Good day streak + last-30 breakdown
 *
 * Separate from Week grade / Perfect output. Lists which of the last 30 days
 * met the user's "completion to feel accomplished" threshold, and reads the
 * prior 7-day and prior 30-day raw completion averages against today,
 * yesterday's raw completion, and this week's raw average against last week,
 * this year, and all weeks with data. Each card says how many percentage
 * points apart the two figures are.
 */
"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  GOOD_DAYS_LOOKBACK,
  type GoodDaySummary,
  type OlderAverageVsToday,
} from "@/lib/habit-accomplishment"
import { PriorityMathPanel } from "@/components/Home/Habits/priority-math"
import { format } from "date-fns"

interface GoodDaysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  summary: GoodDaySummary
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
  onThresholdChange,
  onBonusChange,
  usePriority = false,
  onUsePriorityChange,
  todayOverall,
  todayPriority = null,
}: GoodDaysDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Good days</DialogTitle>
          <DialogDescription>
            A Good day is overall daily-habit completion at or above your
            accomplishment threshold. Independent of Week grade and Perfect output.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <p>
            <span className="text-muted-foreground block text-xs">Good day streak</span>
            <strong className="text-base tabular-nums">{summary.streak}</strong>
          </p>
          <p>
            <span className="text-muted-foreground block text-xs">Good days in the last month</span>
            <strong className="text-base tabular-nums">
              {summary.last30Count}
            </strong>
            <span className="text-muted-foreground"> / {GOOD_DAYS_LOOKBACK}</span>
          </p>
        </div>

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
                value={summary.threshold}
                onChange={(e) => onThresholdChange(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">% overall = a Good day</span>
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
                value={summary.bonus}
                onChange={(e) => onBonusChange(Number(e.target.value))}
                className="w-24"
              />
              <span className="text-sm text-muted-foreground">points on a Good day</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Same settings live under Daily habits → Settings. Today is{" "}
            {summary.todayRaw.toFixed(0)}%
            {summary.todayGood ? " (Good day)" : " (not yet a Good day)"}.
          </p>
        </div>

        {summary.last30.length > 0 ? (
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
