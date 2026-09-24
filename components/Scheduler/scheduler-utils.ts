/**
 * components/Scheduler/scheduler-utils.ts — Pure Scheduler helpers
 *
 * Period-funnel logic with no React: which tasks are available/scheduleable,
 * per-period task queries, the schedule/unschedule field updates, calendar grid
 * builders (months/weeks/days), navigation, "Always" overview-box assignment,
 * and which ids a drag drop should schedule (`taskIdsForDragSchedule`).
 * Pure so they're unit-testable. See spec §7.1–7.2.
 */
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  formatWeekRange,
  getWeekString,
  parseWeekString,
  taskScheduledOnDay,
} from "@/lib/date-utils"
import { isAvailableNow } from "@/lib/available-tasks"
import { isOnEventuallyList } from "@/lib/eventually-list"
import { isClearedFromWork } from "@/lib/completion-status"
import { taskBelongsInOverviewBox } from "@/lib/item-utils"
import {
  scheduleFieldsForPeriod,
  clearedScheduleFields,
  isPastFunnelPeriod,
  taskHasSchedulePlacement,
} from "@/lib/scheduling"
import type { Task, SchedulePeriod, SchedulePlacementPeriod, List } from "@/lib/types"

export type SchedulerSortBy = "category" | "duration" | "importance" | "deadline" | "reward"
export type SchedulerSortOrder = "asc" | "desc"

export interface OverviewBox {
  label: string
  period: SchedulePeriod
  value: string
  /** Eventually / Later holds tasks on the eventually list and sets no period. */
  kind?: "period" | "eventually"
  /** Secondary line, such as the real calendar date behind Today / Tomorrow. */
  detail?: string
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
  // toggling Schedulable off in the item detail view removes it here.
  if (task.scheduleable === false) return false
  if (task.scheduleable === true) return true
  return taskInheritsScheduleableFromLists(task, scheduleableCategoryIds)
}

/** True when at least one of the item's lists is scheduleable (the inherit-on case). */
export function taskInheritsScheduleableFromLists(
  task: Pick<Task, "lists">,
  scheduleableCategoryIds: Set<string>,
): boolean {
  return task.lists?.some((catId) => scheduleableCategoryIds.has(catId)) ?? false
}

/**
 * Next raw `task.scheduleable` after the Schedulable switch flips.
 * Off → force hidden. On → inherit (`undefined`) when a list already includes
 * the item; force `true` only when every list is unschedulable (or there are none).
 */
export function nextTaskScheduleableFlag(opts: {
  turnOn: boolean
  inheritsOnFromLists: boolean
}): boolean | undefined {
  if (!opts.turnOn) return false
  return opts.inheritsOnFromLists ? undefined : true
}

export interface AvailableTasksOptions {
  activeTab: SchedulePeriod
  selectedCategories: string[]
  sortBy: SchedulerSortBy
  sortOrder: SchedulerSortOrder
  lists: List[]
  scheduleableCategoryIds: Set<string>
  /** Tasks on this list sit in Eventually / Later, not the unscheduled inbox. */
  eventuallyListId?: string
}

