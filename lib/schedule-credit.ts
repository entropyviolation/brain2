/**
 * lib/schedule-credit.ts — Points for placing a task in a real period bucket
 *
 * Mirrors inbox-credit: one point per scheduling act that changes the task's
 * period assignment. Eventually / Later, unschedule, remove-from-scheduler,
 * and same-bucket re-drops do not award. Writes the shared points ledger.
 */
import { formatLocalDateKey } from "@/lib/date-utils"
import { itemTitle } from "@/lib/item-utils"
import { usePointsStore } from "@/lib/points-store"
import type { SchedulePeriod, Task } from "@/lib/types"

export const SCHEDULE_POINTS = 1

type PeriodFields = Pick<Task, "scheduledYear" | "scheduledMonth" | "scheduledWeek" | "scheduledDate">

/** Canonical key for the task's current period bucket, or null when unscheduled. */
export function periodBucketKey(task: PeriodFields): string | null {
  if (task.scheduledDate) {
    const date = task.scheduledDate instanceof Date ? task.scheduledDate : new Date(task.scheduledDate)
    if (!Number.isNaN(date.getTime())) return `day:${formatLocalDateKey(date)}`
  }
  if (task.scheduledWeek) return `week:${task.scheduledWeek}`
  if (task.scheduledMonth) return `month:${task.scheduledMonth}`
  if (task.scheduledYear) return `year:${task.scheduledYear}`
  return null
}

/** Canonical key for a drop/click target period, or null for Always (clear). */
export function targetPeriodBucketKey(period: SchedulePeriod, value: string): string | null {
  if (period === "always") return null
  if (period === "day") return `day:${value}`
  return `${period}:${value}`
}

/**
 * True when placing this task onto `period`/`value` would change its period
 * assignment. Same-bucket re-drops and Always (clear) do not earn a point.
 */
export function earnsSchedulePoint(task: PeriodFields, period: SchedulePeriod, value: string): boolean {
  const target = targetPeriodBucketKey(period, value)
  if (!target) return false
  return periodBucketKey(task) !== target
}

export function scheduleCreditLabel(task: Pick<Task, "title" | "description"> | string): string {
  const name = typeof task === "string" ? task.trim() : itemTitle(task)
  return `${name || "Task"} scheduled`
}

export function creditSchedulePlacement(taskId: string, title: string): void {
  usePointsStore.getState().addPoints(taskId, SCHEDULE_POINTS, scheduleCreditLabel(title))
}
