/**
 * lib/scheduling.ts — Canonical schedule-field helpers
 *
 * Pure helpers that compute the `scheduled*` field updates for placing a task in
 * a period bucket (or clearing it), detect past funnel periods, roll an
 * unfinished live schedule up one level while recording the prior placement,
 * dismiss a past-cell history row (`dismissFromPeriodFields` /
 * `removeSchedulePlacement`) without wiping unrelated analytics placements,
 * and triage one past placement off the To Do Undone list (assimilate / push /
 * discard) while keeping that history for gray Scheduler cells.
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
  parseWeekString,
  sameWeekKey,
} from "@/lib/date-utils"
import { isClearedFromWork, withStatus } from "@/lib/completion-status"
import type {
  Task,
  SchedulePeriod,
  SchedulePlacement,
  SchedulePlacementPeriod,
  SchedulePlacementResolution,
  StoredBlockedReason,
} from "@/lib/types"

/**
 * True only when Scheduleable was turned on. Omitted and `false` stay out of
 * the Scheduler. A task, a next action, and a list of tasks are not included
 * just for being those things.
 */
export function isExplicitlyScheduleable(
  record: { scheduleable?: boolean } | null | undefined,
): boolean {
  return record?.scheduleable === true
}

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

/** Week ranges compare as the same Monday–Sunday week; every other period is exact. */
function placementValuesMatch(period: SchedulePlacementPeriod, a: string, b: string): boolean {
  return period === "week" ? sameWeekKey(a, b) : a === b
}

export function taskHasSchedulePlacement(
  task: Pick<Task, "schedulePlacements">,
  period: SchedulePlacementPeriod,
  value: string,
): boolean {
  return (task.schedulePlacements ?? []).some(
    (p) => p.period === period && placementValuesMatch(period, p.value, value),
  )
}

export function appendSchedulePlacement(
  existing: SchedulePlacement[] | undefined,
  entry: SchedulePlacement,
): SchedulePlacement[] {
  const list = existing ?? []
  if (list.some((p) => p.period === entry.period && placementValuesMatch(entry.period, p.value, entry.value))) {
    return list
  }
  return [...list, entry]
}

/** Drop one recorded placement (past-cell × / drag-away). Keeps other history. */
export function removeSchedulePlacement(
  existing: SchedulePlacement[] | undefined,
  period: SchedulePlacementPeriod,
  value: string,
): SchedulePlacement[] | undefined {
  const next = (existing ?? []).filter((p) => !(p.period === period && placementValuesMatch(period, p.value, value)))
  return next.length === 0 ? undefined : next
}

/** True when the task's live schedule fields still sit on this period bucket. */
export function livePeriodMatches(
  task: Pick<Task, "scheduledDate" | "scheduledWeek" | "scheduledMonth" | "scheduledYear">,
  period: SchedulePlacementPeriod,
  value: string,
): boolean {
  switch (period) {
    case "day": {
      if (!task.scheduledDate) return false
      const date = parseLocalDate(task.scheduledDate)
      return date != null && formatLocalDateKey(date) === value
    }
    case "week":
      return !!task.scheduledWeek && sameWeekKey(task.scheduledWeek, value)
    case "month":
      return task.scheduledMonth === value
    case "year":
      return task.scheduledYear === value
  }
}

/**
 * Field updates that dismiss a task from one past funnel cell.
 * Removes that `schedulePlacements` entry. If live fields still match the cell
 * and the period is past, rolls up one level without re-recording that cell.
 * Does not clear a coarser live schedule that is still current.
 */
