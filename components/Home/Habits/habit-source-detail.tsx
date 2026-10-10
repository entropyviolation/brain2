/**
 * components/Home/Habits/habit-source-detail.tsx — One square, read only
 *
 * Opens from a double-click on a cell whose pipeline has no By hand source.
 * Shows the habit, that period, each source that was asked, the numbers it
 * pulled, and the result. A previous-period compare also shows each pair,
 * which side won, and how many were higher. Close writes nothing.
 */
"use client"

import { useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { currentExemptionContext, isHabitPeriodExempt } from "@/lib/habit-exemption"
import { describeSourceSquare } from "@/lib/habit-source-square"
import { useHabitsStore } from "@/lib/habits-store"
import type { HabitFrequency, TaskCompletion, WeeklyTask } from "@/lib/types"
import "./habit-form-dialog.css"

export function HabitSourceDetail({
  open,
  onOpenChange,
  task,
  periodLabel,
  date,
  completion,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: WeeklyTask
  periodLabel: string
  date: Date
  completion: TaskCompletion | undefined
}) {
  const tasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const gradeTolerance = useHabitsStore((s) => s.gradeTolerance)
  const outputGradeTolerance = useHabitsStore((s) => s.outputGradeTolerance)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const square = useMemo(() => {
    const exemptionContext = currentExemptionContext()
    return describeSourceSquare({
      task,
      periodLabel,
      date,
      completion,
      tasks,
      weeklyData,
      weeklyHabitData,
      monthlyHabitData,
      gradeTolerance,
      outputGradeTolerance,
      isExempt: (habit, key) =>
        isHabitPeriodExempt(habit, key, (habit.frequency || "daily") as HabitFrequency, habitExemptions, exemptionContext),
    })
  }, [
    task,
    periodLabel,
    date,
    completion,
    tasks,
    weeklyData,
    weeklyHabitData,
    monthlyHabitData,
    gradeTolerance,
    outputGradeTolerance,
    habitExemptions,
  ])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="habit95-dialog flex flex-col sm:max-w-[420px]" hideClose data-ui-name="Habit source detail">
        <DialogHeader className="habit95-title-bar flex-row items-center space-y-0 text-left">
          <DialogTitle className="habit95-title-text">{square.habitName}</DialogTitle>
          <DialogDescription className="sr-only">
            Read-only account of {square.habitName} for {square.periodLabel}. Closing writes nothing.
          </DialogDescription>
          <button type="button" className="habit95-title-btn b2-close-key" aria-label="Close" onClick={() => onOpenChange(false)}>
            ×
          </button>
        </DialogHeader>
        <div className="habit95-body">
          <p className="habit95-hint">{square.periodLabel}</p>
          {square.sources.map((source) => (
            <div key={source.id}>
              <p className="habit95-hint">{source.label}</p>
              <ul className="habit95-stat-readout" aria-label={source.label}>
                {source.lines.map((line) => (
                  <li key={`${source.id}-${line.name}`}>
                    <span>{line.name}</span>
                    <span>{line.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {square.compare ? (
            <ul className="habit95-stat-readout" aria-label="Compared with the previous period">
              {square.compare.pairs.map((pair) => (
                <li key={pair.label}>
                  <span>
                    {pair.label}: {pair.thisSide} vs {pair.previousSide}
                  </span>
                  <span>{pair.winner}</span>
                </li>
              ))}
            </ul>
          ) : null}
          <p className="habit95-hint">Result: {square.result}</p>
          <button type="button" className="habit95-btn" aria-label="Close source detail" onClick={() => onOpenChange(false)}>
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
