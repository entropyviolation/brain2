/**
 * components/Home/Habits/habit-source-detail.tsx — One square, read only
 *
 * Opens from a double-click on a cell whose pipeline has no By hand source.
 * Shows the habit, that period, each source that was asked, the numbers it
 * pulled, and the result. A previous-period compare also shows each pair,
 * which side won, and how many were higher.
 *
 * A goal fed by a list (list length or this period's set) replaces that
 * account with three rows from `listPeriodMeasure`: list length, how many
 * were counted in the opened span, and how many are left. The length is not
 * an input. Once the period has ended it is frozen. A real zero prints 0.
 * Tracking tags lists catalog names (plus unit, combine, on/off); Tagged
 * tasks shows the count-tag name and that each Done is 1 toward the goal.
 * Close writes nothing.
 */
"use client"

import { useMemo } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { listPeriodMeasure, listRoutingFromLink } from "@/lib/habit-completion-pipeline"
import { currentExemptionContext, isHabitPeriodExempt } from "@/lib/habit-exemption"
import { isGoalType } from "@/lib/habit-utils"
import { describeSourceSquare } from "@/lib/habit-source-square"
import { useHabitsStore } from "@/lib/habits-store"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { HabitFrequency, HabitListMeasure, TaskCompletion, WeeklyTask } from "@/lib/types"
import "./habit-form-dialog.css"

export interface ListSpanDetailLine {
  name: string
  value: string
  /** The frozen list length. It is recorded ink, not a field. */
  frozen: boolean
}

/** First word of the list name, so "texts to send" reads as texts. */
function countedName(listName: string | undefined): string {
  const word = listName?.trim().split(/\s+/)[0]?.toLowerCase()
  return word || "items"
}

function periodWord(frequency: HabitFrequency | undefined): string {
  if (frequency === "daily") return "day"
  if (frequency === "monthly") return "month"
  if (frequency === "quarterly") return "season"
  return "week"
}

function measureWords(measure: HabitListMeasure): { past: string; left: string } {
  if (measure === "completed") return { past: "completed", left: "complete" }
  if (measure === "added") return { past: "added", left: "add" }
  return { past: "sent", left: "send" }
}

/**
 * Three labels for one period. The counted name and the period name follow
 * the list and the habit, so a texts week and a chores month do not share a sentence.
 */
export function listSpanDetailLines(input: {
  listName: string | undefined
  measure: HabitListMeasure
  frequency: HabitFrequency | undefined
  listLength: number
  sentInSpan: number
  leftToSend: number
  frozen: boolean
}): ListSpanDetailLine[] {
  const name = countedName(input.listName)
  const period = periodWord(input.frequency)
  const words = measureWords(input.measure)
  const count = (value: number) => (Number.isFinite(value) ? String(value) : "0")
  return [
    { name: "List length", value: count(input.listLength), frozen: input.frozen },
    { name: `${name} ${words.past} this ${period}`, value: count(input.sentInSpan), frozen: false },
    { name: `${name} left to ${words.left}`, value: count(input.leftToSend), frozen: false },
  ]
}

export function HabitSourceDetail({
  open,
  onOpenChange,
  task,
  periodLabel,
  date,
  completion,
  now: clock,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  task: WeeklyTask
  periodLabel: string
  date: Date
  completion: TaskCompletion | undefined
  /** Clock for whether the list length has frozen. Defaults to now. */
  now?: Date
}) {
  const tasks = useHabitsStore((s) => s.tasks)
  const weeklyData = useHabitsStore((s) => s.weeklyData)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const gradeTolerance = useHabitsStore((s) => s.gradeTolerance)
  const outputGradeTolerance = useHabitsStore((s) => s.outputGradeTolerance)
  const habitExemptions = useHabitsStore((s) => s.habitExemptions)
  const items = useTaskStore((s) => s.tasks)
  const lists = useTaskStore((s) => s.lists)
  const trackingTags = useTimeTrackingStore((s) => s.tags)
  const now = useMemo(() => clock ?? new Date(), [clock])
  const spanLines = useMemo(() => {
    if (!isGoalType(task.type)) return null
    const measure = listPeriodMeasure(task, items, date, now)
    if (!measure) return null
    const link = task.listSentLink
    const listName = lists.find((list) => list.id === link?.listId)?.name
    return listSpanDetailLines({
      listName,
      measure: listRoutingFromLink(link).measure,
      frequency: task.frequency,
      listLength: measure.listLength,
      sentInSpan: measure.sentInSpan,
      leftToSend: measure.leftToSend,
      frozen: measure.frozen,
    })
  }, [task, items, lists, date, now])
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
      trackingTags,
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
    trackingTags,
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
          {spanLines ? (
            <ul className="habit95-span-facts" aria-label="List for this period">
              {spanLines.map((line) => (
                <li key={line.name} data-frozen={line.frozen ? "true" : "false"}>
                  <span>{line.name}</span>
                  <span className="habit95-span-facts-num">{line.value}</span>
                </li>
              ))}
            </ul>
          ) : (
            <>
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
            </>
          )}
          <button type="button" className="habit95-btn" aria-label="Close source detail" onClick={() => onOpenChange(false)}>
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
