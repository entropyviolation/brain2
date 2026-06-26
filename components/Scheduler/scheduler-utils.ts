/**
 * components/Scheduler/scheduler-utils.ts — Pure Scheduler helpers
 *
 * Period-funnel logic with no React: which tasks are available/scheduleable,
 * per-period task queries, the schedule/unschedule field updates, calendar grid
 * builders (months/weeks/days), navigation, and "Always" overview-box
 * assignment. Pure so they're unit-testable. See spec §7.1–7.2.
 */
import {
  formatWeekRange,
  getWeekString,
  parseWeekString,
  taskScheduledOnDay,
} from "@/lib/date-utils"
import { taskBelongsInOverviewBox } from "@/lib/item-utils"
import { scheduleFieldsForPeriod, clearedScheduleFields } from "@/lib/scheduling"
import type { Task, SchedulePeriod, List } from "@/lib/types"

export type SchedulerSortBy = "category" | "duration" | "importance" | "deadline" | "reward"
export type SchedulerSortOrder = "asc" | "desc"

export interface OverviewBox {
  label: string
  period: SchedulePeriod
  value: string
}

/**
 * IDs of lists marked scheduleable. A list is scheduleable unless explicitly
 * turned off, so older lists without the flag still appear.
 */
export function getScheduleableCategoryIds(lists: List[]): Set<string> {
  return new Set(lists.filter((c) => c.scheduleable !== false).map((c) => c.id))
}

export function isTaskScheduleable(task: Task, scheduleableCategoryIds: Set<string>): boolean {
  // A task-level override always wins over its lists' scheduleable flags, so
  // toggling "Show in Scheduler" off in the item detail view removes it here.
  if (task.scheduleable === false) return false
  if (task.scheduleable === true) return true
  return task.lists?.some((catId) => scheduleableCategoryIds.has(catId)) ?? false
}

export interface AvailableTasksOptions {
  activeTab: SchedulePeriod
  selectedCategories: string[]
  sortBy: SchedulerSortBy
  sortOrder: SchedulerSortOrder
  lists: List[]
  scheduleableCategoryIds: Set<string>
}

/** Available = not completed, no unmet deps, in a scheduleable list; filtered + sorted. */
export function getAvailableTasks(allTasks: Task[], opts: AvailableTasksOptions): Task[] {
  const { activeTab, selectedCategories, sortBy, sortOrder, lists, scheduleableCategoryIds } = opts

  let tasks = allTasks.filter((task) => {
    if (task.completed) return false
    if (!isTaskScheduleable(task, scheduleableCategoryIds)) return false

    const hasUnmetDependencies = (task.dependencies ?? []).some((depId) => {
      const depTask = allTasks.find((t) => t.id === depId)
      return depTask && !depTask.completed
    })
    if (hasUnmetDependencies) return false

    if (activeTab === "always") {
      return !task.scheduledYear && !task.scheduledMonth && !task.scheduledWeek && !task.scheduledDate
    }
    return true
  })

  if (selectedCategories.length > 0) {
    tasks = tasks.filter((task) => task.lists?.some((catId) => selectedCategories.includes(catId)))
  }

  const valueFor = (task: Task): number | string => {
    switch (sortBy) {
      case "category":
        return task.lists?.[0] ? lists.find((c) => c.id === task.lists[0])?.name || "" : ""
      case "duration":
        return task.estimatedDuration ?? 0
      case "deadline":
        return task.deadline ? new Date(task.deadline).getTime() : 0
      case "reward":
        return task.rewardValue ?? 0
      case "importance":
      default:
        return task.importance ?? 0
    }
  }

  return [...tasks].sort((a, b) => {
    const aValue = valueFor(a)
    const bValue = valueFor(b)
    if (sortOrder === "asc") return aValue > bValue ? 1 : -1
    return aValue < bValue ? 1 : -1
  })
}

/** Tasks assigned to exactly a period bucket (non-nesting, used in the grids). */
export function getTasksForPeriod(
  allTasks: Task[],
  period: SchedulePeriod,
  value: string | undefined,
  currentDate: Date,
): Task[] {
  const availableTasks = allTasks.filter((task) => !task.completed)
  switch (period) {
    case "year":
      return availableTasks.filter((task) => task.scheduledYear === value)
    case "month":
      return availableTasks.filter((task) => task.scheduledMonth === value)
    case "week":
      return availableTasks.filter((task) => {
        if (task.scheduledWeek === value) return true
        if (task.scheduledMonth && value) {
          const weekRange = parseWeekString(value)
          if (weekRange) {
            const monthStart = new Date(task.scheduledMonth + "-01")
            const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
            return weekRange.start >= monthStart && weekRange.start <= monthEnd
          }
        }
        return false
      })
    case "day":
      return availableTasks.filter((task) => taskScheduledOnDay(task, value || currentDate))
    default:
      return availableTasks.filter(
        (task) => !task.scheduledYear && !task.scheduledMonth && !task.scheduledWeek && !task.scheduledDate,
      )
  }
}

/** Partial-Task updates that schedule a task to a period (clears the others). */
export const scheduleUpdatesForPeriod = scheduleFieldsForPeriod

/** Partial-Task updates that fully unschedule a task. */
export const unscheduleUpdates = clearedScheduleFields

