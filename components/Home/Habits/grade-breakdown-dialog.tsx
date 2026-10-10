/**
 * components/Home/Habits/grade-breakdown-dialog.tsx — Week grade breakdown
 *
 * Thin wrapper over HabGradeSheet: WeekGradeResult day proof table,
 * `gradeTubeColor` store key, period titles, day/week lift notes.
 */
"use client"

import { gradeHeroDelta, HabGradeProof, HabGradeSheet } from "@/components/Home/Habits/hab-grade-sheet"
import { type WeekGradeDay, type WeekGradeResult } from "@/lib/calculations"
import {
  DEFAULT_ACCOMPLISHMENT_BONUS,
  DEFAULT_ACCOMPLISHMENT_THRESHOLD,
} from "@/lib/habit-accomplishment"
import { format } from "date-fns"
import { blendPriorityScore } from "@/lib/habit-priority"
import { useHabitsStore } from "@/lib/habits-store"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"

type PeriodUnit = "day" | "week" | "month" | "season"

interface GradeBreakdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: WeekGradeResult
  onToleranceChange: (value: number) => void
  accomplishmentThreshold?: number
  accomplishmentBonus?: number
  periodUnit?: PeriodUnit
  usePriority?: boolean
  onUsePriorityChange?: (value: boolean) => void
  priorityScore?: number | null
  /**
   * Mean week grade across every week that has a completion.
   * Shown beside the current grade on the Week grade sheet.
   */
  weekAverage?: number | null
}

function formatPeriodRow(d: WeekGradeDay, unit: PeriodUnit): string {
  if (unit === "season") {
    const q = Math.floor(d.date.getMonth() / 3) + 1
    const name = (["Spring", "Summer", "Fall", "Winter"] as const)[q - 1]
    return `${name} ${d.date.getFullYear()}`
  }
  if (unit === "month") return format(d.date, "MMM yyyy")
  if (unit === "week") return format(d.date, "MMM d")
  return format(d.date, "EEE M/d")
}