export function dismissFromPeriodFields(
  task: Task,
  period: SchedulePlacementPeriod,
  value: string,
  now: Date = new Date(),
): Partial<Task> {
  const withoutPlacement = removeSchedulePlacement(task.schedulePlacements, period, value)
  const base: Partial<Task> = { schedulePlacements: withoutPlacement }

  if (!livePeriodMatches(task, period, value) || isClearedFromWork(task)) {
    return base
  }

  if (!isPastFunnelPeriod(period, value, now)) {
    return { ...clearedScheduleFields(), schedulePlacements: withoutPlacement }
  }

  // Roll up using placements that already omit this cell, so roll-up does not
  // re-append the placement the user just dismissed.
  const rolled = rollUpScheduleFields({ ...task, schedulePlacements: withoutPlacement }, now)
  if (!rolled) {
    return { ...clearedScheduleFields(), schedulePlacements: withoutPlacement }
  }
  return {
    ...rolled,
    schedulePlacements: removeSchedulePlacement(rolled.schedulePlacements, period, value),
  }
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

/** One same-grain step when Auto-push is on. A past day becomes the next day, and so on. */
function autoPushOneStep(task: Task, now: Date): Partial<Task> | null {
  if (isClearedFromWork(task)) return null

  if (task.scheduledDate) {
    const date = parseLocalDate(task.scheduledDate)
    if (!date || !isPastLocalCalendarDay(date, now)) return null
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
    return {
      ...scheduleFieldsForPeriod("day", formatLocalDateKey(next)),
      scheduledTime: undefined,
      daysPushed: (task.daysPushed ?? 0) + 1,
      hiddenFromTodo: false,
      schedulePlacements: recordPushedPlacement(
        task.schedulePlacements,
        "day",
        formatLocalDateKey(date),
      ),
    }
  }

  if (task.scheduledWeek) {
    if (!isPastFunnelPeriod("week", task.scheduledWeek, now)) return null
    const range = parseWeekString(task.scheduledWeek)
    if (!range) return null
    const nextStart = new Date(range.start.getFullYear(), range.start.getMonth(), range.start.getDate() + 7)
    return {
      ...scheduleFieldsForPeriod("week", getWeekString(nextStart)),
      weeksPushed: (task.weeksPushed ?? 0) + 1,
      hiddenFromTodo: false,
      schedulePlacements: recordPushedPlacement(task.schedulePlacements, "week", task.scheduledWeek),
    }
  }

  if (task.scheduledMonth) {
    if (!isPastFunnelPeriod("month", task.scheduledMonth, now)) return null
    const start = parseLocalDate(`${task.scheduledMonth}-01`)
    if (!start) return null
    const next = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    return {
      ...scheduleFieldsForPeriod("month", formatLocalMonthKey(next)),
      monthsPushed: (task.monthsPushed ?? 0) + 1,
      hiddenFromTodo: false,
      schedulePlacements: recordPushedPlacement(task.schedulePlacements, "month", task.scheduledMonth),
    }
  }

  return rollUpScheduleFields(task, now)
}

/** Keep stepping Auto-push until the live To Do period is current, or the cap. */
function autoPushUntilCurrent(task: Task, now: Date): Partial<Task> | null {
  let merged: Partial<Task> | null = null
  let current: Task = task
  for (let i = 0; i < 800; i++) {
    const step = autoPushOneStep(current, now)
    if (!step) break
    merged = { ...(merged ?? {}), ...step }
    current = { ...current, ...step }
  }
  return merged
}

/**
 * Cascade until the live schedule is current.
 * Auto-push walks the same grain (day→next day) and records every missed period.
 * Otherwise roll up at most four steps (day→week→month→year→clear).
 */
export function rollUpScheduleFieldsCascaded(task: Task, now: Date = new Date()): Partial<Task> | null {
  if (task.autoPush === true) return autoPushUntilCurrent(task, now)
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

function placementStartDate(placement: SchedulePlacement): Date | null {
  switch (placement.period) {
    case "day":
      return parseLocalDate(placement.value)
    case "week":
      return parseWeekString(placement.value)?.start ?? null
    case "month":
      return parseLocalDate(`${placement.value}-01`)
    case "year": {
      const year = Number(placement.value)
      return Number.isFinite(year) ? new Date(year, 0, 1) : null
    }
  }
}

/** Start of the earliest Undone period. Discarded placements do not count. */
export function earliestUndoneDate(task: Pick<Task, "schedulePlacements">): Date | null {
  let best: Date | null = null
  for (const placement of task.schedulePlacements ?? []) {
    if (placement.resolved === "discarded") continue
    const start = placementStartDate(placement)
    if (!start) continue
    if (!best || start.getTime() < best.getTime()) best = start
  }
  return best
}

/**
 * Date To Do overdue counts measure from. The earlier of the live scheduled
 * day and the earliest Undone period, so a push forward does not erase how
 * long the task has already been waiting. A deadline is a separate field.
 */
export function priorityDateOf(task: Pick<Task, "schedulePlacements" | "scheduledDate">): Date | null {
  const scheduled = parseLocalDate(task.scheduledDate)
  const undone = earliestUndoneDate(task)
  if (scheduled && undone) return scheduled.getTime() <= undone.getTime() ? scheduled : undone
  return undone ?? scheduled
}

/** Live bucket or a recorded placement — the task was on this period. */
export function taskWasScheduledForPeriod(
  task: Pick<Task, "scheduledDate" | "scheduledWeek" | "scheduledMonth" | "scheduledYear" | "schedulePlacements">,
  period: SchedulePlacementPeriod,
  value: string,
): boolean {
  return livePeriodMatches(task, period, value) || taskHasSchedulePlacement(task, period, value)
}

/**
 * This period has already been handled in the Scheduler (push, dismiss,
 * unschedule, or assimilate). Home → To Do Undone still lists it unless the
 * resolution is `discarded`.
 */
export function isSchedulePlacementHandled(
  task: Pick<Task, "schedulePlacements">,
  period: SchedulePlacementPeriod,
  value: string,
): boolean {
  return (task.schedulePlacements ?? []).some(
    (p) => p.resolved != null && p.period === period && placementValuesMatch(period, p.value, value),
  )
}

/** A push already cleared this period from the working queue. Undone history keeps the row. */
export function isPlacementPushed(
  task: Pick<Task, "schedulePlacements">,
  period: SchedulePlacementPeriod,
  value: string,
): boolean {
  return (task.schedulePlacements ?? []).some(
    (p) => p.period === period && placementValuesMatch(period, p.value, value) && p.resolved === "pushed",
  )
}

/** Discard drops one period off Undone. A later push does not. */
export function isUndonePlacementDiscarded(
  task: Pick<Task, "schedulePlacements">,
  period: SchedulePlacementPeriod,
  value: string,
): boolean {
  return (task.schedulePlacements ?? []).some(
    (p) => p.period === period && placementValuesMatch(period, p.value, value) && p.resolved === "discarded",
  )
}

/**
 * Record the period a push is leaving, marked `pushed`.
 * The row stays in the database for Undone history and analytics.
 * Home → To Do still lists it. The Scheduler card detail treats a pushed
 * placement as already cleared from that period's working queue.
 */
export function recordPushedPlacement(
  existing: SchedulePlacement[] | undefined,
  period: SchedulePlacementPeriod,
  value: string,
  missReason?: StoredBlockedReason,
): SchedulePlacement[] {
  const marked = markSchedulePlacementResolved(
    appendSchedulePlacement(existing, { period, value }),
    period,
    value,
    "pushed",
  )
  if (!missReason) return marked
  return stampPlacementMissReason(marked, period, value, missReason)
}

/** Write an optional why onto one placement. Other history stays. */
export function stampPlacementMissReason(
  existing: SchedulePlacement[] | undefined,
  period: SchedulePlacementPeriod,
  value: string,
  missReason: StoredBlockedReason,
): SchedulePlacement[] {
  const list = existing ?? []
  const index = list.findIndex((p) => p.period === period && placementValuesMatch(period, p.value, value))
  if (index === -1) return list
  const next = list.slice()
  next[index] = { ...next[index], missReason }
  return next
}

/**
 * Clear a past period out of the Scheduler's working queue without deleting
 * the history. The placement stays, marked discarded, so analytics can still
 * see that the task was undone then. The task is not cancelled.
 * A still-live assignment on that period rolls up to the coarser To Do list.
 */
export function dismissUndoneKeepHistory(
  task: Task,
  period: SchedulePlacementPeriod,
  value: string,
  now: Date = new Date(),
): Partial<Task> {
  const rolled = livePeriodMatches(task, period, value)
    ? (rollUpScheduleFieldsCascaded({ ...task, autoPush: false }, now) ?? clearedScheduleFields())
    : {}
  const placements = (rolled.schedulePlacements as SchedulePlacement[] | undefined) ?? task.schedulePlacements
  return {
    ...rolled,
    schedulePlacements: markSchedulePlacementResolved(placements, period, value, "discarded"),
  }
}

/** Record a triage decision on one placement. Other history stays. */
export function markSchedulePlacementResolved(
  existing: SchedulePlacement[] | undefined,
  period: SchedulePlacementPeriod,
  value: string,
  resolved: SchedulePlacementResolution,
): SchedulePlacement[] {
  const list = existing ?? []
  const index = list.findIndex((p) => p.period === period && placementValuesMatch(period, p.value, value))
  if (index === -1) return [...list, { period, value, resolved }]
  const next = list.slice()
  next[index] = { ...next[index], resolved }
  return next
}

/**
 * The next day / week / month that is still open. A step that would land in
 * the past jumps to the current period of that grain instead.
 */
export function nextOpenPeriodValue(
  period: Exclude<SchedulePlacementPeriod, "year">,
  refDate: Date,
  now: Date = new Date(),
): string {
  switch (period) {
    case "day": {
      const next = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() + 1)
      const key = formatLocalDateKey(next)
      return isPastFunnelPeriod("day", key, now) ? formatLocalDateKey(now) : key
    }
    case "week": {
      const range = parseWeekString(getWeekString(refDate))
      const start = range?.start ?? refDate
      const nextStart = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7)
      const key = getWeekString(nextStart)
      return isPastFunnelPeriod("week", key, now) ? getWeekString(now) : key
    }
    case "month": {
      const next = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 1)
      const key = formatLocalMonthKey(next)
      return isPastFunnelPeriod("month", key, now) ? formatLocalMonthKey(now) : key
    }
  }
}

