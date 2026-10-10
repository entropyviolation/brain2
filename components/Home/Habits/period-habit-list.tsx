/**
 * components/Home/Habits/period-habit-list.tsx — Weekly / monthly habit grid
 *
 * Compact spreadsheet matching the daily TaskGrid: habits × a window of weeks
 * or months, per-habit %, period-completion footer, tracked-time marks.
 * Layout CSS: `habit-grid.css`. Cell bodies: `HabitCompletionCell`
 * (presentational; completion writes stay here).
 * Double-click a footer period percent to list the habit titles in it.
 * Double-click the far-right period % for that habit's span.
 */
"use client"

import { useRef, useState, type CSSProperties } from "react"
import { Target } from "lucide-react"
import { HabitEditGemButton } from "@/components/Home/Habits/habit-gems"
import { HabitCompletionCell } from "@/components/Home/Habits/habit-completion-cell"
import { HabitCompletionDetail } from "@/components/Home/Habits/habit-completion-detail"
import { HabitRowName } from "@/components/Home/Habits/habit-row-name"
import { HabitPercentReadout } from "@/components/Home/Habits/habit-percent-readout"
import { HabitPeriodBreakdown } from "@/components/Home/Habits/habit-period-breakdown"
import { HabitSpanBreakdownDialog } from "@/components/Home/Habits/habit-span-breakdown"
import { periodBreakdownWindowTitle } from "@/lib/habit-period-breakdown"
import { habitSpanBreakdown, type SpanUnit } from "@/lib/habit-span-breakdown"
import type { WeeklyTask, TaskCompletion, WeeklyData, HabitFrequency } from "@/lib/types"
import { listRoutingFromLink } from "@/lib/habit-completion-pipeline"
import { habitStatReadingContext, loggedAmountForColumn } from "@/lib/habit-stat-pipeline"
import { isGoalType, isHabitGoalMet } from "@/lib/habit-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { completionCellShowsHatch, isMissedOpportunity, missedOpportunityWrite, printedGoalAmounts } from "@/lib/habit-missed-opportunity"
import { habitHiddenWhenComplete } from "@/lib/habit-completion-source"
import { incrementalCompletionPayload } from "@/lib/incremental-habits"
import { autoPriorityWeight, effectivePriorityWeight, priorityMarkPercent, priorityWash, priorityWashVars } from "@/lib/habit-priority"
import { pointerBeforeId, reorderIdList } from "@/lib/habit-order"
import { isExemptKind, type ExemptionKind } from "@/lib/habit-exemption"
import { useTaskStore } from "@/lib/task-store"
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
  highlightPriorities?: boolean
  ritualIds?: readonly string[]
  ritualMultiplier?: number
  showStreakMarks?: boolean
  onReorder?: (visibleIds: string[]) => void
  /** Single-period sheet: one column to the right of the period, soaking leftover width. */
  detailColumn?: boolean
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
  highlightPriorities = false,
  ritualIds = [],
  ritualMultiplier = 0,
  showStreakMarks = true,
  onReorder,
  detailColumn = false,
}: PeriodHabitListProps) {
  const dragRef = useRef<{ id: string; y: number } | null>(null)
  const [breakdownPeriod, setBreakdownPeriod] = useState<PeriodColumn | null>(null)
  const [spanTaskId, setSpanTaskId] = useState<string | null>(null)
  const vaultItems = useTaskStore((s) => s.tasks)
  const habitTasks = useHabitsStore((s) => s.tasks)
  const dailyData = useHabitsStore((s) => s.weeklyData)
  const weeklyHabitData = useHabitsStore((s) => s.weeklyHabitData)
  const monthlyHabitData = useHabitsStore((s) => s.monthlyHabitData)
  const gradeTolerance = useHabitsStore((s) => s.gradeTolerance)
  const outputGradeTolerance = useHabitsStore((s) => s.outputGradeTolerance)
  const accomplishmentThreshold = useHabitsStore((s) => s.accomplishmentThreshold)
  const statContext = habitStatReadingContext({
    tasks: habitTasks,
    weeklyData: dailyData,
    weeklyHabitData,
    monthlyHabitData,
    gradeTolerance,
    outputGradeTolerance,
    accomplishmentThreshold,
  })
  const current = periods.find((p) => p.isCurrent) ?? periods[periods.length - 1]
  const noun = frequency === "quarterly" ? "season" : frequency === "monthly" ? "month" : "week"

  const withLoggedAmount = (task: WeeklyTask, period: PeriodColumn, completion: TaskCompletion | undefined) => {
    if (!isGoalType(task.type)) return completion
    if (completion?.handCompleted !== undefined || completion?.manualValue !== undefined) return completion
    const link = task.listSentLink
    if (link?.listId && link.enabled !== false && listRoutingFromLink(link).target === "listLength") return completion
    const sum = loggedAmountForColumn(task, period, statContext)
    if (sum == null) return completion
    return { ...(completion ?? {}), value: sum, goal: completion?.goal ?? task.goal }
  }

  let visible = tasks
  if (hideCompleted && current) {
    visible = tasks.filter((task) => {
      const kind = exemptionKindFor?.(task, current.key)
      return !habitHiddenWhenComplete(task, withLoggedAmount(task, current, data[current.key]?.[task.id]), {
        date: current.date,
        weeklyData: data,
        exempt: isExemptKind(kind),
        periodPercent: calculateTaskPercentage(task.id),
      })
    })
  }

  const spanTask = spanTaskId ? tasks.find((task) => task.id === spanTaskId) ?? null : null
  const spanUnit: SpanUnit = frequency === "quarterly" ? "season" : frequency === "monthly" ? "month" : "week"
  const spanBreakdown = spanTask
    ? habitSpanBreakdown({
        task: spanTask,
        data,
        columns: periods.map((period) => ({
          key: period.key,
          title: `${period.label} ${period.sublabel}`.trim(),
          date: period.date,
        })),
        unit: spanUnit,
        asOf: new Date(),
        isExempt: exemptionKindFor
          ? (habit, key) => isExemptKind(exemptionKindFor(habit, key))
          : undefined,
      })
    : null

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
      <table className={`habit-grid${detailColumn ? " is-period-detail" : ""}${onReorder ? " is-reordering" : ""}`}>
        <colgroup>
          <col className="col-act" />
          <col className="col-name" />
          {periods.map((period) => (
            <col key={period.key} className="col-day" />
          ))}
          {detailColumn && current ? <col className="col-detail" /> : null}
          <col className="col-pct" />
        </colgroup>
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
            {detailColumn && current ? <th className="col-detail">Detail</th> : null}
            <th className="col-pct">%</th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={periods.length + (detailColumn ? 4 : 3)} className="h-16 text-center text-muted-foreground">
                Nothing left for this period.
              </td>
            </tr>
          ) : (
            visible.map((task) => {
              const percentage = calculateTaskPercentage(task.id)
              const prio = effectivePriorityWeight(task, data, asOf, frequency)
              const neglect = autoPriorityWeight(task, data, asOf, frequency)
              const ritual = ritualIds.includes(task.id)
              const wash = priorityWash({
                highlight: highlightPriorities,
                ritual,
                neglect,
                selected: priorityMarkPercent(task, asOf, ritual),
              })
              const visibleIds = visible.map((row) => row.id)
              return (
                <tr
                  key={task.id}
                  className="group"
                  data-habit-id={task.id}
                  onPointerDown={
                    onReorder
                      ? (event) => {
                          if ((event.target as HTMLElement).closest("button, input, textarea, a")) return
                          dragRef.current = { id: task.id, y: event.clientY }
                          event.currentTarget.setPointerCapture?.(event.pointerId)
                        }
                      : undefined
                  }
                  onPointerUp={
                    onReorder
                      ? (event) => {
                          const drag = dragRef.current
                          dragRef.current = null
                          if (!drag || drag.id !== task.id || Math.abs(event.clientY - drag.y) < 4) return
                          const tbody = event.currentTarget.parentElement
                          if (!tbody) return
                          const rows = [...tbody.querySelectorAll<HTMLElement>("tr[data-habit-id]")].map((row) => {
                            const box = row.getBoundingClientRect()
                            return { id: row.dataset.habitId || "", top: box.top, height: box.height }
                          })
                          const next = reorderIdList(visibleIds, task.id, pointerBeforeId(rows, task.id, event.clientY))
                          if (next.some((id, index) => id !== visibleIds[index])) onReorder(next)
                        }
                      : undefined
                  }
                >
                  <td className="col-act">
                    <HabitEditGemButton task={task} onEdit={onEdit} />
                  </td>
                  <td
                    className={`col-name font-medium${wash.className ? ` ${wash.className}` : ""}`}
                    title={task.name}
                    style={priorityWashVars(wash) as CSSProperties | undefined}
                  >
                    <HabitRowName
                      name={task.name}
                      prio={prio}
                      showMarks={showStreakMarks}
                      ritualMultiplier={ritual ? ritualMultiplier : 0}
                    />
                  </td>
                  {periods.map((period) => {
                    const kind = exemptionKindFor?.(task, period.key) ?? "required"
                    const exempt = isExemptKind(kind)
                    const completion = data[period.key]?.[task.id]
                    const shown = withLoggedAmount(task, period, completion)
                    const printed = printedGoalAmounts(task, shown, vaultItems, period.date)
                    const showHatch = completionCellShowsHatch({
                      exempt,
                      met: isHabitGoalMet(task, shown, { date: period.date, weeklyData: data }),
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
                          completion={shown}
                          weeklyData={data}
                          variant="period"
                          frequency={frequency}
                          exemptionNoun={noun}
                          exemptionWand={exemptionWand}
                          missedOpWand={missedOpWand}
                          hideCompletedAndMissed={hideCompletedAndMissed}
                          onToggleMissedOpportunity={(missed, missReason) =>
                            onUpdate(task.id, period.date, missedOpportunityWrite(missed, missReason))
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
                  {detailColumn && current ? (
                    <td className="col-detail">
                      <HabitCompletionDetail
                        task={task}
                        completion={withLoggedAmount(task, current, data[current.key]?.[task.id])}
                        now={current.date}
                      />
                    </td>
                  ) : null}
                  <td
                    className="col-pct"
                    data-testid="habit-span-percent"
                    title="Double-click for the span breakdown"
                    onPointerDown={(event) => event.stopPropagation()}
                    onDoubleClick={(event) => {
                      event.preventDefault()
                      event.stopPropagation()
                      setSpanTaskId(task.id)
                    }}
                  >
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
                  <td
                    key={period.key}
                    className={`col-day ${period.isCurrent ? "habit-day-today" : ""}`}
                    onDoubleClick={() => setBreakdownPeriod(period)}
                  >
                    <HabitPercentReadout value={percentage} label={`${period.label} ${completionLabel}`} />
                  </td>
                )
              })}
              {detailColumn ? <td className="col-detail" /> : null}
              <td className="col-pct" />
            </tr>
          )}
        </tbody>
      </table>
      {breakdownPeriod ? (
        <HabitPeriodBreakdown
          open
          onOpenChange={(next) => {
            if (!next) setBreakdownPeriod(null)
          }}
          title={periodBreakdownWindowTitle(breakdownPeriod.label, breakdownPeriod.sublabel)}
          tasks={tasks}
          period={breakdownPeriod}
          data={data}
          isExempt={
            exemptionKindFor
              ? (task, key) => isExemptKind(exemptionKindFor(task, key))
              : undefined
          }
        />
      ) : null}
      {spanBreakdown ? (
        <HabitSpanBreakdownDialog
          open
          onOpenChange={(next) => {
            if (!next) setSpanTaskId(null)
          }}
          breakdown={spanBreakdown}
        />
      ) : null}
    </div>
  )
}

export function filterHabitsByFrequency(tasks: WeeklyTask[], frequency: HabitFrequency) {
  return tasks.filter((t) => (t.frequency || "daily") === frequency)
}
