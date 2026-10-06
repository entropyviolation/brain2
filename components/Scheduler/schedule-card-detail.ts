/**
 * components/Scheduler/schedule-card-detail.ts — Schedule Card Detail rows
 *
 * One period card, opened full width: tasks sitting at this grain, tasks
 * assigned to a finer period inside it, and Undone work that is still open
 * to push, dismiss, or finish. A pushed or discarded placement leaves this
 * working queue and stays on the task for analytics.
 */
import {
  formatLocalDateKey,
  formatLocalMonthKey,
  parseLocalDate,
  parseWeekString,
  sameWeekKey,
  taskScheduledOnDay,
} from "@/lib/date-utils"
import { isClearedFromWork, withCompleted } from "@/lib/completion-status"
import { getStoredScheduleLevel } from "@/lib/item-utils"
import {
  clearedScheduleFields,
  isPastFunnelPeriod,
  markSchedulePlacementResolved,
  pushUndoneFields,
  pushYearUndoneFields,
} from "@/lib/scheduling"
import type { SchedulePeriod, SchedulePlacement, SchedulePlacementPeriod, Task } from "@/lib/types"
import { getTasksForPeriod } from "./scheduler-utils"

const RANK: Record<SchedulePlacementPeriod, number> = { year: 1, month: 2, week: 3, day: 4 }

export interface ScheduleCardDetailTarget {
  title: string
  detail?: string
  /** `eventually` is the hold list with no period. */
  period: SchedulePlacementPeriod | "eventually"
  value: string
  /** Sidebar the task returns to. `always` means the unscheduled inbox. */
  parent: SchedulePeriod
  parentValue?: string
}

export interface CardDetailRows {
  here: Task[]
  finer: Task[]
  undone: Task[]
  past: boolean
}

function weekTouchesMonth(value: string, monthKey: string): boolean {
  const range = parseWeekString(value)
  if (!range) return false
  return formatLocalMonthKey(range.start) === monthKey || formatLocalMonthKey(range.end) === monthKey
}

function weekTouchesYear(value: string, year: string): boolean {
  const range = parseWeekString(value)
  if (!range) return value.includes(year)
  return String(range.start.getFullYear()) === year || String(range.end.getFullYear()) === year
}

function dayInWeek(day: string, week: string): boolean {
  const date = parseLocalDate(day)
  const range = parseWeekString(week)
  if (!date || !range) return false
  const time = date.getTime()
  return time >= range.start.getTime() && time <= range.end.getTime()
}

/** A recorded or live period sits inside this card (the card itself counts). */
export function periodFallsInCard(
  period: SchedulePlacementPeriod,
  value: string,
  card: SchedulePlacementPeriod,
  cardValue: string,
): boolean {
  if (period === card && (card === "week" ? sameWeekKey(value, cardValue) : value === cardValue)) return true
  if (RANK[period] <= RANK[card]) return false
  switch (card) {
    case "year":
      if (period === "month") return value.startsWith(`${cardValue}-`)
      if (period === "week") return weekTouchesYear(value, cardValue)
      return value.startsWith(`${cardValue}-`)
    case "month":
      if (period === "week") return weekTouchesMonth(value, cardValue)
      if (period === "day") {
        const date = parseLocalDate(value)
        return !!date && formatLocalMonthKey(date) === cardValue
      }
      return false
    case "week":
      return period === "day" && dayInWeek(value, cardValue)
    default:
      return false
  }
}

function liveMatchesCard(task: Task, card: SchedulePlacementPeriod, value: string): boolean {
  const level = getStoredScheduleLevel(task)
  if (level !== card) return false
  switch (card) {
    case "day":
      return taskScheduledOnDay(task, value)
    case "week":
      return !!task.scheduledWeek && sameWeekKey(task.scheduledWeek, value)
    case "month":
      return task.scheduledMonth === value
    case "year":
      return task.scheduledYear === value
  }
}

function liveFallsInCard(task: Task, card: SchedulePlacementPeriod, value: string): boolean {
  const level = getStoredScheduleLevel(task)
  if (!level) return false
  switch (level) {
    case "day": {
      const date = parseLocalDate(task.scheduledDate)
      const key = date ? formatLocalDateKey(date) : ""
      return !!key && periodFallsInCard("day", key, card, value)
    }
    case "week":
      return !!task.scheduledWeek && periodFallsInCard("week", task.scheduledWeek, card, value)
    case "month":
      return !!task.scheduledMonth && periodFallsInCard("month", task.scheduledMonth, card, value)
    case "year":
      return !!task.scheduledYear && periodFallsInCard("year", task.scheduledYear, card, value)
  }
}

function openPlacement(placement: SchedulePlacement): boolean {
  return placement.resolved == null
}

function hasOpenPlacementInCard(task: Task, card: SchedulePlacementPeriod, value: string, now: Date): boolean {
  return (task.schedulePlacements ?? []).some((placement) => {
    if (!openPlacement(placement)) return false
    if (!isPastFunnelPeriod(placement.period, placement.value, now)) return false
    return periodFallsInCard(placement.period, placement.value, card, value)
  })
}

/**
 * Rows for one card. A past card is the same Undone queue as that funnel cell,
 * plus an open finer placement inside the span.
 * A current card also lists work at this grain and work assigned finer.
 */
