/**
 * components/Home/Habits/task-grid.tsx — Habit grid
 *
 * Compact spreadsheet: gem/edit | wrapping name + streak | 7 weekdays
 * (or Day View: the selected day only, larger bold titles) | week % readout
 * (glass thermometer or numeric LED; Day View uses the same tube, wider).
 * Yes/No cells are photoreal lamps. Delete lives in habit settings.
 * Climb cells stay `value / target`. Layout: `habit-grid.css`.
 * Cell bodies: `HabitCompletionCell` (presentational; writes stay here).
 *
 * Spec: §9.2 (habit types), §9.3 (display & interaction).
 */
"use client"

import { useCallback, useRef, type CSSProperties } from "react"
import { type WeeklyTask as Task, TaskType, type TaskCompletion, type WeeklyData } from "@/lib/types"
import { formatLocalDateKey, getDayOfWeek, isToday, startOfLocalDay } from "@/lib/date-utils"
import { isGoalType, isHabitGoalMet } from "@/lib/habit-utils"
import { completionCellShowsHatch, isMissedOpportunity, printedGoalAmounts } from "@/lib/habit-missed-opportunity"
import { habitHiddenWhenComplete } from "@/lib/habit-completion-source"
import { incrementalCompletionPayload } from "@/lib/incremental-habits"
import { habitWeekStreakSummary } from "@/lib/habit-week-streaks"
import { autoPriorityWeight, effectivePriorityWeight, priorityMarkPercent, priorityWash, priorityWashVars } from "@/lib/habit-priority"
import { pointerBeforeId, reorderIdList } from "@/lib/habit-order"
import { TooltipProvider } from "@/components/ui/tooltip"
import { HabitEditGemButton } from "@/components/Home/Habits/habit-gems"
import { HabitCompletionCell } from "@/components/Home/Habits/habit-completion-cell"
import { HabitRowName } from "@/components/Home/Habits/habit-row-name"
import { HabitPercentReadout } from "@/components/Home/Habits/habit-percent-readout"
import { habitContributesWillpowerStone } from "@/lib/willpower-stones"
import { isExemptKind, type ExemptionKind } from "@/lib/habit-exemption"
import "./habit-grid.css"

interface TaskGridProps {
  tasks: Task[]
  weeklyData: WeeklyData
  weekDates: Date[]
  onUpdateTaskCompletion: (taskId: string, date: Date, completion: TaskCompletion) => void
  onEditTask: (task: Task) => void
  calculateTaskPercentage: (taskId: string) => number | null
  calculateDayPercentage: (date: Date, index: number) => number | null
  hideCompleted?: boolean
  /** Exemption wand: every cell is a lamp for “this period is waived.” */
  exemptionWand?: boolean
  exemptionKindFor?: (task: Task, dateKey: string) => ExemptionKind
  onSetExempt?: (taskId: string, date: Date, exempt: boolean) => void
  /** Missed op wand: eligible cells toggle `missedOpportunity`. */
  missedOpWand?: boolean
  /** Hatch completed and missed-op cells. Does not remove rows. */
  hideCompletedAndMissed?: boolean
  viewMode?: "week" | "day"
  /** When true, only the selected day's column plus the week % column. */
  dayView?: boolean
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
  /** Green / red name wash. Off leaves the name cell uncolored. */
  highlightPriorities?: boolean
  ritualIds?: readonly string[]
  /** Morning-ritual × shown under the name when that habit is in today's ritual. */
  ritualMultiplier?: number
  /** Streaks and × under the name. Off hides them. */
  showStreakMarks?: boolean
  /** While set, pointer-dragging a row reorders the visible ids. */
  onReorder?: (visibleIds: string[]) => void
}

