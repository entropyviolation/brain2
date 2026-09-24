/**
 * components/Home/Habits/task-grid.tsx — Habit grid
 *
 * Compact spreadsheet: gem/edit | wrapping name + streak | 7 weekdays
 * (or Day View: today only, larger bold titles) | week % readout
 * (10-pip channel or numeric LED; Day View daily footer uses a wide fill).
 * Yes/No cells are photoreal lamps. Delete lives in habit settings.
 * Climb cells stay `value / target`. Layout: `habit-grid.css`.
 *
 * Spec: §9.2 (habit types), §9.3 (display & interaction).
 */
"use client"

import { useCallback } from "react"
import { Clock } from "lucide-react"
import { type WeeklyTask as Task, TaskType, type TaskCompletion, type WeeklyData } from "@/lib/types"
import { formatLocalDateKey, getDayOfWeek, isToday } from "@/lib/date-utils"
import { isHabitGoalMet, isGoalType } from "@/lib/habit-utils"
import {
  incrementalCompletionPayload,
  incrementalDataForTask,
  incrementalGoalOn,
  incrementalLoggedValue,
} from "@/lib/incremental-habits"
import { habitWeekStreakSummary } from "@/lib/habit-week-streaks"
import { trackingUnitLabel } from "@/lib/habit-tracking"
import { effectivePriorityWeight } from "@/lib/habit-priority"
import { useThemeStore } from "@/lib/theme-store"
import { TooltipProvider } from "@/components/ui/tooltip"
import { HabitEditGemButton } from "@/components/Home/Habits/habit-gems"
import { HabitExemptCell, HabitLedLamp } from "@/components/Home/Habits/habit-led-lamp"
import { HabitRowName } from "@/components/Home/Habits/habit-row-name"
import { HabitPercentReadout } from "@/components/Home/Habits/habit-percent-readout"
import { HabitNumberField, HabitTextField } from "@/components/Home/Habits/habit-value-field"
import { habitContributesWillpowerStone } from "@/lib/willpower-stones"
import { exemptionRestLabel, exemptionWandTitle, isExemptKind, loggedExemptionDay, type ExemptionKind } from "@/lib/habit-exemption"
import { autoCheckHint } from "@/lib/habit-connections"
import "./habit-grid.css"

