/**
 * components/Home/Habits/period-habit-list.tsx — Weekly / monthly habit grid
 *
 * Compact spreadsheet matching the daily TaskGrid: habits × a window of weeks
 * or months, per-habit %, period-completion footer, tracked-time marks.
 * Layout CSS: `habit-grid.css`. Cell bodies: `HabitCompletionCell`
 * (presentational; completion writes stay here).
 */
"use client"

import { Target } from "lucide-react"
import { HabitEditGemButton } from "@/components/Home/Habits/habit-gems"
import { HabitCompletionCell } from "@/components/Home/Habits/habit-completion-cell"
import { HabitRowName } from "@/components/Home/Habits/habit-row-name"
import { HabitPercentReadout } from "@/components/Home/Habits/habit-percent-readout"
import type { WeeklyTask, TaskCompletion, WeeklyData, HabitFrequency } from "@/lib/types"
import { isGoalType, isHabitGoalMet } from "@/lib/habit-utils"
import { completionCellShowsHatch, isMissedOpportunity, printedGoalAmounts } from "@/lib/habit-missed-opportunity"
import { habitHiddenWhenComplete } from "@/lib/habit-completion-source"
import { incrementalCompletionPayload } from "@/lib/incremental-habits"
import { effectivePriorityWeight } from "@/lib/habit-priority"
import { isExemptKind, type ExemptionKind } from "@/lib/habit-exemption"
import type { HabitPeriod } from "@/lib/calculations"
import {
  DEFAULT_HABIT_BIRTHDAY,
  habitMonthWindowStarts,
  type HabitBirthday,
  type HabitMonthWindowMode,
} from "@/lib/habit-month-window"
import {
  DEFAULT_HABIT_WEEK_WINDOW,
  habitWeekWindowStarts,
  type HabitWeekWindowMode,
} from "@/lib/habit-week-window"
import {
  formatLocalMonthKey,
  getWeekString,
  isSameLocalMonth,
  isSameLocalWeek,
} from "@/lib/date-utils"
import { format } from "date-fns"
import { precedingQuarterStarts, quarterKey, quarterOf, seasonOfDate } from "@/lib/seasons"
import "./habit-grid.css"

export interface PeriodColumn extends HabitPeriod {
  label: string
  sublabel: string
  isCurrent: boolean
}

/**
 * Weekly columns from `habitWeekWindowStarts` (same list as the span grade).
 * Includes the week that contains `asOf`. A Monday after that week is not a
 * column, except This month, which keeps every Monday in the civil month.
 */
export function weekPeriodColumns(
  asOf: Date,
  mode: HabitWeekWindowMode = DEFAULT_HABIT_WEEK_WINDOW,
): PeriodColumn[] {
  return habitWeekWindowStarts(asOf, mode).map((start) => {
    const end = new Date(start)
    end.setDate(start.getDate() + 6)
    return {
      key: getWeekString(start),
      date: start,
      label: `${start.getMonth() + 1}/${start.getDate()}`,
      sublabel: `–${end.getMonth() + 1}/${end.getDate()}`,
      isCurrent: isSameLocalWeek(start, asOf),
    }
  })
}

/** Seven seasons ending at `anchor`'s quarter. Highlights this season. */
export function seasonPeriodColumns(anchor: Date, asOf = new Date()): PeriodColumn[] {
  const currentKey = quarterKey(asOf)
  return precedingQuarterStarts(anchor, 7).map((start) => ({
    key: quarterKey(start),
    date: start,
    label: seasonOfDate(start),
    sublabel: `Q${quarterOf(start)}`,
    isCurrent: quarterKey(start) === currentKey,
  }))
}

/**
 * Monthly columns from `habitMonthWindowStarts` (same list as the span grade).
 * Includes the month that contains `asOf`. Later months are not columns.
 */
export function monthPeriodColumns(
  asOf: Date,
  mode: HabitMonthWindowMode = "yearToDate",
  birthday: HabitBirthday = DEFAULT_HABIT_BIRTHDAY,
): PeriodColumn[] {
  return habitMonthWindowStarts(asOf, mode, birthday).map((start) => ({
    key: formatLocalMonthKey(start),
    date: start,
    label: format(start, "MMM"),
    sublabel: format(start, "yyyy"),
    isCurrent: isSameLocalMonth(start, asOf),
  }))
}

interface PeriodHabitListProps {
  tasks: WeeklyTask[]
  periods: PeriodColumn[]
  data: WeeklyData
  onUpdate: (taskId: string, periodDate: Date, completion: TaskCompletion) => void
  onEdit: (task: WeeklyTask) => void
  hideCompleted?: boolean
  calculateTaskPercentage: (taskId: string) => number | null
  calculatePeriodPercentage: (periodKey: string) => number | null
  exemptionWand?: boolean
  exemptionKindFor?: (task: WeeklyTask, periodKey: string) => ExemptionKind
  onSetExempt?: (taskId: string, periodKey: string, periodDate: Date, exempt: boolean) => void
  /** Missed op wand: eligible cells toggle `missedOpportunity`. */
  missedOpWand?: boolean
  /** Hatch completed and missed-op cells. Does not remove rows. */
  hideCompletedAndMissed?: boolean
  completionLabel?: string
  emptyLabel?: string
  asOf?: Date
  frequency?: HabitFrequency
}

