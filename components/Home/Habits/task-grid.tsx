/**
 * components/Home/Habits/task-grid.tsx — Habit grid
 *
 * Compact spreadsheet: habits × 7 weekdays, per-habit week %, edit/delete.
 * Climb cells are `value / target` like goals. Layout CSS: `habit-grid.css`.
 *
 * Spec: §9.2 (habit types), §9.3 (display & interaction).
 */
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Edit, Trash2, CheckCircle2, Clock, AlignLeft, TrendingUp, Flame } from "lucide-react"
import { type WeeklyTask as Task, TaskType, type TaskCompletion, type WeeklyData } from "@/lib/types"
import { formatLocalDateKey, getDayOfWeek, isToday } from "@/lib/date-utils"
import { isHabitGoalMet, isGoalType } from "@/lib/habit-utils"
import {
  completionValueFromInput,
  incrementalCompletionPayload,
  incrementalDataForTask,
  incrementalGoalOn,
  incrementalLoggedValue,
} from "@/lib/incremental-habits"
import { habitWeekStreakSummary } from "@/lib/habit-week-streaks"
import { useThemeStore } from "@/lib/theme-store"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import "./habit-grid.css"

interface TaskGridProps {
  tasks: Task[]
  weeklyData: WeeklyData
  weekDates: Date[]
  onUpdateTaskCompletion: (taskId: string, date: Date, completion: TaskCompletion) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  calculateTaskPercentage: (taskId: string) => number
  calculateDayPercentage: (date: Date, index: number) => number
  hideCompleted?: boolean
  viewMode?: "week" | "day"
  selectedDate?: Date
  onDateSelect?: (date: Date) => void
}