export function partitionCardDetail(
  tasks: Task[],
  card: SchedulePlacementPeriod,
  value: string,
  now: Date = new Date(),
): CardDetailRows {
  const past = isPastFunnelPeriod(card, value, now)
  const here: Task[] = []
  const finer: Task[] = []
  const undone: Task[] = []

  if (past) {
    const queued = getTasksForPeriod(tasks, card, value, now, now)
    const seen = new Set(queued.map((task) => task.id))
    undone.push(...queued)
    for (const task of tasks) {
      if (seen.has(task.id) || isClearedFromWork(task)) continue
      if (!hasOpenPlacementInCard(task, card, value, now)) continue
      seen.add(task.id)
      undone.push(task)
    }
    return { here, finer, undone, past }
  }

  for (const task of tasks) {
    if (isClearedFromWork(task)) continue
    const level = getStoredScheduleLevel(task)
    const atGrain = liveMatchesCard(task, card, value)
    const inside = liveFallsInCard(task, card, value)
    const finerLive = !!level && RANK[level] > RANK[card] && inside
    const waiting = hasOpenPlacementInCard(task, card, value, now)

    if (atGrain) {
      here.push(task)
      continue
    }
    if (finerLive) {
      finer.push(task)
      continue
    }
    if (waiting) undone.push(task)
  }

  return { here, finer, undone, past }
}

function periodRefDate(period: SchedulePlacementPeriod, value: string): Date {
  if (period === "day") return parseLocalDate(value) ?? new Date()
  if (period === "week") return parseWeekString(value)?.start ?? new Date()
  if (period === "month") {
    const [year, month] = value.split("-").map(Number)
    return new Date(year, (month || 1) - 1, 1)
  }
  return new Date(Number(value), 0, 1)
}

function markOpenPlacementsInCard(
  placements: SchedulePlacement[] | undefined,
  card: SchedulePlacementPeriod,
  value: string,
  resolved: "pushed" | "clarified",
  now: Date,
): SchedulePlacement[] {
  let next = markSchedulePlacementResolved(placements, card, value, resolved)
  for (const placement of [...next]) {
    if (placement.resolved) continue
    if (!isPastFunnelPeriod(placement.period, placement.value, now)) continue
    const insideCard = periodFallsInCard(placement.period, placement.value, card, value)
    const coversCard = periodFallsInCard(card, value, placement.period, placement.value)
    if (!insideCard && !coversCard) continue
    next = markSchedulePlacementResolved(next, placement.period, placement.value, resolved)
  }
  return next
}

/** Noon on the last calendar day of the period, so Done lands inside it. */
export function completionInstantForPeriod(period: SchedulePlacementPeriod, value: string): Date {
  if (period === "day") {
    const date = parseLocalDate(value) ?? new Date()
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
  }
  if (period === "week") {
    const end = parseLocalDate(value.split("_")[1] ?? "") ?? parseWeekString(value)?.end ?? new Date()
    return new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12)
  }
  if (period === "month") {
    const [year, month] = value.split("-").map(Number)
    const last = new Date(year, month || 1, 0)
    return new Date(last.getFullYear(), last.getMonth(), last.getDate(), 12)
  }
  const year = Number(value)
  return new Date(Number.isFinite(year) ? year : new Date().getFullYear(), 11, 31, 12)
}

/**
 * Schedule the next period of this card and clear its working queue.
 * Child placements inside the card are marked pushed too. They stay on the
 * task, and Home → To Do Undone still lists them.
 */
export function pushCardWorkingQueue(
  task: Task,
  card: SchedulePlacementPeriod,
  value: string,
  now: Date = new Date(),
): Partial<Task> {
  const stepped =
    card === "year"
      ? pushYearUndoneFields(task, value)
      : pushUndoneFields(task, card, value, periodRefDate(card, value), now)
  return {
    ...stepped,
    schedulePlacements: markOpenPlacementsInCard(stepped.schedulePlacements, card, value, "pushed", now),
  }
}

/**
 * Leave this card's Scheduler queue. The placement stays, marked clarified, so
 * the period remains on the Undone list and the live assignment is kept.
 */
export function dismissCardWorkingQueue(
  task: Task,
  card: SchedulePlacementPeriod,
  value: string,
  now: Date = new Date(),
): Partial<Task> {
  return {
    schedulePlacements: markOpenPlacementsInCard(task.schedulePlacements, card, value, "clarified", now),
  }
}

/**
 * Send the task back to Always. This period stays on the Undone list, marked
 * clarified, so the Scheduler queue no longer asks about it.
 */
export function unscheduleCardWorkingQueue(
  task: Task,
  card: SchedulePlacementPeriod,
  value: string,
  now: Date = new Date(),
): Partial<Task> {
  return {
    ...clearedScheduleFields(),
    schedulePlacements: markOpenPlacementsInCard(task.schedulePlacements, card, value, "clarified", now),
  }
}

/**
 * Finish the task inside the period it was assigned to. That is the one action
 * that takes it off the period's Undone list.
 */
export function finishCardInPeriod(task: Task, card: SchedulePlacementPeriod, value: string): Partial<Task> {
  const completedDate = completionInstantForPeriod(card, value)
  const completed = withCompleted({ ...task, completedDate }, true)
  return { ...completed, stage: "completed", completedDate }
}
