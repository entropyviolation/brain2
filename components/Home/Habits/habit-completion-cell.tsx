/**
 * components/Home/Habits/habit-completion-cell.tsx — Shared habit cell
 *
 * One completion cell for Daily (`TaskGrid`) and Weekly / Monthly / Season
 * (`PeriodHabitList`): exemption wand → HabitExemptCell → BOOLEAN /
 * GOAL|TIME|COUNT / TEXT / INCREMENTAL. Grids stay layout shells. A boolean
 * lamp paints on the click; this cell hands it the saved completion (or
 * exemption kind) so the glass matches that record once the write lands.
 */
"use client"

import { Clock } from "lucide-react"
import { type WeeklyTask as Task, TaskType, type TaskCompletion, type WeeklyData, type HabitFrequency } from "@/lib/types"
import { formatLocalDateKey } from "@/lib/date-utils"
import { isHabitGoalMet } from "@/lib/habit-utils"
import {
  completionCellShowsHatch,
  isMissedOpportunity,
  missedOpportunityEligible,
  printedGoalAmounts,
} from "@/lib/habit-missed-opportunity"
import { effectiveCoverageLink } from "@/lib/habit-completion-source"
import { isCurrentHabitPeriod, loggedShareOfElapsed, periodElapsedFraction } from "@/lib/habit-period-pace"
import {
  incrementalDataForTask,
  incrementalGoalOn,
  incrementalLoggedValue,
} from "@/lib/incremental-habits"
import { trackingUnitLabel } from "@/lib/habit-tracking"
import { useThemeStore } from "@/lib/theme-store"
import { HabitExemptCell, HabitLedLamp } from "@/components/Home/Habits/habit-led-lamp"
import { HabitNumberField, HabitTextField } from "@/components/Home/Habits/habit-value-field"
import {
  exemptionRestLabel,
  exemptionWandTitle,
  isExemptKind,
  loggedExemptionDay,
  type ExemptionKind,
} from "@/lib/habit-exemption"
import { autoCheckHint } from "@/lib/habit-connections"

export type HabitCompletionVariant = "daily" | "period"

function trackedCellHint(
  task: Task,
  completion: TaskCompletion | undefined,
  variant: HabitCompletionVariant,
): string {
  if (task.type === TaskType.BOOLEAN) {
    if (variant === "daily") return autoCheckHint(completion) ?? "Checked off automatically by tracked time"
    return "Checked off automatically by tracked time"
  }
  const unit = trackingUnitLabel(task.trackingLink?.unit)
  const tracked = completion?.trackedValue ?? 0
  const manual = completion?.manualValue ?? 0
  const manualPart = manual > 0 ? ` + ${manual} logged by hand` : ""
  return `${tracked} ${unit} from Tracking${manualPart}`
}

export interface HabitCompletionCellProps {
  task: Task
  /** Period start (day / week / month / quarter) for goal math. */
  date: Date
  /** Store / exemption key (YYYY-MM-DD, week key, month key, YYYY-Qn). */
  periodKey: string
  /** Visible label in aria / exemption rest copy (date key or period header). */
  periodLabel: string
  completion: TaskCompletion | undefined
  weeklyData: WeeklyData
  variant: HabitCompletionVariant
  /** Exemption frequency for logged-exemption day lookup. */
  frequency: HabitFrequency
  /** Noun for wand tooltips: day / week / month / season. */
  exemptionNoun: "day" | "week" | "month" | "season"
  exemptionWand?: boolean
  exemptionKind?: ExemptionKind
  onSetExempt?: (exempt: boolean) => void
  /** Missed op wand: eligible cells toggle `missedOpportunity`. */
  missedOpWand?: boolean
  onToggleMissedOpportunity?: (missed: boolean) => void
  /** Paint completed and missed-op cells with the exemption hatch. */
  hideCompletedAndMissed?: boolean
  onBooleanChange: (checked: boolean) => void
  onGoalChange: (value: number | undefined) => void
  onTextChange: (text: string) => void
  onIncrementalChange: (value: number | undefined) => void
}