export function TaskGrid({
  tasks,
  weeklyData,
  weekDates,
  onUpdateTaskCompletion,
  onEditTask,
  onDeleteTask,
  calculateTaskPercentage,
  calculateDayPercentage,
  hideCompleted = false,
  viewMode = "week",
  selectedDate,
  onDateSelect,
}: TaskGridProps) {
  const colors = useThemeStore((s) => s.colors)
  const weekStart = weekDates[0] ?? new Date()
  const asOf = selectedDate ?? new Date()

  let filteredTasks = tasks

  if (hideCompleted && viewMode === "day" && selectedDate) {
    const dateKey = formatLocalDateKey(selectedDate)
    filteredTasks = filteredTasks.filter(
      (task) => !isHabitGoalMet(task, weeklyData[dateKey]?.[task.id], { date: selectedDate, weeklyData }),
    )
  }

  const getProgressColor = (percentage: number) => {
    if (percentage >= 100) return "bg-gradient-to-r from-[#8cd4a5] to-[#9fc2a5]"
    if (percentage >= 75) return "bg-gradient-to-r from-[#8b7ecc] to-[#b89fbf]"
    if (percentage >= 50) return "bg-gradient-to-r from-[#5f756d] to-[#adc29f]"
    if (percentage >= 25) return "bg-gradient-to-r from-[#571833] to-[#130ead]"
    return "bg-gray-400"
  }

  const handleBooleanChange = (taskId: string, date: Date, checked: boolean | "indeterminate") => {
    onUpdateTaskCompletion(taskId, date, { completed: checked === true })
  }

  const handleGoalChange = (taskId: string, date: Date, value: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || !isGoalType(task.type)) return
    const num = Number.parseFloat(value) || 0
    onUpdateTaskCompletion(taskId, date, { value: num, goal: task.goal || 0 })
  }

  const handleTextChange = (taskId: string, date: Date, text: string) => {
    onUpdateTaskCompletion(taskId, date, { text })
  }

  const handleIncrementalChange = (taskId: string, date: Date, raw: string) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.type !== TaskType.INCREMENTAL) return
    onUpdateTaskCompletion(taskId, date, incrementalCompletionPayload(completionValueFromInput(raw)))
  }

  const getTaskTypeIcon = (type: TaskType) => {
    const style = (color: string) => ({ color })
    const cls = "h-3 w-3 shrink-0"
    switch (type) {
      case TaskType.BOOLEAN:
        return <CheckCircle2 className={cls} style={style(colors.habitBoolean)} />
      case TaskType.GOAL:
      case TaskType.TIME:
      case TaskType.COUNT:
        return <Clock className={cls} style={style(colors.habitGoal)} />
      case TaskType.TEXT:
        return <AlignLeft className={cls} style={style(colors.habitText)} />
      case TaskType.INCREMENTAL:
        return <TrendingUp className={cls} style={style(colors.habitIncremental)} />
    }
  }

  const renderTaskCell = (task: Task, date: Date) => {
    const dateKey = formatLocalDateKey(date)
    const completion = weeklyData[dateKey]?.[task.id]

    switch (task.type) {
      case TaskType.BOOLEAN:
        return (
          <div className="flex justify-center">
            <Checkbox
              checked={completion?.completed || false}
              onCheckedChange={(checked) => handleBooleanChange(task.id, date, checked)}
              className="h-3.5 w-3.5 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            />
          </div>
        )

      case TaskType.GOAL:
      case TaskType.TIME:
      case TaskType.COUNT:
        return (
          <div className="habit-cell-num">
            <Input
              type="number"
              min="0"
              step="0.5"
              value={completion?.value?.toString() || "0"}
              onChange={(e) => handleGoalChange(task.id, date, e.target.value)}
              className="h-[22px] min-w-0 px-0.5 text-[11px]"
              style={{ borderColor: `${colors.habitGoal}40` }}
            />
            <span className="habit-goal">/{task.goal}</span>
          </div>
        )

      case TaskType.TEXT:
        return (
          <Input
            value={completion?.text || ""}
            onChange={(e) => handleTextChange(task.id, date, e.target.value)}
            className="h-[22px] min-w-0 px-1 text-[11px]"
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
            <Input
              type="number"
              step="0.5"
              value={value?.toString() ?? ""}
              onChange={(e) => handleIncrementalChange(task.id, date, e.target.value)}
              className={`h-[22px] min-w-0 px-0.5 text-[11px] ${isCompleted ? "border-green-500 bg-green-50" : ""}`}
              style={{ borderColor: isCompleted ? undefined : `${colors.habitIncremental}40` }}
              placeholder={climb.cadence === "daily" ? String(goal) : "0"}
              aria-label={`${task.name} ${formatLocalDateKey(date)}`}
            />
            <span className="habit-goal">
              /{goal}
              {unit ? ` ${unit}` : ""}
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
      <table className="habit-grid">
        <thead>
          <tr>
            <th className="col-name">Task</th>
            {weekDates.map((date) => (
              <th
                key={date.toISOString()}
                className={`col-day ${isToday(date) ? "habit-day-today" : ""}`}
                onClick={() => viewMode === "week" && onDateSelect?.(date)}
              >
                {getDayOfWeek(date).substring(0, 3)}
                <span className="habit-day-sub">
                  {date.getMonth() + 1}/{date.getDate()}
                  {isToday(date) ? " ●" : ""}
                </span>
              </th>
            ))}
            <th className="col-pct">%</th>
            <th className="col-act" />
          </tr>
        </thead>
        <tbody>
          {filteredTasks.length === 0 ? (
            <tr>
              <td colSpan={weekDates.length + 3} className="h-16 text-center text-muted-foreground">
                No habits yet. Add one to get started.
              </td>
            </tr>
          ) : (
            filteredTasks.map((task) => {
              const percentage = calculateTaskPercentage(task.id)
              const weekStreak = habitWeekStreakSummary(task, weeklyData, weekStart, asOf)
              const streakTitle = [
                `${weekStreak.thisWeekDays} day${weekStreak.thisWeekDays === 1 ? "" : "s"} done this week`,
                weekStreak.current > 0 ? `${weekStreak.current} week streak of 4+ days` : "no 4+ day week streak",
                weekStreak.longest > weekStreak.current ? `best ${weekStreak.longest}` : null,
              ]
                .filter(Boolean)
                .join(". ")
              return (
                <tr key={task.id} className="group">
                  <td className="col-name font-medium" title={`${task.name}. ${streakTitle}`}>
                    <div className="habit-name">
                      {getTaskTypeIcon(task.type)}
                      <span>{task.name}</span>
                      {(weekStreak.thisWeekDays > 0 || weekStreak.current > 0) && (
                        <span className="habit-week-streak" aria-label={streakTitle}>
                          {weekStreak.thisWeekHit ? (
                            <span className="habit-week-streak-hit">4+</span>
                          ) : weekStreak.thisWeekDays > 0 ? (
                            <span>{weekStreak.thisWeekDays}d</span>
                          ) : null}
                          {weekStreak.current > 0 && (
                            <span className="habit-week-streak-run">
                              <Flame className="h-2.5 w-2.5" />
                              {weekStreak.current}w
                            </span>
                          )}
                        </span>
                      )}
                    </div>
                  </td>

                  {weekDates.map((date) => (
                    <td key={date.toISOString()} className={`col-day ${isToday(date) ? "habit-day-today" : ""}`}>
                      {renderTaskCell(task, date)}
                    </td>
                  ))}

                  <td className="col-pct">
                    <div className="habit-pct">
                      <Progress
                        value={percentage}
                        className="h-1.5 w-full rounded-full bg-gray-100 dark:bg-gray-800"
                        indicatorClassName={getProgressColor(percentage)}
                      />
                      <span className={percentage >= 100 ? "text-green-600 font-semibold" : ""}>
                        {percentage.toFixed(0)}%
                      </span>
                    </div>
                  </td>

                  <td className="col-act">
                    <div className="flex justify-center gap-0">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => onEditTask(task)} className="h-6 w-6">
                              <Edit className="h-3 w-3" />
                              <span className="sr-only">Edit</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Edit Task</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => onDeleteTask(task.id)}
                              className="h-6 w-6 text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Delete Task</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </td>
                </tr>
              )
            })
          )}

          {filteredTasks.length > 0 && (
            <tr className="font-semibold">
              <td className="col-name">Daily Completion</td>
              {weekDates.map((date, index) => {
                const percentage = calculateDayPercentage(date, index)
                return (
                  <td
                    key={date.toISOString()}
                    className={`col-day ${isToday(date) ? "habit-day-today" : ""}`}
                  >
                    <div className="habit-pct">
                      <Progress
                        value={percentage}
                        className="h-1.5 w-full rounded-full bg-gray-200 dark:bg-gray-700"
                        indicatorClassName={getProgressColor(percentage)}
                      />
                      <span className={percentage >= 100 ? "text-green-600" : ""}>{percentage.toFixed(0)}%</span>
                    </div>
                  </td>
                )
              })}
              <td colSpan={2} />
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