/** Tooltip for a cell the tracking link contributed to. */
function trackedCellHint(task: Task, completion: TaskCompletion | undefined): string {
  if (task.type === TaskType.BOOLEAN) return autoCheckHint(completion) ?? "Checked off automatically by tracked time"
  const unit = trackingUnitLabel(task.trackingLink?.unit)
  const tracked = completion?.trackedValue ?? 0
  const manual = completion?.manualValue ?? 0
  const manualPart = manual > 0 ? ` + ${manual} logged by hand` : ""
  return `${tracked} ${unit} from Tracking${manualPart}`
}

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
  viewMode?: "week" | "day"
  /** When true, only today's column plus the week % column. */
  dayView?: boolean
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
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
  viewMode = "week",
  dayView = false,
  selectedDate,
  onDateSelect,
}: TaskGridProps) {
  const colors = useThemeStore((s) => s.colors)
  const weekStart = weekDates[0] ?? new Date()
  const asOf = selectedDate ?? new Date()
  const focusKey = formatLocalDateKey(selectedDate ?? weekDates.find((d) => isToday(d)) ?? weekDates[weekDates.length - 1] ?? new Date())
  const visibleDates = dayView
    ? weekDates.filter((d) => formatLocalDateKey(d) === focusKey)
    : weekDates
  const sheetDates = visibleDates.length > 0 ? visibleDates : weekDates.slice(-1)

  let filteredTasks = tasks

  if (hideCompleted && viewMode === "day" && selectedDate) {
    const dateKey = formatLocalDateKey(selectedDate)
    filteredTasks = filteredTasks.filter((task) => {
      if (exemptionKindFor?.(task, dateKey) === "auto" || exemptionKindFor?.(task, dateKey) === "waved") return false
      return !isHabitGoalMet(task, weeklyData[dateKey]?.[task.id], { date: selectedDate, weeklyData })
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

  const handleIncrementalChange = useCallback((taskId: string, date: Date, value: number | undefined) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.type !== TaskType.INCREMENTAL) return
    onUpdateTaskCompletion(taskId, date, incrementalCompletionPayload(value))
  }, [onUpdateTaskCompletion, tasks])

  const renderTaskCell = (task: Task, date: Date) => {
    const dateKey = formatLocalDateKey(date)
    const completion = weeklyData[dateKey]?.[task.id]
    const kind = exemptionKindFor?.(task, dateKey) ?? "required"
    const exempt = isExemptKind(kind)
    const logDay = kind === "logged" ? loggedExemptionDay(task, dateKey, "daily") : null

    if (exemptionWand && onSetExempt) {
      const title = exemptionWandTitle(kind, "day", logDay)
      return (
        <div className="habit-lamp-cell" title={title}>
          <HabitLedLamp
            checked={exempt}
            unavailable={exempt}
            onCheckedChange={(checked) => onSetExempt(task.id, date, checked)}
            label={`${task.name} ${dateKey} exemption`}
          />
        </div>
      )
    }

    if (exempt) {
      const label = exemptionRestLabel(task.name, dateKey, kind, logDay)
      return (
        <div className="habit-lamp-cell">
          <HabitExemptCell label={label} />
        </div>
      )
    }

    switch (task.type) {
      case TaskType.BOOLEAN:
        return (
          <div className="habit-lamp-cell" title={autoCheckHint(completion) ?? (completion?.trackedCompleted ? trackedCellHint(task, completion) : undefined)}>
            <HabitLedLamp
              checked={completion?.completed || false}
              onCheckedChange={(checked) => handleBooleanChange(task.id, date, checked)}
              label={`${task.name} ${dateKey}`}
              tracked={!!(completion?.trackedCompleted || completion?.sleepCompleted || completion?.listCompleted)}
            />
          </div>
        )

      case TaskType.GOAL:
      case TaskType.TIME:
      case TaskType.COUNT: {
        const tracked = completion?.trackedValue ?? 0
        return (
          <div className="habit-cell-num" title={tracked > 0 ? trackedCellHint(task, completion) : undefined}>
            <HabitNumberField
              value={completion?.value}
              onValue={(n) => handleGoalChange(task.id, date, n)}
              className="habit-cell-slot"
              style={{ borderColor: tracked > 0 ? "#38bdf8" : `${colors.habitGoal}40` }}
              ariaLabel={`${task.name} ${dateKey}`}
            />
            {tracked > 0 && <Clock className="habit-tracked-mark" aria-label="includes tracked time" />}
            <span className="habit-goal">
              <span className="habit-goal-den">/{task.goal}</span>
            </span>
          </div>
        )
      }

      case TaskType.TEXT:
        return (
          <HabitTextField
            value={completion?.text || ""}
            onValue={(text) => handleTextChange(task.id, date, text)}
            className="habit-cell-slot habit-cell-slot-text"
            placeholder="…"
          />
        )

      case TaskType.INCREMENTAL: {
        const climb = incrementalDataForTask(task)
        if (!climb) return null
        const goal = incrementalGoalOn(task, weeklyData, date)
        const value = incrementalLoggedValue(completion)
        const isCompleted = isHabitGoalMet(task, completion, { date, weeklyData })
        const unit = climb.unit || task.unit || ""
        const hint =
          climb.cadence === "daily" ? `${isCompleted ? "hit" : "need"} +${climb.increment}` : `${goal}${unit ? ` ${unit}` : ""}`
        return (
          <div className="habit-cell-num" title={hint}>
            <HabitNumberField
              value={value}
              onValue={(n) => handleIncrementalChange(task.id, date, n)}
              className={`habit-cell-slot${isCompleted ? " is-met" : ""}`}
              style={{ borderColor: isCompleted ? undefined : `${colors.habitIncremental}40` }}
              placeholder={climb.cadence === "daily" ? String(goal) : "0"}
              ariaLabel={`${task.name} ${formatLocalDateKey(date)}`}
            />
            <span className="habit-goal">
              <span className="habit-goal-den">/{goal}</span>
              {unit ? <span className="habit-goal-unit"> {unit}</span> : null}
            </span>
          </div>
        )
      }

      default:
        return null
    }
  }

  return (
    <div className="habit-grid-wrap">
      <TooltipProvider>
      <table className={`habit-grid${dayView ? " is-day-view" : ""}`}>
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
              const streakTitle = [
                `${weekStreak.thisWeekDays} day${weekStreak.thisWeekDays === 1 ? "" : "s"} done this week`,
                weekStreak.current > 0 ? `${weekStreak.current} week streak of 4+ days` : "no 4+ day week streak",
                weekStreak.longest > weekStreak.current ? `best ${weekStreak.longest}` : null,
              ]
                .filter(Boolean)
                .join(". ")
              return (
                <tr key={task.id} className="group">
                  <td className="col-act">
                    <HabitEditGemButton
                      task={task}
                      onEdit={onEditTask}
                      inverted={habitContributesWillpowerStone(task, weeklyData, weekDates)}
                    />
                  </td>
                  <td className="col-name font-medium" title={`${task.name}. ${streakTitle}`}>
                    <HabitRowName
                      name={task.name}
                      prio={prio}
                      streakTitle={streakTitle}
                      thisWeekDays={weekStreak.thisWeekDays}
                      thisWeekHit={weekStreak.thisWeekHit}
                      currentWeeks={weekStreak.current}
                    />
                  </td>

                  {sheetDates.map((date) => {
                    const kind = exemptionKindFor?.(task, formatLocalDateKey(date)) ?? "required"
                    const exempt = isExemptKind(kind)
                    return (
                      <td
                        key={date.toISOString()}
                        className={`col-day ${isToday(date) ? "habit-day-today" : ""}${exempt ? " is-exempt" : ""}`}
                      >
                        {renderTaskCell(task, date)}
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
            <tr className="font-semibold">
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
