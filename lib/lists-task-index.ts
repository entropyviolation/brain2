/**
 * lib/lists-task-index.ts — Single-pass task indexes for Lists views
 *
 * Cards (especially All) used to filter the full task array once per list per
 * render. This builds list→tasks / completion / smart-list buckets in one pass
 * and reuses previous array references when a list's membership did not change,
 * so memoized cards can skip work.
 */
import type { Task } from "@/lib/types"
import {
  getWeekString,
  taskScheduledOnDay,
  taskScheduledInMonth,
  taskScheduledInWeek,
} from "@/lib/date-utils"
import type { SmartId } from "@/components/Lists/types"

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
  const week = getWeekString(now)
  const month = now.toISOString().slice(0, 7)
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
        if (!task.completed) {
          const bucket = activeByList.get(id)
          if (bucket) bucket.push(task)
          else activeByList.set(id, [task])
        }
      }
    }
    if (task.completed) continue
    activeCount += 1
    if (taskScheduledOnDay(task, now)) daily.push(task)
    if (taskScheduledInWeek(task, week)) weekly.push(task)
    if (taskScheduledInMonth(task, month)) monthly.push(task)
  }

  if (prev) {
    for (const [id, arr] of activeByList) {
      const kept = reuse(prev.activeByList.get(id), arr)
      if (kept !== arr) activeByList.set(id, kept)
    }
  }

  return {
    activeByList,
    totalsByList,
    smartById: {
      daily: reuse(prev?.smartById.daily, daily),
      weekly: reuse(prev?.smartById.weekly, weekly),
      monthly: reuse(prev?.smartById.monthly, monthly),
    },
    activeCount,
  }
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
