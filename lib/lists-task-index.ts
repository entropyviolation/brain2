/**
 * lib/lists-task-index.ts — Single-pass task indexes for Lists views
 *
 * Cards (especially All) used to filter the full task array once per list per
 * render. This builds list→tasks / completion / smart-list buckets in one pass
 * and reuses previous array references when a list's membership did not change,
 * so memoized cards can skip work. When every list array and every smart-list
 * array was reused (and the totals and active count match), the previous index
 * object itself is returned.
 */
import type { Task } from "@/lib/types"
import {
  formatLocalMonthKey,
  getWeekString,
  taskScheduledOnDay,
  taskScheduledInMonth,
  taskScheduledInWeek,
} from "@/lib/date-utils"
import { quarterKey, taskTouchesQuarter } from "@/lib/seasons"
import type { SmartId } from "@/components/Lists/types"
import { isClearedFromWork } from "@/lib/completion-status"

export const EMPTY_TASKS: Task[] = []

export interface ListsTaskIndex {
  activeByList: Map<string, Task[]>
  totalsByList: Map<string, { total: number; completed: number }>
  smartById: Record<SmartId, Task[]>
  activeCount: number
}

function sameRefs<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

function reuse<T>(prev: T[] | undefined, next: T[]): T[] {
  return prev && sameRefs(prev, next) ? prev : next
}

export function buildListsTaskIndex(
  tasks: Task[],
  prev?: ListsTaskIndex | null,
  now = new Date(),
): ListsTaskIndex {
  const activeByList = new Map<string, Task[]>()
  const totalsByList = new Map<string, { total: number; completed: number }>()
  const daily: Task[] = []
  const weekly: Task[] = []
  const monthly: Task[] = []
  const quarterly: Task[] = []
  const week = getWeekString(now)
  const month = formatLocalMonthKey(now)
  const quarter = quarterKey(now)
  let activeCount = 0

  for (const task of tasks) {
    const listIds = task.lists
    if (listIds) {
      for (const id of listIds) {
        const totals = totalsByList.get(id)
        if (totals) {
          totals.total += 1
          if (task.completed) totals.completed += 1
        } else {
          totalsByList.set(id, { total: 1, completed: task.completed ? 1 : 0 })
        }
        if (!isClearedFromWork(task)) {
          const bucket = activeByList.get(id)
          if (bucket) bucket.push(task)
          else activeByList.set(id, [task])
        }
      }
    }
    if (isClearedFromWork(task)) continue
    activeCount += 1
    if (taskScheduledOnDay(task, now)) daily.push(task)
    if (taskScheduledInWeek(task, week)) weekly.push(task)
    if (taskScheduledInMonth(task, month)) monthly.push(task)
    if (taskTouchesQuarter(task, quarter)) quarterly.push(task)
  }

  let everyListReused = prev != null && activeByList.size === prev.activeByList.size
  if (prev) {
    for (const [id, arr] of activeByList) {
      const kept = reuse(prev.activeByList.get(id), arr)
      if (kept !== arr) activeByList.set(id, kept)
      else everyListReused = false
    }
  }

  const smartById = {
    daily: reuse(prev?.smartById.daily, daily),
    weekly: reuse(prev?.smartById.weekly, weekly),
    monthly: reuse(prev?.smartById.monthly, monthly),
    quarterly: reuse(prev?.smartById.quarterly, quarterly),
  }
  const everySmartReused =
    !!prev &&
    smartById.daily === prev.smartById.daily &&
    smartById.weekly === prev.smartById.weekly &&
    smartById.monthly === prev.smartById.monthly &&
    smartById.quarterly === prev.smartById.quarterly

  if (
    prev &&
    everyListReused &&
    everySmartReused &&
    activeCount === prev.activeCount &&
    sameTotals(totalsByList, prev.totalsByList)
  ) {
    return prev
  }

  return { activeByList, totalsByList, smartById, activeCount }
}

function sameTotals(
  next: Map<string, { total: number; completed: number }>,
  prev: Map<string, { total: number; completed: number }>,
): boolean {
  if (next.size !== prev.size) return false
  for (const [id, row] of next) {
    const kept = prev.get(id)
    if (!kept || kept.total !== row.total || kept.completed !== row.completed) return false
  }
  return true
}

export function tasksForList(index: ListsTaskIndex, listId: string): Task[] {
  return index.activeByList.get(listId) ?? EMPTY_TASKS
}

export function completionRateForList(index: ListsTaskIndex, listId: string): number {
  const totals = index.totalsByList.get(listId)
  if (!totals || totals.total === 0) return 0
  return Math.round((totals.completed / totals.total) * 100)
}

export function smartTasksFor(index: ListsTaskIndex, id: SmartId): Task[] {
  return index.smartById[id] ?? EMPTY_TASKS
}