export function PeriodHabitList({
  tasks,
  periods,
  data,
  onUpdate,
  onEdit,
  hideCompleted = false,
  calculateTaskPercentage,
  calculatePeriodPercentage,
  exemptionWand = false,
  exemptionKindFor,
  onSetExempt,
  missedOpWand = false,
  hideCompletedAndMissed = false,
  completionLabel = "Period completion",
  emptyLabel = "No habits yet. Add one to get started.",
  asOf = new Date(),
  frequency = "weekly",
}: PeriodHabitListProps) {
  const current = periods.find((p) => p.isCurrent) ?? periods[periods.length - 1]
  const noun = frequency === "quarterly" ? "season" : frequency === "monthly" ? "month" : "week"

  let visible = tasks
  if (hideCompleted && current) {
    visible = tasks.filter((task) => {
      const kind = exemptionKindFor?.(task, current.key)
      return !habitHiddenWhenComplete(task, data[current.key]?.[task.id], {
        date: current.date,
        weeklyData: data,
        exempt: isExemptKind(kind),
      })
    })
  }

  if (visible.length === 0 && tasks.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Target className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>{emptyLabel}</p>
      </div>
    )
  }

  return (
    <div className="habit-grid-wrap">
      <table className="habit-grid">
        <thead>
          <tr>
            <th className="col-act" />
            <th className="col-name">Task</th>
            {periods.map((period) => (
              <th key={period.key} className={`col-day ${period.isCurrent ? "habit-day-today" : ""}`}>
                {period.label}
                <span className="habit-day-sub">{period.sublabel}</span>
              </th>
            ))}
            <th className="col-pct">%</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={periods.length + 3} className="h-16 text-center text-muted-foreground">
                Nothing left for this period.
              </td>
            </tr>
          ) : (
            visible.map((task) => {
              const percentage = calculateTaskPercentage(task.id)
              const prio = effectivePriorityWeight(task, data, asOf, frequency)
              return (
                <tr key={task.id} className="group">
                  <td className="col-act">
                    <HabitEditGemButton task={task} onEdit={onEdit} />
                  </td>
                  <td className="col-name font-medium" title={task.name}>
                    <HabitRowName name={task.name} prio={prio} />
                  </td>
                  {periods.map((period) => {
                    const kind = exemptionKindFor?.(task, period.key) ?? "required"
                    const exempt = isExemptKind(kind)
                    const completion = data[period.key]?.[task.id]
                    const printed = printedGoalAmounts(task, completion)
                    const showHatch = completionCellShowsHatch({
                      exempt,
                      met: isHabitGoalMet(task, completion, { date: period.date, weeklyData: data }),
                      missed: isMissedOpportunity(completion),
                      exemptionWand,
                      missedOpWand,
                      hideCompletedAndMissed,
                      shown: printed.shown,
                      goal: printed.goal,
                    })
                    return (
                      <td
                        key={period.key}
                        className={`col-day ${period.isCurrent ? "habit-day-today" : ""}${showHatch ? " is-exempt" : ""}`}
                      >
                        <HabitCompletionCell
                          task={task}
                          date={period.date}
                          periodKey={period.key}
                          periodLabel={period.label}
                          completion={completion}
                          weeklyData={data}
                          variant="period"
                          frequency={frequency}
                          exemptionNoun={noun}
                          exemptionWand={exemptionWand}
                          missedOpWand={missedOpWand}
                          hideCompletedAndMissed={hideCompletedAndMissed}
                          onToggleMissedOpportunity={(missed) =>
                            onUpdate(task.id, period.date, { missedOpportunity: missed })
                          }
                          exemptionKind={kind}
                          onSetExempt={
                            onSetExempt
                              ? (checked) => onSetExempt(task.id, period.key, period.date, checked)
                              : undefined
                          }
                          onBooleanChange={(checked) =>
                            onUpdate(task.id, period.date, { completed: checked })
                          }
                          onGoalChange={(n) => {
                            if (!isGoalType(task.type)) return
                            onUpdate(task.id, period.date, { value: n, goal: task.goal || 0 })
                          }}
                          onTextChange={(text) => onUpdate(task.id, period.date, { text })}
                          onIncrementalChange={(n) =>
                            onUpdate(task.id, period.date, incrementalCompletionPayload(n))
                          }
                        />
                      </td>
                    )
                  })}
                  <td className="col-pct">
                    <HabitPercentReadout value={percentage} label={`${task.name} period`} />
                  </td>
                </tr>
              )
            })
          )}

          {visible.length > 0 && (
            <tr className="habit-grid-foot font-semibold">
              <td className="col-act" />
              <td className="col-name">{completionLabel}</td>
              {periods.map((period) => {
                const percentage = calculatePeriodPercentage(period.key)
                return (
                  <td key={period.key} className={`col-day ${period.isCurrent ? "habit-day-today" : ""}`}>
                    <HabitPercentReadout value={percentage} label={`${period.label} ${completionLabel}`} />
                  </td>
                )
              })}
              <td className="col-pct" />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function filterHabitsByFrequency(tasks: WeeklyTask[], frequency: HabitFrequency) {
  return tasks.filter((t) => (t.frequency || "daily") === frequency)
}