/**
 * Keep the task on the coarser To Do list when it is still sitting on this
 * past period. The period stays Undone. Auto-push is ignored here so Assimilate
 * does not schedule the next day/week/month.
 */
export function assimilateUndoneFields(
  task: Task,
  period: SchedulePlacementPeriod,
  value: string,
  now: Date = new Date(),
): Partial<Task> {
  if (!livePeriodMatches(task, period, value)) return {}
  return rollUpScheduleFieldsCascaded({ ...task, autoPush: false }, now) ?? {}
}

/**
 * Schedule the task on the next open period of the same grain. The period it
 * is leaving stays Undone. One push, even when several periods are skipped
 * to reach a period that is still open.
 */
export function pushUndoneFields(
  task: Task,
  period: Exclude<SchedulePlacementPeriod, "year">,
  value: string,
  refDate: Date,
  now: Date = new Date(),
  missReason?: StoredBlockedReason,
): Partial<Task> {
  const destination = nextOpenPeriodValue(period, refDate, now)
  const counters: Partial<Task> =
    period === "day"
      ? { daysPushed: (task.daysPushed ?? 0) + 1 }
      : period === "week"
        ? { weeksPushed: (task.weeksPushed ?? 0) + 1 }
        : { monthsPushed: (task.monthsPushed ?? 0) + 1 }
  return {
    ...scheduleFieldsForPeriod(period, destination),
    ...counters,
    hiddenFromTodo: false,
    schedulePlacements: recordPushedPlacement(task.schedulePlacements, period, value, missReason),
  }
}

