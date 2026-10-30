/**
 * components/Home/ToDo/desk/todo-period-figures.ts — Load and count figures
 *
 * Plain functions the desk calls while rendering. Not memoized. `periodLoad`
 * still runs once for the header glass and again for the open sheet.
 */
import type { Task, TodoItem } from "@/lib/types"
import { isClearedFromWork, isOpen } from "@/lib/completion-status"
import { comfortDialT, comfortWord } from "../TodoLoadPanel"
import { tasksInRange } from "../ranges/todo-ranges"
import { DEFAULT_TODO_PREFS } from "../todo-prefs"
import { isPastTodoPeriod, type TodoPeriod } from "../todo-utils"
import type { TodoTab } from "./todo-desk-constants"
import {
  comfortBand,
  comfortRatio,
  formatMinutesAsHours,
  formatWorkingHours,
  hoursLeftInPeriod,
  summedEstimate,
  workingHoursLeft,
  todoPeriodKey,
  type EstimateScope,
} from "@/lib/todo-commitment"

export function periodLoad(input: {
  period: TodoPeriod
  focusedDate: Date
  undoneTodos: TodoItem[]
  filteredTodos: TodoItem[]
  tasks: Task[]
  morningPriorities: string[]
  estimateScope: EstimateScope
}) {
  const { period, focusedDate, undoneTodos, filteredTodos, tasks, morningPriorities, estimateScope } = input
  const past = isPastTodoPeriod(period, focusedDate)
  const undoneIds = new Set(undoneTodos.map((todo) => todo.taskId ?? todo.id))
  const openTodos = past
    ? filteredTodos.filter((todo) => !undoneIds.has(todo.taskId ?? todo.id))
    : filteredTodos
  const periodKey = todoPeriodKey(period, focusedDate)
  const ritualIds = period === "day" ? morningPriorities : undefined
  const estimate = summedEstimate(openTodos, tasks, period, periodKey, estimateScope, ritualIds)
  const hours = workingHoursLeft(period, focusedDate)
  const clockHours = hoursLeftInPeriod(period, focusedDate)
  const ratio = comfortRatio(estimate.minutes, hours)
  const band = comfortBand(ratio)
  return { past, undoneIds, openTodos, periodKey, ritualIds, estimate, hours, clockHours, ratio, band }
}

/** Header glass: working hours left · estimate · comfort word, plus the needle angle. */
export function headerLoadReadout(
  figures: { minutes: number; hours: number; ratio: number; band: ReturnType<typeof comfortBand> } | null,
  inProgressCount: number,
  wipLimit: number,
) {
  if (!figures) return null
  const t = comfortDialT(figures.ratio)
  return {
    text: `${formatWorkingHours(figures.hours)} left · ${formatMinutesAsHours(figures.minutes)} est · ${comfortWord(figures.band)}`,
    angle: ((-90 + t * 180) * Math.PI) / 180,
    overCap: inProgressCount > wipLimit,
  }
}

export function openTodoCount(input: {
  activeTodoTab: TodoTab
  periodTab: Exclude<TodoTab, "other">
  activeRange: { range: { id: string } } | undefined
  tasks: Task[]
  seasonOpenLength: number
  viewingPast: boolean
  filtered: TodoItem[]
  undoneIds: Set<string>
}) {
  if (input.activeTodoTab === "other") {
    return input.activeRange
      ? tasksInRange(input.tasks, input.activeRange.range.id).filter((t) => isOpen(t) && !isClearedFromWork(t)).length
      : 0
  }
  if (input.periodTab === "quarter") return input.seasonOpenLength
  if (input.viewingPast) return input.filtered.filter((todo) => !input.undoneIds.has(todo.taskId ?? todo.id)).length
  return input.filtered.length
}

export function activeFilterCount(input: {
  availableNow: boolean
  showAllTasks: boolean
  hideLocked: boolean
  showNextOnly: boolean
  tierView: string
  statusFilter: typeof DEFAULT_TODO_PREFS.statusFilter
}) {
  return [
    input.availableNow,
    input.showAllTasks,
    input.hideLocked,
    input.showNextOnly,
    input.tierView !== "all",
    input.statusFilter !== DEFAULT_TODO_PREFS.statusFilter,
  ].filter(Boolean).length
}
