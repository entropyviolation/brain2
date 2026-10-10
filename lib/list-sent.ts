/**
 * lib/list-sent.ts — Sent-on-a-list completion
 *
 * One formula, for whatever period range the caller passes (a week, a month,
 * a season, or a day). No second formula.
 *
 *   sent  = items marked sent on this list with sentAt inside [start, end)
 *   unsent = items still on the list that have not been marked sent
 *   total = unsent + sent
 *   raw percent = total === 0 ? 0 : sent / total * 100
 *
 * An item sent outside the range is in neither bucket. That is how a send
 * from last week stays out of this week's total, even before the weekly
 * clear takes it off the list. A send inside the range still counts after
 * it leaves the list, so a week boundary does not erase this period's sends.
 *
 * Reported percent = min(100, raw / grace * 100). Grace is a percent.
 * Missing or invalid grace is 100, which leaves the raw percent. Grace 80
 * turns raw 80 into 100 and raw 40 into 50.
 *
 * Weekly clear removes last week's sent items from lists that opted in.
 * It does not delete the item, does not clear unsent items, and does not
 * clear a send that is still inside the current week.
 */
import { getWeekStartDate } from "./date-utils"
import { quarterStartDate, shiftQuarter } from "./seasons"
import type { HabitFrequency, Task, TaskCompletion, WeeklyTask } from "./types"

export const DEFAULT_LIST_SENT_GRACE = 100

export interface ListSentMembership {
  lists?: readonly string[] | null
  sentAtByList?: Readonly<Record<string, string>> | null
}

export function clampListSentGrace(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return DEFAULT_LIST_SENT_GRACE
  return Math.min(100, Math.max(1, Math.round(n)))
}

/** Milliseconds of the sent mark on `listId`, or null when the item is not sent there. */
export function sentInstant(item: ListSentMembership, listId: string): number | null {
  const raw = item.sentAtByList?.[listId]
  if (typeof raw !== "string" || !raw) return null
  const at = Date.parse(raw)
  return Number.isFinite(at) ? at : null
}

export function isSentOnList(item: ListSentMembership, listId: string): boolean {
  return sentInstant(item, listId) !== null
}

/** Hide sent rows unless Show sent is on. Unsent rows always stay. */
export function visibleListItems<T extends ListSentMembership>(
  items: readonly T[],
  listId: string,
  showSent: boolean,
): T[] {
  if (showSent) return [...items]
  return items.filter((item) => !isSentOnList(item, listId))
}

/**
 * Inclusive start, exclusive end. Week is Monday 00:00 through next Monday.
 * Month is the civil month. Season is the calendar quarter. Day is the local day.
 */
