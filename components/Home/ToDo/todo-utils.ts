/**
 * components/Home/ToDo/todo-utils.ts — Pure To-Do helpers
 *
 * Tier/importance derivation, schedule labelling, and the task→TodoItem build +
 * filter/sort pipeline. Pure functions (a `now` is injectable) so they're unit-
 * testable independent of React. See spec §8.4.
 */
import {
  format,
  differenceInDays,
  differenceInWeeks,
  differenceInMonths,
} from "date-fns"
import {
  getWeekString,
  parseWeekString,
  parseLocalDate,
  sameCalendarDay,
  taskScheduledOnDay,
  taskScheduledInWeek,
  taskScheduledInMonth,
} from "@/lib/date-utils"
import type { PriorityWeights, Task, TaskCompletionReview, TodoItem } from "@/lib/types"
import { computePriorityScore } from "@/lib/priority"
import { effectiveStatus, isAvailable, isOpen } from "@/lib/completion-status"

export type TodoPeriod = "day" | "week" | "month"
export type TodoSortMode = "tier" | "priority"

/**
 * Completion-status lens for the To-Do lists (Feature 9). "open" (active +
 * partial) is the default — it preserves the panel's original behaviour of
 * surfacing only work that still needs doing. The richer lenses let the user
 * drill into a single status or to just the dependency-unblocked work.
 */
export type TodoStatusFilter = "open" | "available" | "active" | "partial" | "deferred" | "cancelled" | "all"

