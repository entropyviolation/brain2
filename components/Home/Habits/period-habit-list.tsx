/**
 * components/Home/Habits/period-habit-list.tsx — Weekly / monthly habit grid
 *
 * Compact spreadsheet matching the daily TaskGrid: habits × a window of weeks
 * or months, per-habit %, period-completion footer, tracked-time marks.
 * Layout CSS: `habit-grid.css`.
 */
"use client"

import { Clock, Target } from "lucide-react"
import { HabitEditGemButton } from "@/components/Home/Habits/habit-gems"
import { HabitExemptCell, HabitLedLamp } from "@/components/Home/Habits/habit-led-lamp"
import { HabitRowName } from "@/components/Home/Habits/habit-row-name"
import { HabitPercentReadout } from "@/components/Home/Habits/habit-percent-readout"
import { HabitNumberField, HabitTextField } from "@/components/Home/Habits/habit-value-field"
import { TaskType, type WeeklyTask, type TaskCompletion, type WeeklyData, type HabitFrequency } from "@/lib/types"
import { isHabitGoalMet, isGoalType } from "@/lib/habit-utils"
import {
  incrementalCompletionPayload,
  incrementalDataForTask,
  incrementalGoalOn,
  incrementalLoggedValue,
} from "@/lib/incremental-habits"
import { trackingUnitLabel } from "@/lib/habit-tracking"
import { effectivePriorityWeight } from "@/lib/habit-priority"
import { exemptionRestLabel, exemptionWandTitle, isExemptKind, loggedExemptionDay, type ExemptionKind } from "@/lib/habit-exemption"
import { useThemeStore } from "@/lib/theme-store"
import type { HabitPeriod } from "@/lib/calculations"
import {
  formatLocalMonthKey,
  getPrecedingMonthStarts,
  getPrecedingWeekStarts,
  getWeekString,
  isSameLocalMonth,
  isSameLocalWeek,
} from "@/lib/date-utils"
import { format } from "date-fns"
import "./habit-grid.css"

export interface PeriodColumn extends HabitPeriod {
  label: string
  sublabel: string
  isCurrent: boolean
}

/** Seven weeks ending at `weekStart` (oldest first). Highlights this calendar week. */
export function weekPeriodColumns(weekStart: Date, asOf = new Date()): PeriodColumn[] {
  return getPrecedingWeekStarts(weekStart, 7).map((start) => {
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

/** Seven months ending at `monthDate`'s month. Highlights this calendar month. */
export function monthPeriodColumns(monthDate: Date, asOf = new Date()): PeriodColumn[] {
  return getPrecedingMonthStarts(monthDate, 7).map((start) => ({
    key: formatLocalMonthKey(start),
    date: start,
    label: format(start, "MMM"),
    sublabel: format(start, "yyyy"),
    isCurrent: isSameLocalMonth(start, asOf),
  }))
}

function trackedCellHint(task: WeeklyTask, completion: TaskCompletion | undefined): string {
  if (task.type === TaskType.BOOLEAN) return "Checked off automatically by tracked time"
  const unit = trackingUnitLabel(task.trackingLink?.unit)
  const tracked = completion?.trackedValue ?? 0
  const manual = completion?.manualValue ?? 0
  const manualPart = manual > 0 ? ` + ${manual} logged by hand` : ""
  return `${tracked} ${unit} from Tracking${manualPart}`
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
  completionLabel = "Period completion",
  emptyLabel = "No habits yet. Add one to get started.",
  asOf = new Date(),
  frequency = "weekly",
}: PeriodHabitListProps) {
  const colors = useThemeStore((s) => s.colors)
  const current = periods.find((p) => p.isCurrent) ?? periods[periods.length - 1]

  let visible = tasks
  if (hideCompleted && current) {
    visible = tasks.filter((task) => {
      const kind = exemptionKindFor?.(task, current.key)
      if (isExemptKind(kind)) return false
      return !isHabitGoalMet(task, data[current.key]?.[task.id], { date: current.date, weeklyData: data })
    })
  }

  const renderCell = (task: WeeklyTask, period: PeriodColumn) => {
    const completion = data[period.key]?.[task.id]
    const kind = exemptionKindFor?.(task, period.key) ?? "required"
    const exempt = isExemptKind(kind)
    const noun = frequency === "monthly" ? "month" : "week"
    const logDay = kind === "logged" ? loggedExemptionDay(task, period.key, frequency) : null

    if (exemptionWand && onSetExempt) {
      const title = exemptionWandTitle(kind, noun, logDay)
      return (
        <div className="habit-lamp-cell" title={title}>
          <HabitLedLamp
            checked={exempt}
            unavailable={exempt}
            onCheckedChange={(checked) => onSetExempt(task.id, period.key, period.date, checked)}
            label={`${task.name} ${period.label} exemption`}
          />
        </div>
      )
    }

    if (exempt) {
      const label = exemptionRestLabel(task.name, period.label, kind, logDay)
      return (
        <div className="habit-lamp-cell">
          <HabitExemptCell label={label} />
        </div>
      )
    }

    switch (task.type) {
      case TaskType.BOOLEAN:
        return (
          <div
            className="habit-lamp-cell"
            title={completion?.trackedCompleted ? trackedCellHint(task, completion) : undefined}
          >
            <HabitLedLamp
              checked={completion?.completed || false}
              onCheckedChange={(checked) => onUpdate(task.id, period.date, { completed: checked })}
              label={`${task.name} ${period.label}`}
              tracked={!!completion?.trackedCompleted}
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
              onValue={(n) => {
                if (!isGoalType(task.type)) return
                onUpdate(task.id, period.date, { value: n, goal: task.goal || 0 })
              }}
              className="habit-cell-slot"
              style={{ borderColor: tracked > 0 ? "#38bdf8" : `${colors.habitGoal}40` }}
              ariaLabel={`${task.name} ${period.label}`}
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
            onValue={(text) => onUpdate(task.id, period.date, { text })}
            className="habit-cell-slot habit-cell-slot-text"
            placeholder="…"
          />
        )

      case TaskType.INCREMENTAL: {
        const climb = incrementalDataForTask(task)
        if (!climb) return null
        const goal = incrementalGoalOn(task, data, period.date)
        const value = incrementalLoggedValue(completion)
        const isCompleted = isHabitGoalMet(task, completion, { date: period.date, weeklyData: data })
        const unit = climb.unit || task.unit || ""
        return (
          <div className="habit-cell-num" title={`${goal}${unit ? ` ${unit}` : ""}`}>
            <HabitNumberField
              value={value}
              onValue={(n) => onUpdate(task.id, period.date, incrementalCompletionPayload(n))}
              className={`habit-cell-slot${isCompleted ? " is-met" : ""}`}
              style={{ borderColor: isCompleted ? undefined : `${colors.habitIncremental}40` }}
              placeholder="0"
              ariaLabel={`${task.name} ${period.label}`}
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
                    return (
                      <td
                        key={period.key}
                        className={`col-day ${period.isCurrent ? "habit-day-today" : ""}${exempt ? " is-exempt" : ""}`}
                      >
                        {renderCell(task, period)}
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
            <tr className="font-semibold">
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