export function HabitCompletionCell({
  task,
  date,
  periodKey,
  periodLabel,
  completion,
  weeklyData,
  variant,
  frequency,
  exemptionNoun,
  exemptionWand = false,
  exemptionKind = "required",
  onSetExempt,
  missedOpWand = false,
  onToggleMissedOpportunity,
  hideCompletedAndMissed = false,
  onBooleanChange,
  onGoalChange,
  onTextChange,
  onIncrementalChange,
}: HabitCompletionCellProps) {
  const colors = useThemeStore((s) => s.colors)
  const kind = exemptionKind
  const exempt = isExemptKind(kind)
  const logDay = kind === "logged" ? loggedExemptionDay(task, periodKey, frequency) : null

  if (exemptionWand && onSetExempt) {
    const title = exemptionWandTitle(kind, exemptionNoun, logDay)
    return (
      <div className="habit-lamp-cell" title={title}>
        <HabitLedLamp
          checked={exempt}
          unavailable={exempt}
          unavailableFollowsCheck
          saved={kind}
          onCheckedChange={onSetExempt}
          label={`${task.name} ${periodLabel} exemption`}
        />
      </div>
    )
  }

  const met = isHabitGoalMet(task, completion, { date, weeklyData })
  const missed = isMissedOpportunity(completion)
  const printed = printedGoalAmounts(task, completion)
  const showHatch = completionCellShowsHatch({
    exempt,
    met,
    missed,
    exemptionWand,
    missedOpWand,
    hideCompletedAndMissed,
    shown: printed.shown,
    goal: printed.goal,
  })

  if (missedOpWand && onToggleMissedOpportunity && missedOpportunityEligible(exempt, met)) {
    return (
      <div className="habit-lamp-cell" title="Click to mark this period definitely not done.">
        <HabitLedLamp
          checked={missed}
          saved={missed}
          onCheckedChange={onToggleMissedOpportunity}
          label={`${task.name} ${periodLabel} missed opportunity`}
        />
      </div>
    )
  }

  if (showHatch) {
    const goalFilled =
      typeof printed.shown === "number" &&
      typeof printed.goal === "number" &&
      printed.goal > 0 &&
      printed.shown + 1e-9 >= printed.goal
    const label = exempt
      ? exemptionRestLabel(task.name, periodLabel, kind, logDay)
      : missedOpWand
        ? `${task.name} ${periodLabel} already done`
        : met || goalFilled
          ? `${task.name} ${periodLabel} completed`
          : `${task.name} ${periodLabel} missed opportunity`
    return (
      <div className="habit-lamp-cell">
        <HabitExemptCell label={label} />
      </div>
    )
  }

  switch (task.type) {
    case TaskType.BOOLEAN: {
      const tracked =
        variant === "daily"
          ? !!(completion?.trackedCompleted || completion?.sleepCompleted || completion?.listCompleted)
          : !!completion?.trackedCompleted
      const title =
        variant === "daily"
          ? autoCheckHint(completion) ?? (completion?.trackedCompleted ? trackedCellHint(task, completion, variant) : undefined)
          : completion?.trackedCompleted
            ? trackedCellHint(task, completion, variant)
            : undefined
      return (
        <div className="habit-lamp-cell" title={title}>
          <HabitLedLamp
            checked={completion?.completed || false}
            saved={completion}
            onCheckedChange={onBooleanChange}
            label={`${task.name} ${periodLabel}`}
            tracked={tracked}
          />
        </div>
      )
    }

    case TaskType.GOAL:
    case TaskType.TIME:
    case TaskType.COUNT: {
      const tracked = completion?.trackedValue ?? 0
      const coverage = effectiveCoverageLink(task)
      const shownValue = printed.shown
      const now = new Date()
      const pace =
        coverage && isCurrentHabitPeriod(frequency, date, now) && typeof completion?.value === "number"
          ? loggedShareOfElapsed(completion.value, periodElapsedFraction(frequency, date, now))
          : null
      const goal = task.goal || 0
      const barPct =
        goal > 0 && typeof shownValue === "number"
          ? Math.min(100, Math.max(0, (shownValue / goal) * 100))
          : 0
      return (
        <div className="habit-cell-stack">
          <div className="habit-cell-num" title={tracked > 0 ? trackedCellHint(task, completion, variant) : undefined}>
            <HabitNumberField
              value={shownValue}
              onValue={onGoalChange}
              className="habit-cell-slot"
              style={{ borderColor: tracked > 0 ? "#38bdf8" : `${colors.habitGoal}40` }}
              ariaLabel={`${task.name} ${periodLabel}`}
            />
            {tracked > 0 && <Clock className="habit-tracked-mark" aria-label="includes tracked time" />}
            <span className="habit-goal">
              <span className="habit-goal-den">/{task.goal}</span>
            </span>
          </div>
          {pace != null && (
            <span
              className="habit-cell-pace"
              data-testid="habit-cell-pace"
              title="Logged share of the time that has already passed"
            >
              PROG: {Math.round(pace)}%
            </span>
          )}
          {task.showGoalBar && goal > 0 && (
            <span className="habit-cell-tube" aria-hidden="true" title={`${Math.round(barPct)}% of ${goal}`}>
              <span className="habit-cell-mercury" style={{ width: `${barPct}%` }} />
            </span>
          )}
        </div>
      )
    }

    case TaskType.TEXT:
      return (
        <HabitTextField
          value={completion?.text || ""}
          onValue={onTextChange}
          className="habit-cell-slot habit-cell-slot-text"
          placeholder="…"
          ariaLabel={`${task.name} ${periodLabel} note`}
        />
      )

    case TaskType.INCREMENTAL: {
      const climb = incrementalDataForTask(task)
      if (!climb) return null
      const goal = incrementalGoalOn(task, weeklyData, date)
      const value = incrementalLoggedValue(completion)
      const isCompleted = isHabitGoalMet(task, completion, { date, weeklyData })
      const unit = climb.unit || task.unit || ""
      const hint =
        variant === "daily" && climb.cadence === "daily"
          ? `${isCompleted ? "hit" : "need"} +${climb.increment}`
          : `${goal}${unit ? ` ${unit}` : ""}`
      const placeholder =
        variant === "daily" && climb.cadence === "daily" ? String(goal) : "0"
      const ariaPeriod =
        variant === "daily" ? formatLocalDateKey(date) : periodLabel
      return (
        <div className="habit-cell-num" title={hint}>
          <HabitNumberField
            value={value}
            onValue={onIncrementalChange}
            className={`habit-cell-slot${isCompleted ? " is-met" : ""}`}
            style={{ borderColor: isCompleted ? undefined : `${colors.habitIncremental}40` }}
            placeholder={placeholder}
            ariaLabel={`${task.name} ${ariaPeriod}`}
          />
          <span className="habit-goal">
            <span className="habit-goal-den">/{goal}</span>
            {unit ? <span className="habit-goal-unit"> {unit}</span> : null}
          </span>
        </div>
      )
    }

    default:
      return null
  }
}