export const TODO_STATUS_FILTERS: { value: TodoStatusFilter; label: string }[] = [
  { value: "open", label: "Open" },
  { value: "available", label: "Active & available" },
  { value: "active", label: "Active" },
  { value: "partial", label: "Partial" },
  { value: "deferred", label: "Deferred" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
]

/**
 * Filter a TodoItem list by completion status, resolving each row back to its
 * underlying Task (TodoItem has no status field). Pure (no React/store). Rows
 * whose task can't be found are kept only by the "all" lens.
 */
export function filterTodosByStatus(
  todos: TodoItem[],
  tasks: Task[],
  filter: TodoStatusFilter,
): TodoItem[] {
  if (filter === "all") return todos
  const byId = new Map(tasks.map((t) => [t.id, t]))
  return todos.filter((todo) => {
    const task = byId.get(todo.taskId ?? todo.id)
    if (!task) return false
    switch (filter) {
      case "open":
        return isOpen(task)
      case "available":
        return isAvailable(task, byId)
      default:
        return effectiveStatus(task) === filter
    }
  })
}

export const TIER_ORDER: Record<TodoItem["tier"], number> = {
  "A+": 0,
  A: 1,
  "A/B": 2,
  B: 3,
  C: 4,
  D: 5,
}

export function getTierFromTask(task: Pick<Task, "urgency" | "importance">): TodoItem["tier"] {
  const score = (task.urgency ?? 3) + (task.importance ?? 3)
  if (score >= 9) return "A+"
  if (score >= 7) return "A"
  if (score >= 5) return "A/B"
  if (score >= 3) return "B"
  return "C"
}

/**
 * Map a chosen tier back to the urgency/importance pair persisted on the task,
 * so the To-Do "Add Task" tier picker is honoured. The values are chosen so
 * `getTierFromTask` round-trips for A+ … C.
 */
export function tierToUrgencyImportance(tier: TodoItem["tier"]): { urgency: number; importance: number } {
  switch (tier) {
    case "A+":
      return { urgency: 5, importance: 5 }
    case "A":
      return { urgency: 4, importance: 4 }
    case "A/B":
      return { urgency: 3, importance: 3 }
    case "B":
      return { urgency: 2, importance: 2 }
    case "C":
    case "D":
    default:
      return { urgency: 1, importance: 1 }
  }
}

export function getTierColor(tier: TodoItem["tier"]): string {
  switch (tier) {
    case "A+":
      return "bg-red-100 text-red-800 border-red-200"
    case "A":
      return "bg-orange-100 text-orange-800 border-orange-200"
    case "A/B":
      return "bg-yellow-100 text-yellow-800 border-yellow-200"
    case "B":
      return "bg-blue-100 text-blue-800 border-blue-200"
    case "C":
      return "bg-gray-100 text-gray-800 border-gray-200"
    case "D":
      return "bg-gray-50 text-gray-600 border-gray-100"
    default:
      return "bg-gray-100 text-gray-800 border-gray-200"
  }
}

export function getScheduleLabel(todo: TodoItem): string {
  if (todo.scheduledDate) return `Scheduled: ${format(todo.scheduledDate, "MMM d, yyyy")}`
  if (todo.scheduledWeek) {
    const range = parseWeekString(todo.scheduledWeek)
    if (range) return `Scheduled: week of ${format(range.start, "MMM d, yyyy")}`
  }
  if (todo.scheduledMonth) {
    const parsed = new Date(`${todo.scheduledMonth}-01T00:00:00`)
    if (!isNaN(parsed.getTime())) return `Scheduled: ${format(parsed, "MMMM yyyy")}`
  }
  if (todo.scheduledYear) return `Scheduled: ${todo.scheduledYear}`
  return "Not scheduled"
}

function isTaskScheduled(task: Task, now: Date): boolean {
  const monthKey = now.toISOString().slice(0, 7)
  const weekKey = getWeekString(now)
  return (
    taskScheduledOnDay(task, now) ||
    taskScheduledInWeek(task, weekKey) ||
    taskScheduledInMonth(task, monthKey) ||
    !!task.scheduledYear
  )
}

/** Build the TodoItem mirror list from tasks (overdue counts, tier, Q/I). */
export function buildTodoItems(tasks: Task[], showAllTasks: boolean, now: Date = new Date()): TodoItem[] {
  return tasks
    .filter((task) => !task.completed && !task.hiddenFromTodo && (showAllTasks || isTaskScheduled(task, now)))
    .map((task) => {
      const scheduledDate = task.scheduledDate
        ? parseLocalDate(task.scheduledDate) ?? new Date(task.scheduledDate)
        : task.deadline
          ? parseLocalDate(task.deadline) ?? new Date(task.deadline)
          : null

      let daysOverdue = 0
      let weeksOverdue = 0
      let monthsOverdue = 0
      if (scheduledDate && !task.completed) {
        daysOverdue = Math.max(0, differenceInDays(now, scheduledDate))
        weeksOverdue = Math.max(0, differenceInWeeks(now, scheduledDate))
        monthsOverdue = Math.max(0, differenceInMonths(now, scheduledDate))
      }

      return {
        id: task.id,
        description: task.description,
        tier: getTierFromTask(task),
        scheduledDate,
        createdDate: task.createdAt,
        daysOverdue,
        weeksOverdue,
        monthsOverdue,
        daysPushed: task.daysPushed ?? 0,
        weeksPushed: task.weeksPushed ?? 0,
        monthsPushed: task.monthsPushed ?? 0,
        hiddenFromTodo: task.hiddenFromTodo,
        completed: task.completed,
        taskId: task.id,
        estimatedDuration: task.estimatedDuration,
        rewardValue: task.rewardValue,
        scheduledWeek: task.scheduledWeek,
        scheduledMonth: task.scheduledMonth,
        scheduledYear: task.scheduledYear,
      }
    })
}

export function pushedKeyForPeriod(period: TodoPeriod): "daysPushed" | "weeksPushed" | "monthsPushed" {
  return period === "day" ? "daysPushed" : period === "week" ? "weeksPushed" : "monthsPushed"
}

/** Filter the TodoItem list to a period and sort by tier then push count. */
export function filterAndSortTodos(
  todoItems: TodoItem[],
  period: TodoPeriod,
  showAllTasks: boolean,
  now: Date = new Date(),
): TodoItem[] {
  const hasSchedule = (item: TodoItem) =>
    !!(item.scheduledDate || item.scheduledWeek || item.scheduledMonth || item.scheduledYear)

  return todoItems
    .filter((item) => {
      if (item.completed) return false
      if (!hasSchedule(item)) return showAllTasks
      switch (period) {
        case "day":
          return taskScheduledOnDay(item, now)
        case "week":
          return taskScheduledInWeek(item, getWeekString(now))
        case "month":
          return taskScheduledInMonth(item, now.toISOString().slice(0, 7))
        default:
          return true
      }
    })
    .sort((a, b) => {
      const tierDiff = TIER_ORDER[a.tier] - TIER_ORDER[b.tier]
      if (tierDiff !== 0) return tierDiff
      const pushedKey = pushedKeyForPeriod(period)
      return b[pushedKey] - a[pushedKey]
    })
}

/**
 * Re-order a TodoItem list by the transparent priority formula (lib/priority.ts),
 * resolving each item back to its underlying Task for the signal values. Stable
 * for ties. Items whose task can't be found sort last. Pure (no React/store).
 */
export function sortTodosByPriority(
  todos: TodoItem[],
  tasks: Task[],
  weights: PriorityWeights,
): TodoItem[] {
  const byId = new Map(tasks.map((t) => [t.id, t]))
  return todos
    .map((todo, index) => {
      const task = byId.get(todo.taskId ?? todo.id)
      return { todo, index, score: task ? computePriorityScore(task, weights) : -Infinity }
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((x) => x.todo)
}

/** Local YYYY-MM month key (avoids UTC drift). */
export function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
}

/** Best-effort completion timestamp for a done task. */
export function getTaskCompletionDate(task: Task): Date | null {
  // Canonical: stamped by the task store on every completion path.
  if (task.completedDate) {
    const d = task.completedDate instanceof Date ? task.completedDate : new Date(task.completedDate)
    if (!isNaN(d.getTime())) return d
  }
  const review = task.completionReview?.completedAt
  if (review) {
    const d = review instanceof Date ? review : new Date(review)
    if (!isNaN(d.getTime())) return d
  }
  const chunks = task.completedChunks
  if (chunks && chunks.length > 0) {
    const last = chunks[chunks.length - 1].date
    const d = last instanceof Date ? last : new Date(last)
    if (!isNaN(d.getTime())) return d
  }
  if (task.completed) {
    const sched = task.scheduledDate ? parseLocalDate(task.scheduledDate) : null
    if (sched) return sched
    return task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt)
  }
  return null
}

export function taskCompletedOnDay(task: Task, day: Date): boolean {
  if (!task.completed) return false
  const d = getTaskCompletionDate(task)
  return !!d && sameCalendarDay(d, day)
}

export function taskCompletedInWeek(task: Task, weekValue: string): boolean {
  if (!task.completed) return false
  const d = getTaskCompletionDate(task)
  return !!d && getWeekString(d) === weekValue
}

export function taskCompletedInMonth(task: Task, monthValue: string): boolean {
  if (!task.completed) return false
  const d = getTaskCompletionDate(task)
  return !!d && getMonthKey(d) === monthValue
}

/** Minimal post-mortem stub so completion timestamps persist on quick-complete paths. */
export function defaultCompletionReview(taskId: string, completedAt: Date): TaskCompletionReview {
  return {
    taskId,
    completedAt,
    actualDuration: 0,
    satisfaction: 5,
    resistance: 5,
    focus: 5,
    distraction: 5,
  }
}

function taskToTodoItem(task: Task, now: Date): TodoItem {
  const scheduledDate = task.scheduledDate
    ? parseLocalDate(task.scheduledDate) ?? new Date(task.scheduledDate)
    : task.deadline
      ? parseLocalDate(task.deadline) ?? new Date(task.deadline)
      : null

  let daysOverdue = 0
  let weeksOverdue = 0
  let monthsOverdue = 0
  if (scheduledDate && !task.completed) {
    daysOverdue = Math.max(0, differenceInDays(now, scheduledDate))
    weeksOverdue = Math.max(0, differenceInWeeks(now, scheduledDate))
    monthsOverdue = Math.max(0, differenceInMonths(now, scheduledDate))
  }

  return {
    id: task.id,
    description: task.description,
    tier: getTierFromTask(task),
    scheduledDate,
    createdDate: task.createdAt,
    daysOverdue,
    weeksOverdue,
    monthsOverdue,
    daysPushed: task.daysPushed ?? 0,
    weeksPushed: task.weeksPushed ?? 0,
    monthsPushed: task.monthsPushed ?? 0,
    hiddenFromTodo: task.hiddenFromTodo,
    completed: task.completed,
    taskId: task.id,
    estimatedDuration: task.estimatedDuration,
    rewardValue: task.rewardValue,
    scheduledWeek: task.scheduledWeek,
    scheduledMonth: task.scheduledMonth,
    scheduledYear: task.scheduledYear,
  }
}

/** Completed tasks for a period, sorted by completion time (most recent first). */
export function buildDoneTodoItems(
  tasks: Task[],
  period: TodoPeriod,
  refDate: Date = new Date(),
): TodoItem[] {
  const filtered = tasks.filter((task) => {
    if (!task.completed || task.hiddenFromTodo) return false
    switch (period) {
      case "day":
        return taskCompletedOnDay(task, refDate)
      case "week":
        return taskCompletedInWeek(task, getWeekString(refDate))
      case "month":
        return taskCompletedInMonth(task, getMonthKey(refDate))
      default:
        return false
    }
  })

  return filtered
    .map((task) => taskToTodoItem(task, refDate))
    .sort((a, b) => {
      const ta = tasks.find((t) => t.id === a.id)
      const tb = tasks.find((t) => t.id === b.id)
      const da = ta ? getTaskCompletionDate(ta)?.getTime() ?? 0 : 0
      const db = tb ? getTaskCompletionDate(tb)?.getTime() ?? 0 : 0
      return db - da
    })
}

export function isCurrentPeriod(period: TodoPeriod, refDate: Date, now: Date = new Date()): boolean {
  switch (period) {
    case "day":
      return sameCalendarDay(refDate, now)
    case "week":
      return getWeekString(refDate) === getWeekString(now)
    case "month":
      return getMonthKey(refDate) === getMonthKey(now)
    default:
      return false
  }
}

export function getTodoOpenTitle(period: TodoPeriod, refDate: Date, now: Date = new Date()): string {
  const current = isCurrentPeriod(period, refDate, now)
  switch (period) {
    case "day":
      return current ? "Today's Tasks" : `${format(refDate, "MMM d")}'s Tasks`
    case "week": {
      const range = parseWeekString(getWeekString(refDate))
      const label = range ? formatDateRangeShort(range.start, range.end) : format(refDate, "MMM d")
      return current ? "This Week's Tasks" : `Week of ${label}`
    }
    case "month":
      return current ? "This Month's Tasks" : format(refDate, "MMMM yyyy")
    default:
      return "Tasks"
  }
}

export function getTodoDoneTitle(period: TodoPeriod, refDate: Date, now: Date = new Date()): string {
  const current = isCurrentPeriod(period, refDate, now)
  switch (period) {
    case "day":
      return current ? "Done Today" : `Done ${format(refDate, "MMM d")}`
    case "week":
      return current ? "Done this week" : "Done that week"
    case "month":
      return current ? "Done this month" : format(refDate, "MMMM yyyy")
    default:
      return "Done"
  }
}

function formatDateRangeShort(start: Date, end: Date): string {
  if (start.getMonth() === end.getMonth()) {
    return `${format(start, "MMM d")}–${format(end, "d")}`
  }
  return `${format(start, "MMM d")}–${format(end, "MMM d")}`
}

export function getPeriodNavLabel(period: TodoPeriod, refDate: Date): string {
  switch (period) {
    case "day":
      return format(refDate, "EEEE, MMM d, yyyy")
    case "week": {
      const range = parseWeekString(getWeekString(refDate))
      return range ? formatDateRangeShort(range.start, range.end) : format(refDate, "MMM d, yyyy")
    }
    case "month":
      return format(refDate, "MMMM yyyy")
    default:
      return format(refDate, "PPP")
  }
}