/**
 * Record an unresolved placement for each live assignment whose period has
 * already ended. Live fields stay, so the task is still where it was scheduled.
 */
export function recordUnresolvedPastPlacements(task: Task, now: Date = new Date()): Task {
  if (isClearedFromWork(task)) return task
  let placements = task.schedulePlacements
  const add = (period: SchedulePlacementPeriod, value: string | null | undefined) => {
    if (!value || !isPastFunnelPeriod(period, value, now)) return
    placements = appendSchedulePlacement(placements, { period, value })
  }
  if (task.scheduledDate) {
    const date = parseLocalDate(task.scheduledDate)
    if (date) add("day", formatLocalDateKey(date))
  }
  add("week", task.scheduledWeek)
  add("month", task.scheduledMonth)
  add("year", task.scheduledYear)
  if (placements === task.schedulePlacements) return task
  return { ...task, schedulePlacements: placements }
}

/** Leave a past year Undone and schedule the next year. */
export function pushYearUndoneFields(task: Task, value: string): Partial<Task> {
  const year = Number(value)
  const next = Number.isFinite(year) ? String(year + 1) : value
  return {
    ...scheduleFieldsForPeriod("year", next),
    schedulePlacements: recordPushedPlacement(task.schedulePlacements, "year", value),
  }
}

/** Cancel the task and clear its live schedule. The placement stays, resolved. */
export function discardUndoneFields(
  task: Task,
  period: SchedulePlacementPeriod,
  value: string,
): Partial<Task> {
  const cancelled = withStatus(task, "cancelled")
  return {
    ...clearedScheduleFields(),
    status: cancelled.status,
    completed: cancelled.completed,
    schedulePlacements: markSchedulePlacementResolved(task.schedulePlacements, period, value, "discarded"),
  }
}