export function TaskGrid({
  tasks,
  weeklyData,
  weekDates,
  onUpdateTaskCompletion,
  onEditTask,
  calculateTaskPercentage,
  calculateDayPercentage,
  hideCompleted = false,
  exemptionWand = false,
  exemptionKindFor,
  onSetExempt,
  missedOpWand = false,
  hideCompletedAndMissed = false,
  viewMode = "week",
  dayView = false,
  selectedDate,
  onDateSelect,
  highlightPriorities = false,
  ritualIds = [],
  ritualMultiplier = 0,
  showStreakMarks = true,
  onReorder,
}: TaskGridProps) {
  const weekStart = weekDates[0] ?? new Date()
  const asOf = selectedDate ?? new Date()
  const focusDate = startOfLocalDay(
    selectedDate ?? weekDates.find((d) => isToday(d)) ?? weekDates[weekDates.length - 1] ?? new Date(),
  )
  const sheetDates = dayView ? [focusDate] : weekDates

  let filteredTasks = tasks

  if (hideCompleted && viewMode === "day" && selectedDate) {
    const dateKey = formatLocalDateKey(selectedDate)
    filteredTasks = filteredTasks.filter((task) => {
      const kind = exemptionKindFor?.(task, dateKey)
      return !habitHiddenWhenComplete(task, weeklyData[dateKey]?.[task.id], {
        date: selectedDate,
        weeklyData,
        exempt: isExemptKind(kind),
        periodPercent: calculateTaskPercentage(task.id),
      })
    })
  }

  const handleBooleanChange = useCallback((taskId: string, date: Date, checked: boolean) => {
    onUpdateTaskCompletion(taskId, date, { completed: checked })
  }, [onUpdateTaskCompletion])

  const handleGoalChange = useCallback((taskId: string, date: Date, value: number | undefined) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || !isGoalType(task.type)) return
    onUpdateTaskCompletion(taskId, date, { value, goal: task.goal || 0 })
  }, [onUpdateTaskCompletion, tasks])

  const handleTextChange = useCallback((taskId: string, date: Date, text: string) => {
    onUpdateTaskCompletion(taskId, date, { text })
  }, [onUpdateTaskCompletion])

  const dragRef = useRef<{ id: string; y: number } | null>(null)
  const visibleIds = filteredTasks.map((task) => task.id)

  const handleIncrementalChange = useCallback((taskId: string, date: Date, value: number | undefined) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.type !== TaskType.INCREMENTAL) return
    onUpdateTaskCompletion(taskId, date, incrementalCompletionPayload(value))
  }, [onUpdateTaskCompletion, tasks])

  return (
    <div className="habit-grid-wrap">
      <TooltipProvider>
      <table className={`habit-grid${dayView ? " is-day-view" : ""}${onReorder ? " is-reordering" : ""}`}>
        <thead>
          <tr>
            <th className="col-act" />
            <th className="col-name">Task</th>
            {sheetDates.map((date) => (
              <th
                key={date.toISOString()}
                className={`col-day ${isToday(date) ? "habit-day-today" : ""}`}
                onClick={() => viewMode === "week" && onDateSelect?.(date)}
              >
                {getDayOfWeek(date).substring(0, 3)}
                <span className="habit-day-sub">
                  {date.getMonth() + 1}/{date.getDate()}
                </span>
              </th>
            ))}
            <th className="col-pct">%</th>
          </tr>
        </thead>
        <tbody>
          {filteredTasks.length === 0 ? (
            <tr>
              <td colSpan={sheetDates.length + 3} className="h-16 text-center text-muted-foreground">
                {tasks.length === 0 ? "No habits yet. Add one to get started." : "Nothing left for this day."}
              </td>
            </tr>
          ) : (
            filteredTasks.map((task) => {
              const percentage = calculateTaskPercentage(task.id)
              const weekStreak = habitWeekStreakSummary(task, weeklyData, weekStart, asOf, (key) => {
                const kind = exemptionKindFor?.(task, key)
                return isExemptKind(kind)
              })
              const prio = effectivePriorityWeight(task, weeklyData, asOf, "daily")
              const neglect = autoPriorityWeight(task, weeklyData, asOf, "daily")
              const ritual = ritualIds.includes(task.id)
              const wash = priorityWash({
                highlight: highlightPriorities,
                ritual,
                neglect,
                selected: priorityMarkPercent(task, asOf, ritual),
              })
              const streakTitle = [
                `${weekStreak.thisWeekDays} day${weekStreak.thisWeekDays === 1 ? "" : "s"} done this week`,
                weekStreak.current > 0 ? `${weekStreak.current} week streak of 4+ days` : "no 4+ day week streak",
                weekStreak.longest > weekStreak.current ? `best ${weekStreak.longest}` : null,
              ]
                .filter(Boolean)
                .join(". ")
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
                    <HabitEditGemButton
                      task={task}
                      onEdit={onEditTask}
                      inverted={habitContributesWillpowerStone(task, weeklyData, weekDates)}
                    />
                  </td>
                  <td
                    className={`col-name font-medium${wash.className ? ` ${wash.className}` : ""}`}
                    title={`${task.name}. ${streakTitle}`}
                    style={priorityWashVars(wash) as CSSProperties | undefined}
                  >
                    <HabitRowName
                      name={task.name}
                      prio={prio}
                      streakTitle={streakTitle}
                      thisWeekDays={weekStreak.thisWeekDays}
                      thisWeekHit={weekStreak.thisWeekHit}
                      currentWeeks={weekStreak.current}
                      showMarks={showStreakMarks}
                      ritualMultiplier={ritual ? ritualMultiplier : 0}
                    />
                  </td>

                  {sheetDates.map((date) => {
                    const dateKey = formatLocalDateKey(date)
                    const kind = exemptionKindFor?.(task, dateKey) ?? "required"
                    const exempt = isExemptKind(kind)
                    const completion = weeklyData[dateKey]?.[task.id]
                    const printed = printedGoalAmounts(task, completion)
                    const showHatch = completionCellShowsHatch({
                      exempt,
                      met: isHabitGoalMet(task, completion, { date, weeklyData }),
                      missed: isMissedOpportunity(completion),
                      exemptionWand,
                      missedOpWand,
                      hideCompletedAndMissed,
                      shown: printed.shown,
                      goal: printed.goal,
                    })
                    return (
                      <td
                        key={date.toISOString()}
                        className={`col-day ${isToday(date) ? "habit-day-today" : ""}${showHatch ? " is-exempt" : ""}`}
                      >
                        <HabitCompletionCell
                          task={task}
                          date={date}
                          periodKey={dateKey}
                          periodLabel={dateKey}
                          completion={completion}
                          weeklyData={weeklyData}
                          variant="daily"
                          frequency="daily"
                          exemptionNoun="day"
                          exemptionWand={exemptionWand}
                          missedOpWand={missedOpWand}
                          hideCompletedAndMissed={hideCompletedAndMissed}
                          onToggleMissedOpportunity={(missed) =>
                            onUpdateTaskCompletion(task.id, date, { missedOpportunity: missed })
                          }
                          exemptionKind={kind}
                          onSetExempt={
                            onSetExempt
                              ? (checked) => onSetExempt(task.id, date, checked)
                              : undefined
                          }
                          onBooleanChange={(checked) => handleBooleanChange(task.id, date, checked)}
                          onGoalChange={(n) => handleGoalChange(task.id, date, n)}
                          onTextChange={(text) => handleTextChange(task.id, date, text)}
                          onIncrementalChange={(n) => handleIncrementalChange(task.id, date, n)}
                        />
                      </td>
                    )
                  })}

                  <td className="col-pct">
                    <HabitPercentReadout value={percentage} label={`${task.name} week`} />
                  </td>
                </tr>
              )
            })
          )}

          {filteredTasks.length > 0 && (
            <tr className="habit-grid-foot font-semibold">
              <td className="col-act" />
              <td className="col-name">Daily Completion</td>
              {sheetDates.map((date) => {
                const index = weekDates.findIndex((d) => formatLocalDateKey(d) === formatLocalDateKey(date))
                const percentage = calculateDayPercentage(date, index >= 0 ? index : 0)
                return (
                  <td
                    key={date.toISOString()}
                    className={`col-day ${isToday(date) ? "habit-day-today" : ""}`}
                  >
                    <HabitPercentReadout
                      value={percentage}
                      label={`${formatLocalDateKey(date)} daily`}
                      density={dayView ? "wide" : "compact"}
                    />
                  </td>
                )
              })}
              <td className="col-pct" />
            </tr>
          )}
        </tbody>
      </table>
      </TooltipProvider>
    </div>
  )
}