export function getCategoryColor(lists: List[], listIds: string[] | undefined): string {
  if (!listIds || listIds.length === 0) return "#6B7280"
  const category = lists.find((c) => listIds.includes(c.id))
  return category?.color || "#6B7280"
}

export const getCurrentYear = (currentDate: Date) => currentDate.getFullYear().toString()
export const getCurrentMonth = (currentDate: Date) => currentDate.toISOString().slice(0, 7)
export const getCurrentWeek = (currentDate: Date) => getWeekString(currentDate)

export function getNavigationLabel(activeTab: SchedulePeriod, currentDate: Date): string {
  switch (activeTab) {
    case "year":
      return currentDate.getFullYear().toString()
    case "month":
      return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    case "week": {
      const weekRange = parseWeekString(getCurrentWeek(currentDate))
      return weekRange ? formatWeekRange(weekRange.start) : "Week"
    }
    case "day":
      return currentDate.toLocaleDateString("en-US", { month: "numeric", day: "numeric", year: "2-digit" })
    default:
      return ""
  }
}

/** Return a new Date moved one `activeTab` period in `dir` (-1 prev, +1 next). */
export function navigateDate(currentDate: Date, activeTab: SchedulePeriod, dir: -1 | 1): Date {
  const newDate = new Date(currentDate)
  switch (activeTab) {
    case "year":
      newDate.setFullYear(newDate.getFullYear() + dir)
      break
    case "month":
      newDate.setMonth(newDate.getMonth() + dir)
      break
    case "week":
      newDate.setDate(newDate.getDate() + 7 * dir)
      break
    case "day":
      newDate.setDate(newDate.getDate() + dir)
      break
  }
  return newDate
}

export function getMonths(currentDate: Date): { value: string; label: string }[] {
  const months = []
  for (let i = 0; i < 12; i++) {
    const date = new Date(currentDate.getFullYear(), i, 1)
    months.push({
      value: date.toISOString().slice(0, 7),
      label: date.toLocaleDateString("en-US", { month: "long" }),
    })
  }
  return months
}

export function getWeeksInMonth(monthValue: string): { value: string; label: string }[] {
  const [year, month] = monthValue.split("-").map(Number)
  const firstDay = new Date(year, month - 1, 1)
  const lastDay = new Date(year, month, 0)
  const weeks = []

  const currentWeekStart = new Date(firstDay)
  currentWeekStart.setDate(firstDay.getDate() - firstDay.getDay())

  while (currentWeekStart <= lastDay) {
    const weekEnd = new Date(currentWeekStart)
    weekEnd.setDate(currentWeekStart.getDate() + 6)
    const weekString = `${currentWeekStart.toISOString().slice(0, 10)}_${weekEnd.toISOString().slice(0, 10)}`
    weeks.push({ value: weekString, label: formatWeekRange(currentWeekStart) })
    currentWeekStart.setDate(currentWeekStart.getDate() + 7)
  }
  return weeks
}

export function getDaysInWeek(weekValue: string): { value: string; label: string }[] {
  const weekRange = parseWeekString(weekValue)
  if (!weekRange) return []
  const days = []
  const currentDay = new Date(weekRange.start)
  for (let i = 0; i < 7; i++) {
    days.push({
      value: currentDay.toISOString().slice(0, 10),
      label: currentDay.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
    })
    currentDay.setDate(currentDay.getDate() + 1)
  }
  return days
}

const PERIOD_RANK: Record<SchedulePeriod, number> = { always: 0, year: 1, month: 2, week: 3, day: 4 }

export function buildOverviewBoxes(currentDate: Date): OverviewBox[] {
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1).toISOString().slice(0, 7)
  const nextWeek = new Date(currentDate)
  nextWeek.setDate(currentDate.getDate() + 7)
  const tomorrow = new Date(currentDate)
  tomorrow.setDate(currentDate.getDate() + 1)
  return [
    { label: "This Year", period: "year", value: getCurrentYear(currentDate) },
    { label: "This Month", period: "month", value: getCurrentMonth(currentDate) },
    { label: "Next Month", period: "month", value: nextMonth },
    { label: "This Week", period: "week", value: getCurrentWeek(currentDate) },
    { label: "Next Week", period: "week", value: getWeekString(nextWeek) },
    { label: "Today", period: "day", value: currentDate.toISOString().slice(0, 10) },
    { label: "Tomorrow", period: "day", value: tomorrow.toISOString().slice(0, 10) },
  ]
}

function boxMatchesTask(task: Task, period: SchedulePeriod, value: string): boolean {
  if (period === "always") return false
  return taskBelongsInOverviewBox(task, period as "year" | "month" | "week" | "day", value)
}

/** Assign each task to a single overview box (its most specific match). */
export function assignTasksToOverviewBoxes(allTasks: Task[], overviewBoxes: OverviewBox[]): Record<string, Task[]> {
  const map: Record<string, Task[]> = {}
  overviewBoxes.forEach((b) => (map[b.label] = []))
  allTasks
    .filter((t) => !t.completed)
    .forEach((task) => {
      let best: OverviewBox | null = null
      for (const b of overviewBoxes) {
        if (boxMatchesTask(task, b.period, b.value)) {
          if (!best || PERIOD_RANK[b.period] > PERIOD_RANK[best.period]) best = b
        }
      }
      if (best) map[best.label].push(task)
    })
  return map
}
