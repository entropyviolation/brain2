/**
 * components/Home/Habits/output-grade-breakdown-dialog.tsx — Perfect Output grade
 *
 * Thin wrapper over HabGradeSheet: OutputGradeResult habit proof table,
 * `outputGradeTubeColor` store key, Perfect output title/copy.
 */
"use client"

import { gradeHeroDelta, HabGradeProof, HabGradeSheet } from "@/components/Home/Habits/hab-grade-sheet"
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
  const preBlend = Number(result.grade.toFixed(0))
  const blendText =
    usePriority && heroWhole != null ? gradeHeroDelta(heroWhole, preBlend, "ordinary").phrase : null

  const curveHint = "An empty habit is not lifted."
  const equationNote =
    result.daysIncluded > 0
      ? `· ${result.daysIncluded} ${noun}${result.daysIncluded === 1 ? "" : "s"} elapsed`
      : undefined

  return (
    <HabGradeSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Perfect output"
      description={`The average of each ${habitScope} habit’s elapsed row after the curve; raw completion stays as logged, and a 0% habit stays 0.`}
      contentClassName="is-output"
      tubeColor={tubeColor}
      onTubeColorChange={setOutputGradeTubeColor}
      tubeColorId="output-grade-tube-color"
      tubeColorAriaLabel="Perfect output tube color"
      tubeColorDisabled={!hydrated}
      hero={hero}
      heroLine="Average of each habit’s curved score."
      blendText={blendText}
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
        <HabGradeProof
          ariaLabel="Perfect output breakdown"
          nameHeader="Habit"
          rows={result.habits.map((h) => ({
            key: h.taskId,
            name: h.name,
            rawText: `${h.raw.toFixed(0)}%`,
            curvedText: `${h.curved.toFixed(0)}%`,
            curvedValue: h.curved,
          }))}
          averageRaw={`${result.rawGrade.toFixed(0)}%`}
          averageCurved={`${result.grade.toFixed(0)}%`}
          equationNote={equationNote}
        />
      ) : (
        <p className="hab-grade-sheet-empty">No {habitScope} habits to grade yet.</p>
      )}
    </HabGradeSheet>
  )
}
