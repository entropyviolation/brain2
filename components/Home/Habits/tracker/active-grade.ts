/**
 * tracker/active-grade.ts — Which bundle feeds the grade tubes.
 *
 * Pure picks from the open tab. Tubes stay at 0 and "—" until hydration.
 */
import { format } from "date-fns"
import type { OutputGradeResult, WeekGradeResult } from "@/lib/calculations"
import { blendPriorityScore } from "@/lib/habit-priority"
import type { HabitFreqTab } from "@/lib/app-navigation"

export function resolveActiveGrade(input: {
  habitTab: HabitFreqTab
  hydrated: boolean
  weekPrioGrade: number | null
  monthlyPrioGrade: number | null
  weeklyPrioGrade: number | null
  quarterlyPrioGrade: number | null
  outputPrioGrade: number | null
  weeklyPrioOutput: number | null
  monthlyPrioOutput: number | null
  quarterlyPrioOutput: number | null
  weekGrade: WeekGradeResult
  weeklyGrade: WeekGradeResult
  monthlyGrade: WeekGradeResult
  quarterlyGrade: WeekGradeResult
  outputGrade: OutputGradeResult
  weeklyOutput: OutputGradeResult
  monthlyOutput: OutputGradeResult
  quarterlyOutput: OutputGradeResult
  gradeUsePriority: boolean
  outputUsePriority: boolean
  weekDates: Date[]
}) {
  const { habitTab, hydrated } = input
  const activePrioGrade =
    habitTab === "quarterly"
      ? input.quarterlyPrioGrade
      : habitTab === "monthly"
        ? input.monthlyPrioGrade
        : habitTab === "weekly"
          ? input.weeklyPrioGrade
          : input.weekPrioGrade
  const activePrioOutput =
    habitTab === "quarterly"
      ? input.quarterlyPrioOutput
      : habitTab === "monthly"
        ? input.monthlyPrioOutput
        : habitTab === "weekly"
          ? input.weeklyPrioOutput
          : input.outputPrioGrade
  const activeGrade =
    habitTab === "quarterly"
      ? input.quarterlyGrade
      : habitTab === "monthly"
        ? input.monthlyGrade
        : habitTab === "weekly"
          ? input.weeklyGrade
          : input.weekGrade
  const activeOutput =
    habitTab === "quarterly"
      ? input.quarterlyOutput
      : habitTab === "monthly"
        ? input.monthlyOutput
        : habitTab === "weekly"
          ? input.weeklyOutput
          : input.outputGrade
  // Hold tubes until the vault lands so a hollow seed cannot paint "—" / 0 and stick.
  const shownGrade = hydrated ? blendPriorityScore(activeGrade.grade, activePrioGrade, input.gradeUsePriority) : 0
  const shownOutput = hydrated ? blendPriorityScore(activeOutput.grade, activePrioOutput, input.outputUsePriority) : 0
  const gradeDaysReady = hydrated ? activeGrade.daysIncluded : 0
  const outputReady = hydrated && activeOutput.daysIncluded > 0 && activeOutput.habits.length > 0
  const gradePeriodUnit: "season" | "month" | "week" | "day" =
    habitTab === "quarterly" ? "season" : habitTab === "monthly" ? "month" : habitTab === "weekly" ? "week" : "day"
  const gradeLabel = habitTab === "daily" ? "Week grade" : "Span grade"
  const gradeThrough =
    gradeDaysReady === 0
      ? null
      : habitTab === "daily"
        ? gradeDaysReady === 7
          ? "full week"
          : `through ${format(input.weekDates[gradeDaysReady - 1], "EEE")}`
        : `through ${format(
            activeGrade.days[gradeDaysReady - 1].date,
            habitTab === "quarterly" ? "MMM yyyy" : habitTab === "monthly" ? "MMM yyyy" : "MMM d",
          )}`
  return {
    activePrioGrade,
    activePrioOutput,
    activeGrade,
    activeOutput,
    shownGrade,
    shownOutput,
    gradeDaysReady,
    outputReady,
    gradePeriodUnit,
    gradeLabel,
    gradeThrough,
  }
}
