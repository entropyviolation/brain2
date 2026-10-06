/**
 * components/Home/Habits/grade-breakdown-dialog.tsx — Week grade breakdown
 *
 * Thin wrapper over HabGradeSheet: WeekGradeResult day proof table,
 * `gradeTubeColor` store key, period titles, day/week lift notes.
 */
"use client"

import { gradeHeroDelta, HabGradeSheet } from "@/components/Home/Habits/hab-grade-sheet"
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
  if (unit === "week") return `w/c ${format(d.date, "M/d")}`
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
  const bonus = result.curveBonus
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
  const periodLabel =
    periodUnit === "season" ? "Season" : periodUnit === "day" ? "Day" : periodUnit === "week" ? "Week" : "Month"
  const heroWhole = result.daysIncluded === 0 ? null : Number(shown.toFixed(0))
  const hero = heroWhole == null ? "—" : `${heroWhole}%`
  const historicalAvg =
    periodUnit === "day" && weekAverage != null && Number.isFinite(weekAverage) ? Math.round(weekAverage) : null
  const ordinaryWhole = Number(result.grade.toFixed(0))
  const compared =
    heroWhole != null && historicalAvg != null
      ? gradeHeroDelta(heroWhole, historicalAvg, "weeks")
      : heroWhole != null && (result.curveBonus > 0 || usePriority)
        ? gradeHeroDelta(heroWhole, ordinaryWhole, "ordinary")
        : null
  const showOrdinary = historicalAvg != null || compared != null

  const equation =
    result.daysIncluded > 0 ? (
      <>
        {result.days.filter((d) => !d.vacant).map((d) => d.curved.toFixed(0)).join(" + ")}
        {" = "}
        {result.days.filter((d) => !d.vacant).reduce((a, d) => a + d.curved, 0).toFixed(0)}
        {" / "}
        {result.days.filter((d) => !d.vacant).length}
        {" = "}
        {result.grade.toFixed(0)}%
      </>
    ) : undefined

  const curveHint =
    bonus === 0
      ? `100% tolerance means no curve: each ${noun}’s score equals raw completion.`
      : `Each ${noun} is scored as raw + ${bonus} (so ${result.tolerance}% raw = 100%). Scores can go above 100%. A 0% ${noun} stays 0 — the curve does not lift empty ${noun}s.`

  const notes = (
    <>
      {periodUnit === "week" && (
        <p className="hab-grade-sheet-note">
          +{weekLift} for each of this week’s weekly-habit grade and output that is higher than last week
          (Settings).
        </p>
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
      description={
        <>
          Current grade is the average of each elapsed {noun}’s score after the {noun}ly curve.
          Raw completion is unchanged; the curve only affects this grade. Zero stays zero.
        </>
      }
      tubeColor={tubeColor}
      onTubeColorChange={setGradeTubeColor}
      tubeColorId="grade-tube-color"
      tubeColorAriaLabel={`${title} tube color`}
      tubeColorDisabled={!hydrated}
      hero={hero}
      showOrdinary={showOrdinary}
      ordinaryMark={compared?.mark}
      ordinaryText={
        compared != null
          ? compared.phrase
          : historicalAvg != null
            ? `avg ${historicalAvg}% across weeks`
            : undefined
      }
      ordinaryTitle={
        historicalAvg != null ? "Average week grade across all weeks with data" : undefined
      }
      equation={equation}
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
        <div className="hab-grade-sheet-proof" role="table" aria-label={`${title} breakdown`}>
          <div className="hab-grade-sheet-proof-head" role="row">
            <span role="columnheader">{periodLabel}</span>
            <span role="columnheader">Raw</span>
            <span role="columnheader">Curved</span>
          </div>
          {result.days.map((d) => (
            <div key={d.dateKey} className="hab-grade-sheet-row" role="row">
              <span className="hab-grade-sheet-row-name" role="cell">
                {formatPeriodRow(d, periodUnit)}
              </span>
              <span
                className={`hab-grade-sheet-row-readout${d.vacant ? " is-mute" : ""}`}
                role="cell"
              >
                {d.vacant ? "exempt" : `${d.raw.toFixed(0)}%`}
              </span>
              <span
                className={`hab-grade-sheet-row-readout${d.vacant ? " is-mute" : ""}`}
                role="cell"
              >
                {d.vacant ? "—" : `${d.curved.toFixed(0)}%`}
              </span>
            </div>
          ))}
          <div className="hab-grade-sheet-row is-avg" role="row">
            <span className="hab-grade-sheet-row-name" role="cell">
              Average
            </span>
            <span className="hab-grade-sheet-row-readout" role="cell">
              {result.rawGrade.toFixed(0)}%
            </span>
            <span className="hab-grade-sheet-row-readout" role="cell">
              {result.grade.toFixed(0)}%
            </span>
          </div>
        </div>
      ) : (
        <p className="hab-grade-sheet-empty">No elapsed {noun}s in this window yet.</p>
      )}
    </HabGradeSheet>
  )
}
