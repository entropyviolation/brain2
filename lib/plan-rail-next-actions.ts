/**
 * lib/plan-rail-next-actions.ts — Next Actions visible on a Plan period rail
 *
 * Same meaning as Lists: membership in a Next Actions folder list
 * (`taskIsNextAction`). The rail then keeps only open, dependency-available
 * tasks that can still be worked during the Plan period on screen
 * (day / week / month). A future-only schedule hides the row; overdue or
 * unscheduled next actions stay.
 */
import { format, startOfMonth } from "date-fns"
import { isAvailableNow } from "@/lib/available-tasks"
import { isClearedFromWork } from "@/lib/completion-status"
import {
  formatLocalMonthKey,
  getWeekStartDate,
  getWeekString,
  parseLocalDate,
  parseWeekString,
  sameCalendarDay,
} from "@/lib/date-utils"
import { isLoggedAction, taskIsNextAction } from "@/lib/item-utils"
import type { Folder, Task } from "@/lib/types"

export type PlanRailPeriod = "day" | "week" | "month"

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function periodEnd(mode: PlanRailPeriod, date: Date): Date {
  if (mode === "day") return startOfDay(date)
  if (mode === "week") {
    const start = getWeekStartDate(date)
    return new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6)
  }
  const monthStart = startOfMonth(date)
  return new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0)
}

/** True when the stored schedule does not lock the task after this period. */
export function canWorkDuringPlanPeriod(task: Task, mode: PlanRailPeriod, date: Date): boolean {
  const end = periodEnd(mode, date)
  if (task.scheduledDate) {
    const scheduled = parseLocalDate(task.scheduledDate)
    if (!scheduled) return true
    return startOfDay(scheduled) <= end
  }
  if (task.scheduledWeek) {
    const range = parseWeekString(task.scheduledWeek)
    if (!range) return true
    return startOfDay(range.start) <= end
  }
  if (task.scheduledMonth) {
    const monthEnd = formatLocalMonthKey(end)
    return task.scheduledMonth <= monthEnd
  }
  if (task.scheduledYear) {
    return Number(task.scheduledYear) <= end.getFullYear()
  }
  return true
}

export function nextActionsForPlanPeriod(
  tasks: Task[],
  folders: Folder[],
  mode: PlanRailPeriod,
  date: Date,
): Task[] {
  return tasks.filter((task) => {
    if (!taskIsNextAction(task, folders)) return false
    if (isClearedFromWork(task) || isLoggedAction(task)) return false
    if (!isAvailableNow(task, tasks)) return false
    if (!canWorkDuringPlanPeriod(task, mode, date)) return false
    if (mode === "day" && task.scheduledDate && sameCalendarDay(task.scheduledDate, date) && task.scheduledTime) {
      return false
    }
    return true
  })
}

export function nextActionMeta(task: Task): string {
  if (task.scheduledTime) return `Next action · ${task.scheduledTime}`
  return "Next action"
}