/** Available = not completed, no unmet deps, in a scheduleable list; filtered + sorted. */
export function getAvailableTasks(allTasks: Task[], opts: AvailableTasksOptions): Task[] {
  const { activeTab, selectedCategories, sortBy, sortOrder, lists, scheduleableCategoryIds, eventuallyListId } = opts

  let tasks = allTasks.filter((task) => {
    if (isClearedFromWork(task)) return false
    if (!isTaskScheduleable(task, scheduleableCategoryIds)) return false

    if (!isAvailableNow(task, allTasks)) return false

    if (activeTab === "always") {
      if (task.scheduledYear || task.scheduledMonth || task.scheduledWeek || task.scheduledDate) return false
      if (isOnEventuallyList(task, eventuallyListId)) return false
      return true
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

function liveTasksForPeriod(
  tasks: Task[],
  period: SchedulePeriod,
  value: string | undefined,
  currentDate: Date,
): Task[] {
  switch (period) {
    case "year":
      return tasks.filter((task) => task.scheduledYear === value)
    case "month":
      return tasks.filter((task) => task.scheduledMonth === value)
    case "week":
      return tasks.filter((task) => {
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
      return tasks.filter((task) => taskScheduledOnDay(task, value || currentDate))
    default:
      return tasks.filter(
        (task) => !task.scheduledYear && !task.scheduledMonth && !task.scheduledWeek && !task.scheduledDate,
      )
  }
}

/**
 * Tasks assigned to a period bucket. Current and future cells show live open
 * work only. Past cells also surface historical placements (`schedulePlacements`)
 * and completed/missed rows that still carry that period field.
 */
export function getTasksForPeriod(
  allTasks: Task[],
  period: SchedulePeriod,
  value: string | undefined,
  currentDate: Date,
  now: Date = new Date(),
): Task[] {
  const placementPeriod = period === "always" ? null : (period as SchedulePlacementPeriod)
  const past =
    placementPeriod != null && value != null && isPastFunnelPeriod(placementPeriod, value, now)

  if (!past) {
    return liveTasksForPeriod(
      allTasks.filter((task) => !isClearedFromWork(task)),
      period,
      value,
      currentDate,
    )
  }

  const liveOpen = liveTasksForPeriod(
    allTasks.filter((task) => !isClearedFromWork(task)),
    period,
    value,
    currentDate,
  )
  const liveCleared = liveTasksForPeriod(
    allTasks.filter((task) => isClearedFromWork(task)),
    period,
    value,
    currentDate,
  )
  const fromHistory =
    value != null && placementPeriod
      ? allTasks.filter((task) => taskHasSchedulePlacement(task, placementPeriod, value))
      : []

  const seen = new Set<string>()
  const out: Task[] = []
  for (const task of [...liveOpen, ...liveCleared, ...fromHistory]) {
    if (seen.has(task.id)) continue
    seen.add(task.id)
    out.push(task)
  }
  return out
}

/** Re-export for funnel grid past styling. */
export { isPastFunnelPeriod }

/**
 * Which task ids a funnel drop should schedule.
 *
 * If the selection is non-empty and includes the dragged task, schedule every
 * selected id. Otherwise schedule only the dragged task (empty selection, or
 * dragging a task outside the current selection).
 */
export function taskIdsForDragSchedule(
  draggedTaskId: string,
  selectedTaskIds: ReadonlySet<string> | Iterable<string>,
): string[] {
  const selected = selectedTaskIds instanceof Set ? selectedTaskIds : new Set(selectedTaskIds)
  if (selected.size > 0 && selected.has(draggedTaskId)) return Array.from(selected)
  return [draggedTaskId]
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
export const getCurrentMonth = (currentDate: Date) => formatLocalMonthKey(currentDate)
export const getCurrentWeek = (currentDate: Date) => getWeekString(currentDate)

function formatBucketDate(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })
}

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
      value: formatLocalMonthKey(date),
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
    const weekString = `${formatLocalDateKey(currentWeekStart)}_${formatLocalDateKey(weekEnd)}`
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
      value: formatLocalDateKey(currentDay),
      label: currentDay.toLocaleDateString("en-US", { weekday: "short", day: "numeric" }),
    })
    currentDay.setDate(currentDay.getDate() + 1)
  }
  return days
}

const PERIOD_RANK: Record<SchedulePeriod, number> = { always: 0, year: 1, month: 2, week: 3, day: 4 }

export function buildOverviewBoxes(currentDate: Date): OverviewBox[] {
  const nextMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)
  const nextWeek = new Date(currentDate)
  nextWeek.setDate(currentDate.getDate() + 7)
  const tomorrow = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 1)
  const todayValue = formatLocalDateKey(currentDate)
  const tomorrowValue = formatLocalDateKey(tomorrow)
  return [
    { label: "This Year", period: "year", value: getCurrentYear(currentDate) },
    { label: "This Month", period: "month", value: getCurrentMonth(currentDate) },
    { label: "Next Month", period: "month", value: formatLocalMonthKey(nextMonth) },
    { label: "This Week", period: "week", value: getCurrentWeek(currentDate) },
    { label: "Next Week", period: "week", value: getWeekString(nextWeek) },
    { label: "Today", period: "day", value: todayValue, detail: formatBucketDate(currentDate) },
    { label: "Tomorrow", period: "day", value: tomorrowValue, detail: formatBucketDate(tomorrow) },
    { label: "Eventually / Later", period: "always", value: "eventually", kind: "eventually" },
  ]
}

function boxMatchesTask(task: Task, period: SchedulePeriod, value: string): boolean {
  if (period === "always") return false
  return taskBelongsInOverviewBox(task, period as "year" | "month" | "week" | "day", value)
}

/** Assign each task to a single overview box (its most specific match). */
export function assignTasksToOverviewBoxes(
  allTasks: Task[],
  overviewBoxes: OverviewBox[],
  eventuallyListId?: string,
): Record<string, Task[]> {
  const map: Record<string, Task[]> = {}
  overviewBoxes.forEach((b) => (map[b.label] = []))
  allTasks
    .filter((t) => !isClearedFromWork(t))
    .forEach((task) => {
      const held = isOnEventuallyList(task, eventuallyListId)
      const unscheduled = !task.scheduledYear && !task.scheduledMonth && !task.scheduledWeek && !task.scheduledDate
      if (held && unscheduled) {
        const bucket = overviewBoxes.find((b) => b.kind === "eventually")
        if (bucket) map[bucket.label].push(task)
        return
      }
      let best: OverviewBox | null = null
      for (const b of overviewBoxes) {
        if (b.kind === "eventually") continue
        if (boxMatchesTask(task, b.period, b.value)) {
          if (!best || PERIOD_RANK[b.period] > PERIOD_RANK[best.period]) best = b
        }
      }
      if (best) map[best.label].push(task)
    })
  return map
}