export function GradeBreakdownDialog({
  open,
  onOpenChange,
  result,
  onToleranceChange,
  accomplishmentThreshold = DEFAULT_ACCOMPLISHMENT_THRESHOLD,
  accomplishmentBonus = DEFAULT_ACCOMPLISHMENT_BONUS,
  periodUnit = "day",
  usePriority = false,
  onUsePriorityChange,
  priorityScore = null,
  weekAverage = null,
}: GradeBreakdownDialogProps) {
  const noun = periodUnit
  const title =
    periodUnit === "season" ? "Season grade" : periodUnit === "month" ? "Month grade" : periodUnit === "week" ? "Span grade" : "Week grade"
  const shown = blendPriorityScore(result.grade, priorityScore, usePriority)
  const tubeColor = useHabitsStore((s) => s.gradeTubeColor)
  const setGradeTubeColor = useHabitsStore((s) => s.setGradeTubeColor)
  const dayLift = useHabitsStore((s) => s.dayGradeLiftBonus)
  const weekLift = useHabitsStore((s) => s.weeklyGradeLiftBonus)
  const weekAvgBeat = useHabitsStore((s) => s.weeklyAverageBeatBonus)
  const monthAvgBeat = useHabitsStore((s) => s.monthlyAverageBeatBonus)
  const hydrated = usePersistHydrated(useHabitsStore.persist)
  const nameHeader =
    periodUnit === "season" ? "Season" : periodUnit === "day" ? "Day" : periodUnit === "week" ? "Week of" : "Month"
  const heroWhole = result.daysIncluded === 0 ? null : Number(shown.toFixed(0))
  const hero = heroWhole == null ? "—" : `${heroWhole}%`
  const historicalAvg =
    periodUnit === "day" && weekAverage != null && Number.isFinite(weekAverage) ? Math.round(weekAverage) : null
  const preBlend = Number(result.grade.toFixed(0))
  const weeksCompared =
    heroWhole != null && historicalAvg != null ? gradeHeroDelta(heroWhole, historicalAvg, "weeks") : null
  const blendText =
    usePriority && heroWhole != null ? gradeHeroDelta(heroWhole, preBlend, "ordinary").phrase : null
  const possessive =
    periodUnit === "season" ? "season’s" : periodUnit === "month" ? "month’s" : periodUnit === "week" ? "week’s" : "day’s"
  const emptyNoun =
    periodUnit === "season" ? "season" : periodUnit === "month" ? "month" : periodUnit === "week" ? "week" : "day"

  const curveHint = `An empty ${emptyNoun} is not lifted.`

  const notes = (
    <>
      {periodUnit === "week" && (
        <div className="hab-grade-sheet-aside">
          <span className="hab-grade-sheet-bay-legend">This week</span>
          <p className="hab-grade-sheet-hint">
            +{weekLift} for each of this week’s weekly-habit grade and output that is higher than last week
            (Settings).
          </p>
        </div>
      )}
      {periodUnit === "day" && (
        <p className="hab-grade-sheet-note">
          Points: each daily habit is worth 50 (partial completion counts, e.g. 5/10 pages = 25).
          Each day: +{accomplishmentBonus} if that day’s raw score is at or above {accomplishmentThreshold}%
          (Good day, set in Settings); +100 if either Week grade or Perfect
          output is 75%+ after its curve; +300 if both grades are. +{dayLift} for each of
          those grades that is higher than yesterday (Settings). +{weekAvgBeat} when raw completion is above the prior 7-day average, and +{monthAvgBeat} when it is above the prior 30-day average (Settings).
        </p>
      )}
    </>
  )

  return (
    <HabGradeSheet
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={`The average of each elapsed ${noun} after the curve; raw completion stays as logged, and a 0% ${noun} stays 0.`}
      tubeColor={tubeColor}
      onTubeColorChange={setGradeTubeColor}
      tubeColorId="grade-tube-color"
      tubeColorAriaLabel={`${title} tube color`}
      tubeColorDisabled={!hydrated}
      hero={hero}
      heroLine={
        weeksCompared != null ? (
          <>
            {weeksCompared.mark === "up" ? "▲ " : weeksCompared.mark === "down" ? "▼ " : ""}
            {weeksCompared.phrase}
          </>
        ) : (
          `Average of each ${possessive} curved score.`
        )
      }
      heroLineTitle={
        historicalAvg != null ? "Average week grade across all weeks with data" : undefined
      }
      blendText={blendText}
      toleranceId="grade-tolerance"
      toleranceLabel={`${periodUnit === "season" ? "Season" : periodUnit === "day" ? "Daily" : periodUnit === "week" ? "Weekly" : "Monthly"} perfect threshold (tolerance)`}
      tolerance={result.tolerance}
      onToleranceChange={onToleranceChange}
      curveHint={curveHint}
      priority={
        onUsePriorityChange
          ? {
              enabled: usePriority,
              onEnabledChange: onUsePriorityChange,
              overall: result.grade,
              priority: priorityScore,
              label: "prioritized habits",
            }
          : undefined
      }
      notes={notes}
    >
      {result.days.length > 0 ? (
        <HabGradeProof
          ariaLabel={`${title} breakdown`}
          nameHeader={nameHeader}
          rows={result.days.map((d) => ({
            key: d.dateKey,
            name: formatPeriodRow(d, periodUnit),
            rawText: d.vacant ? "exempt" : `${d.raw.toFixed(0)}%`,
            curvedText: d.vacant ? "—" : `${d.curved.toFixed(0)}%`,
            curvedValue: d.vacant ? null : d.curved,
            mute: d.vacant,
          }))}
          averageRaw={`${result.rawGrade.toFixed(0)}%`}
          averageCurved={`${result.grade.toFixed(0)}%`}
        />
      ) : (
        <p className="hab-grade-sheet-empty">No elapsed {noun}s in this window yet.</p>
      )}
    </HabGradeSheet>
  )
}
