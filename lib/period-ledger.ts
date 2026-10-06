/**
 * lib/period-ledger.ts — The three lists of one period
 *
 * To do is what is scheduled for the period now (prospective). Once the period
 * has ended, those still-incomplete rows move to Undone and are not repeated
 * on To do.
 * Done is what was completed during the period.
 * Undone, for a period that has already ended, is what was assigned then and
 * was still incomplete when the next period started. Finishing it later does
 * not remove it. Home → To Do uses these same sets.
 */
import type { Folder, SchedulePlacementPeriod, Task } from "@/lib/types"
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  getWeekString,
  taskScheduledInMonth,
  taskScheduledInWeek,
  taskScheduledInYear,
  taskScheduledOnDay,
} from "@/lib/date-utils"
import { getTaskCompletionDate, isCancelled, isClearedFromWork, isMissed } from "@/lib/completion-status"
import { countsInDone } from "@/lib/item-utils"
import { isPastFunnelPeriod, isUndonePlacementDiscarded, taskWasScheduledForPeriod } from "@/lib/scheduling"

export type PeriodLedgerKind = "todo" | "done" | "undone"

function scheduledForPeriod(task: Task, period: SchedulePlacementPeriod, value: string): boolean {
  switch (period) {
    case "day":
      return taskScheduledOnDay(task, value)
    case "week":
      return taskScheduledInWeek(task, value)
    case "month":
      return taskScheduledInMonth(task, value)
    case "year":
      return taskScheduledInYear(task, value)
  }
}

/** Open work assigned to this period right now. Hidden rows stay off the To Do list. */
export function tasksProspectiveForPeriod(
  tasks: Task[],
  period: SchedulePlacementPeriod,
  value: string,
  now: Date = new Date(),
): Task[] {
  const open = tasks.filter(
    (task) => !isClearedFromWork(task) && !task.hiddenFromTodo && scheduledForPeriod(task, period, value),
  )
  if (!isPastFunnelPeriod(period, value, now)) return open
  // A past period's open table does not repeat rows that belong on Undone.
  const undone = new Set(tasksUndoneForPeriod(tasks, period, value, now).map((task) => task.id))
  return open.filter((task) => !undone.has(task.id))
}

export function completedDuringPeriod(task: Task, period: SchedulePlacementPeriod, value: string): boolean {
  if (!task.completed) return false
  const at = getTaskCompletionDate(task)
  if (!at) return false
  switch (period) {
    case "day":
      return formatLocalDateKey(at) === value
    case "week":
      return getWeekString(at) === value
    case "month":
      return formatLocalMonthKey(at) === value
    case "year":
      return String(at.getFullYear()) === value
  }
}

/** Completed during the period. Tasks and logged actions, same as Home → To Do Done. */
export function tasksCompletedInPeriod(
  tasks: Task[],
  period: SchedulePlacementPeriod,
  value: string,
  folders: Folder[] = [],
): Task[] {
  return tasks.filter((task) => countsInDone(task, folders) && completedDuringPeriod(task, period, value))
}

/**
 * Assigned to a past period and not completed during it.
 * Current and future periods are empty — that work is still To do.
 */
export function tasksUndoneForPeriod(
  tasks: Task[],
  period: SchedulePlacementPeriod,
  value: string,
  now: Date = new Date(),
): Task[] {
  if (!isPastFunnelPeriod(period, value, now)) return []
  return tasks.filter((task) => {
    if (task.hiddenFromTodo || isCancelled(task) || isMissed(task)) return false
    if (completedDuringPeriod(task, period, value)) return false
    if (!taskWasScheduledForPeriod(task, period, value)) return false
    if (isUndonePlacementDiscarded(task, period, value)) return false
    return true
  })
}

export function tasksForLedgerKind(
  tasks: Task[],
  kind: PeriodLedgerKind,
  period: SchedulePlacementPeriod,
  value: string,
  folders: Folder[] = [],
  now: Date = new Date(),
): Task[] {
  if (kind === "todo") return tasksProspectiveForPeriod(tasks, period, value, now)
  if (kind === "done") return tasksCompletedInPeriod(tasks, period, value, folders)
  return tasksUndoneForPeriod(tasks, period, value, now)
}
