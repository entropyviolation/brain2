/**
 * components/Home/Habits/output-grade-breakdown-dialog.tsx — Perfect Output grade
 *
 * Thin wrapper over HabGradeSheet: OutputGradeResult habit proof table,
 * `outputGradeTubeColor` store key, Perfect output title/copy.
 */
"use client"

import { gradeHeroDelta, HabGradeSheet } from "@/components/Home/Habits/hab-grade-sheet"
import { type OutputGradeResult } from "@/lib/calculations"
import { blendPriorityScore } from "@/lib/habit-priority"
import { useHabitsStore } from "@/lib/habits-store"
import { usePersistHydrated } from "@/lib/use-persist-hydrated"

type PeriodUnit = "day" | "week" | "month" | "season"

interface OutputGradeBreakdownDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  result: OutputGradeResult
  onToleranceChange: (value: number) => void
  periodUnit?: PeriodUnit
  usePriority?: boolean
  onUsePriorityChange?: (value: boolean) => void
  priorityScore?: number | null
}

export function OutputGradeBreakdownDialog({
  open,
  onOpenChange,
  result,
  onToleranceChange,
  periodUnit = "day",
  usePriority = false,
  onUsePriorityChange,
  priorityScore = null,
}: OutputGradeBreakdownDialogProps) {
  const bonus = result.curveBonus
  const noun = periodUnit
  const habitScope =
    periodUnit === "season" ? "season" : periodUnit === "day" ? "daily" : periodUnit === "week" ? "weekly" : "monthly"
  const shown = blendPriorityScore(result.grade, priorityScore, usePriority)
  const tubeColor = useHabitsStore((s) => s.outputGradeTubeColor)
  const setOutputGradeTubeColor = useHabitsStore((s) => s.setOutputGradeTubeColor)
  const hydrated = usePersistHydrated(useHabitsStore.persist)
  const heroWhole =
    result.daysIncluded === 0 || result.habits.length === 0 ? null : Number(shown.toFixed(0))
  const hero = heroWhole == null ? "—" : `${heroWhole}%`
  const showOrdinary = result.habits.length > 0 && (result.curveBonus > 0 || usePriority)
  const compared =
    showOrdinary && heroWhole != null
      ? gradeHeroDelta(heroWhole, Number(result.rawGrade.toFixed(0)), "ordinary")
      : null

  const equation =
    result.habits.length > 0 ? (
      <>
        {result.habits.map((h) => h.curved.toFixed(0)).join(" + ")}
        {" = "}
        {result.habits.reduce((a, h) => a + h.curved, 0).toFixed(0)}
        {" / "}
        {result.habits.length}
        {" = "}
        {result.grade.toFixed(0)}%
        {result.daysIncluded > 0
          ? ` · ${result.daysIncluded} ${noun}${result.daysIncluded === 1 ? "" : "s"} elapsed`
          : ""}
      </>
    ) : undefined

  const curveHint =
    bonus === 0
      ? "100% tolerance means no curve: each habit’s score equals elapsed row completion."
      : `Each habit is scored as raw + ${bonus} (so ${result.tolerance}% raw = 100%). Habits can go above 100%. A 0% habit stays 0 — the curve does not lift empty rows.`

  return (
    <HabGradeSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Perfect output"
      description={
        <>
          Current grade is the average of each {habitScope} habit’s elapsed row % after
          the output curve. Row % here is paced to elapsed {noun}s, not
          the grid’s full-window denominator. Raw completion and the span grade are unchanged;
          the curve only affects this grade.
        </>
      }
      contentClassName="is-output"
      tubeColor={tubeColor}
      onTubeColorChange={setOutputGradeTubeColor}
      tubeColorId="output-grade-tube-color"
      tubeColorAriaLabel="Perfect output tube color"
      tubeColorDisabled={!hydrated}
      hero={hero}
      showOrdinary={showOrdinary}
      ordinaryMark={compared?.mark}
      ordinaryText={
        compared != null ? compared.phrase : showOrdinary ? `ordinary ${result.rawGrade.toFixed(0)}%` : undefined
      }
      equation={equation}
      toleranceId="output-grade-tolerance"
      toleranceLabel="Output perfect threshold (tolerance)"
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
              label: "prioritized output",
            }
          : undefined
      }
    >
      {result.habits.length > 0 ? (
        <div className="hab-grade-sheet-proof" role="table" aria-label="Perfect output breakdown">
          <div className="hab-grade-sheet-proof-head" role="row">
            <span role="columnheader">Habit</span>
            <span role="columnheader">Raw</span>
            <span role="columnheader">Curved</span>
          </div>
          {result.habits.map((h) => (
            <div key={h.taskId} className="hab-grade-sheet-row" role="row">
              <span className="hab-grade-sheet-row-name" role="cell">
                {h.name}
              </span>
              <span className="hab-grade-sheet-row-readout" role="cell">
                {h.raw.toFixed(0)}%
              </span>
              <span className="hab-grade-sheet-row-readout" role="cell">
                {h.curved.toFixed(0)}%
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
        <p className="hab-grade-sheet-empty">No {habitScope} habits to grade yet.</p>
      )}
    </HabGradeSheet>
  )
}
