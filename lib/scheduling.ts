/**
 * lib/scheduling.ts — Canonical schedule-field helpers
 *
 * Pure helpers that compute the `scheduled*` field updates for placing a task in
 * a period bucket (or clearing it), detect past funnel periods, and roll an
 * unfinished live schedule up one level while recording the prior placement.
 * Shared by the Scheduler UI (`components/Scheduler/scheduler-utils.ts`) and the
 * scheduling domain service so there is exactly one definition of "what
 * scheduling to a period means".
 *
 * Spec: §7 (Scheduler period funnel).
 */
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  getWeekString,
  isPastLocalCalendarDay,
  parseLocalDate,
} from "@/lib/date-utils"
import { isClearedFromWork } from "@/lib/completion-status"
import type {
  Task,
  SchedulePeriod,
  SchedulePlacement,
  SchedulePlacementPeriod,
} from "@/lib/types"

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

/**
 * True when a funnel cell's period is already over (local calendar).
 * Today / the current week / current month / current year are never past.
 * A week is past only when its last day is before today.
 */
export function isPastFunnelPeriod(
  period: SchedulePlacementPeriod,
  value: string,
  now: Date = new Date(),
): boolean {
  switch (period) {
    case "day":
      return isPastLocalCalendarDay(value, now)
    case "week": {
      const endKey = value.split("_")[1]
      if (!endKey) return false
      return isPastLocalCalendarDay(endKey, now)
    }
    case "month":
      return value < formatLocalMonthKey(now)
    case "year":
      return value < String(now.getFullYear())
  }
}

/**
 * A day assignment whose calendar date is already over and still live work.
 * Today and any later date stay. Done and missed rows stay, so history is kept.
 * A push writes the next day's date, which is not expired when that day arrives.
 */
export function isExpiredDaySchedule(
  task: Pick<Task, "scheduledDate" | "completed" | "status">,
  now: Date = new Date(),
): boolean {
  if (!task.scheduledDate || isClearedFromWork(task)) return false
  const date = parseLocalDate(task.scheduledDate)
  if (!date) return false
  return isPastLocalCalendarDay(date, now)
}

export function taskHasSchedulePlacement(
  task: Pick<Task, "schedulePlacements">,
  period: SchedulePlacementPeriod,
  value: string,
): boolean {
  return (task.schedulePlacements ?? []).some((p) => p.period === period && p.value === value)
}

export function appendSchedulePlacement(
  existing: SchedulePlacement[] | undefined,
  entry: SchedulePlacement,
): SchedulePlacement[] {
  const list = existing ?? []
  if (list.some((p) => p.period === entry.period && p.value === entry.value)) return list
  return [...list, entry]
}

/**
 * One automatic roll-up step for an unfinished live schedule.
 * day → week → month → year → unscheduled. Does not increment push counters.
 * Explicit pushes already wrote a non-expired period, so they are not rolled.
 */
export function rollUpScheduleFields(task: Task, now: Date = new Date()): Partial<Task> | null {
  if (isClearedFromWork(task)) return null

  if (task.scheduledDate) {
    const date = parseLocalDate(task.scheduledDate)
    if (!date || !isPastLocalCalendarDay(date, now)) return null
    const dayKey = formatLocalDateKey(date)
    return {
      scheduledDate: undefined,
      scheduledTime: undefined,
      scheduledWeek: getWeekString(date),
      scheduledMonth: undefined,
      scheduledYear: undefined,
      schedulePlacements: appendSchedulePlacement(task.schedulePlacements, {
        period: "day",
        value: dayKey,
      }),
    }
  }

  if (task.scheduledWeek) {
    if (!isPastFunnelPeriod("week", task.scheduledWeek, now)) return null
    const startKey = task.scheduledWeek.split("_")[0]
    const start = parseLocalDate(startKey)
    if (!start) return null
    return {
      scheduledWeek: undefined,
      scheduledMonth: formatLocalMonthKey(start),
      scheduledYear: undefined,
      scheduledDate: undefined,
      scheduledTime: undefined,
      schedulePlacements: appendSchedulePlacement(task.schedulePlacements, {
        period: "week",
        value: task.scheduledWeek,
      }),
    }
  }

  if (task.scheduledMonth) {
    if (!isPastFunnelPeriod("month", task.scheduledMonth, now)) return null
    return {
      scheduledMonth: undefined,
      scheduledYear: task.scheduledMonth.slice(0, 4),
      scheduledWeek: undefined,
      scheduledDate: undefined,
      scheduledTime: undefined,
      schedulePlacements: appendSchedulePlacement(task.schedulePlacements, {
        period: "month",
        value: task.scheduledMonth,
      }),
    }
  }

  if (task.scheduledYear) {
    if (!isPastFunnelPeriod("year", task.scheduledYear, now)) return null
    return {
      ...clearedScheduleFields(),
      schedulePlacements: appendSchedulePlacement(task.schedulePlacements, {
        period: "year",
        value: task.scheduledYear,
      }),
    }
  }

  return null
}

/**
 * Cascade roll-ups until the live schedule is current or fully unscheduled.
 * Caps at four steps (day→week→month→year→clear).
 */
export function rollUpScheduleFieldsCascaded(task: Task, now: Date = new Date()): Partial<Task> | null {
  let merged: Partial<Task> | null = null
  let current: Task = task
  for (let i = 0; i < 4; i++) {
    const step = rollUpScheduleFields(current, now)
    if (!step) break
    merged = { ...(merged ?? {}), ...step }
    current = { ...current, ...step }
  }
  return merged
}