export function currentPeriodRange(
  frequency: HabitFrequency | undefined,
  now: Date,
): { start: Date; end: Date } {
  const freq = frequency || "daily"
  if (freq === "weekly") {
    const start = getWeekStartDate(now)
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    return { start, end }
  }
  if (freq === "monthly") {
    const start = new Date(now.getFullYear(), now.getMonth(), 1)
    start.setHours(0, 0, 0, 0)
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    end.setHours(0, 0, 0, 0)
    return { start, end }
  }
  if (freq === "quarterly") {
    const start = quarterStartDate(now)
    start.setHours(0, 0, 0, 0)
    const end = shiftQuarter(now, 1)
    end.setHours(0, 0, 0, 0)
    return { start, end }
  }
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

export interface ListSentCounts {
  sent: number
  unsent: number
  total: number
  rawPercent: number
}

/** The one completion ratio. `range.end` is exclusive. */
export function listSentCompletion(
  items: readonly ListSentMembership[],
  listId: string,
  range: { start: Date; end: Date },
): ListSentCounts {
  const start = range.start.getTime()
  const end = range.end.getTime()
  let sent = 0
  let unsent = 0
  for (const item of items) {
    const at = sentInstant(item, listId)
    if (at !== null && at >= start && at < end) {
      sent += 1
      continue
    }
    if ((item.lists ?? []).includes(listId) && at === null) unsent += 1
  }
  const total = sent + unsent
  const rawPercent = total === 0 ? 0 : (sent / total) * 100
  return { sent, unsent, total, rawPercent }
}

/** min(100, rawPercent / grace * 100). Grace 100 leaves the raw percent. */
export function reportedListSentPercent(rawPercent: number, grace: unknown): number {
  const g = clampListSentGrace(grace)
  const raw = Number.isFinite(rawPercent) ? rawPercent : 0
  return Math.min(100, (raw / g) * 100)
}

/**
 * Drop list membership for sends that belong to a previous week.
 * The item stays. The sent timestamp stays, so this period can still count it.
 * Unsent items and sends from the current week stay on the list.
 */
export function membershipAfterWeeklySentClear<T extends ListSentMembership>(
  items: readonly T[],
  sentListIds: ReadonlySet<string>,
  now: Date,
): T[] {
  if (sentListIds.size === 0) return items as T[]
  const weekStart = getWeekStartDate(now).getTime()
  let changed = false
  const next = items.map((item) => {
    const lists = item.lists ?? []
    if (lists.length === 0) return item
    const keep = lists.filter((id) => {
      if (!sentListIds.has(id)) return true
      const at = sentInstant(item, id)
      if (at === null || at >= weekStart) return true
      return false
    })
    if (keep.length === lists.length) return item
    changed = true
    return { ...item, lists: [...keep] }
  })
  return changed ? next : (items as T[])
}

function otherAutoOwnsValue(completion: TaskCompletion | undefined): boolean {
  if (!completion) return false
  return (
    completion.trackedValue !== undefined ||
    completion.trackedCompleted !== undefined ||
    completion.coverageCompleted !== undefined ||
    completion.habitSumValue !== undefined ||
    completion.taggedTaskCount !== undefined ||
    completion.dailyCompletionAverage !== undefined ||
    completion.keywordLogged === true ||
    completion.sleepCompleted !== undefined ||
    completion.listCompleted !== undefined ||
    completion.dailyFloorCompleted !== undefined
  )
}

/**
 * Store the grace-adjusted percent on the period cell.
 * A hand-typed cell keeps its number and only records `listSentPercent`.
 */
export function applyListSentPercent(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  reported: number,
): TaskCompletion | null {
  const handOwned = completion?.handCompleted !== undefined || completion?.manualValue !== undefined
  if (handOwned || otherAutoOwnsValue(completion)) {
    if (completion?.listSentPercent === reported) return null
    return { ...(completion ?? {}), listSentPercent: reported }
  }
  const goal = task.goal ?? completion?.goal
  if (
    completion?.listSentPercent === reported &&
    completion?.value === reported &&
    completion?.goal === goal
  ) {
    return null
  }
  return { ...(completion ?? {}), listSentPercent: reported, value: reported, goal }
}

/**
 * List length stores the count and the list size, not the percent.
 * `reported` is still the grace-scaled percent, kept on `listSentPercent`.
 * A hand-typed cell, or another auto source, keeps its number.
 */
export function applyListLengthCount(
  completion: TaskCompletion | undefined,
  current: number,
  target: number,
  reported: number,
): TaskCompletion | null {
  const handOwned = completion?.handCompleted !== undefined || completion?.manualValue !== undefined
  if (handOwned || otherAutoOwnsValue(completion)) {
    if (completion?.listSentPercent === reported && completion?.goal === target) return null
    return { ...(completion ?? {}), listSentPercent: reported, goal: target }
  }
  if (
    completion?.listSentPercent === reported &&
    completion?.value === current &&
    completion?.goal === target
  ) {
    return null
  }
  return { ...(completion ?? {}), listSentPercent: reported, value: current, goal: target }
}

export function listOptsIntoSent(list: { sentThisWeek?: boolean } | null | undefined): boolean {
  return list?.sentThisWeek === true
}

/** Mark or clear sent on every opted-in list the item currently belongs to. */
export function withSentMark(task: Task, listIds: readonly string[], sent: boolean, at: Date): Task {
  const sentAtByList = { ...(task.sentAtByList ?? {}) }
  const stamp = at.toISOString()
  for (const id of listIds) {
    if (sent) sentAtByList[id] = stamp
    else delete sentAtByList[id]
  }
  const next: Task = { ...task }
  if (Object.keys(sentAtByList).length) next.sentAtByList = sentAtByList
  else delete next.sentAtByList
  return next
}
