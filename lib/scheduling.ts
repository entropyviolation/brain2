/**
 * lib/scheduling.ts — Canonical schedule-field helpers
 *
 * Pure helpers that compute the `scheduled*` field updates for placing a task in
 * a period bucket (or clearing it). Shared by the Scheduler UI
 * (`components/Scheduler/scheduler-utils.ts`) and the scheduling domain service
 * so there is exactly one definition of "what scheduling to a period means".
 *
 * Spec: §7 (Scheduler period funnel).
 */
import { parseLocalDate } from "@/lib/date-utils"
import type { Task, SchedulePeriod } from "@/lib/types"

/** Field updates that schedule a task to a period, clearing the coarser/finer ones. */
export function scheduleFieldsForPeriod(period: SchedulePeriod, value: string): Partial<Task> {
  const updates: Partial<Task> = {
    scheduledYear: undefined,
    scheduledMonth: undefined,
    scheduledWeek: undefined,
    scheduledDate: undefined,
  }
  switch (period) {
    case "year":
      updates.scheduledYear = value
      break
    case "month":
      updates.scheduledMonth = value
      break
    case "week":
      updates.scheduledWeek = value
      break
    case "day":
      updates.scheduledDate = parseLocalDate(value) ?? new Date(value)
      break
  }
  return updates
}

/** Field updates that fully unschedule a task (clears all scheduling fields). */
export function clearedScheduleFields(): Partial<Task> {
  return {
    scheduledYear: undefined,
    scheduledMonth: undefined,
    scheduledWeek: undefined,
    scheduledDate: undefined,
    scheduledTime: undefined,
  }
}
