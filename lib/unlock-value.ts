/**
 * lib/unlock-value.ts — How much waits on a task (Phase 14 B, R19)
 *
 * The one unlock rule. Reads the `Task.dependencies` graph (the same one
 * `lib/critical-path.ts` and Available now read; loops are refused when a
 * link is made, and every walk here keeps a visited set anyway).
 *
 * - `waitingOn`: every open task waiting on this one, directly or through a
 *   chain, once each, at its shortest distance.
 * - `ownValue`: 0–1, the mean of normalized importance and urgency. A
 *   Required or Prioritized mark this period counts as 1.
 * - `unlockValue`: the sum of own values, faded by distance (1, 0.7, 0.49, …).
 * - `inheritedDue`: the earliest deadline of anything waiting, less the
 *   estimates in between along the longest chain. Never written to the task.
 *
 * Task-level only. The step half (`Subtask.dependsOn`) waits for slice N.
 * Pure.
 */
import type { Task } from "@/lib/types"
import { normalizePriorityInputs } from "@/lib/priority"
import { isClearedFromWork } from "@/lib/completion-status"
import { parseLocalDate } from "@/lib/date-utils"

/** Decision 12: each step further away counts 0.7 of the one before. */
export const UNLOCK_FADE = 0.7

export interface WaitingTask {
  task: Task
  /** 1 = waits on it directly. */
  distance: number
}

export interface UnlockOptions {
  /** Task ids with a Required or Prioritized mark this period. They count as 1. */
  markedIds?: ReadonlySet<string>
}

type Dependents = Map<string, Task[]>

/** Open tasks keyed by each id they list in `dependencies`. */
export function dependentsIndex(tasks: readonly Task[]): Dependents {
  const index: Dependents = new Map()
  for (const task of tasks) {
    if (isClearedFromWork(task)) continue
    for (const id of new Set(task.dependencies ?? [])) {
      if (id === task.id) continue
      const list = index.get(id)
      if (list) list.push(task)
      else index.set(id, [task])
    }
  }
  return index
}

/** Every open task waiting on `taskId`, once each, nearest first. */
export function waitingOn(taskId: string, tasks: readonly Task[], index: Dependents = dependentsIndex(tasks)): WaitingTask[] {
  const seen = new Set<string>([taskId])
  const out: WaitingTask[] = []
  let frontier = [taskId]
  for (let distance = 1; frontier.length; distance += 1) {
    const next: string[] = []
    for (const id of frontier) {
      for (const dep of index.get(id) ?? []) {
        if (seen.has(dep.id)) continue
        seen.add(dep.id)
        out.push({ task: dep, distance })
        next.push(dep.id)
      }
    }
    frontier = next
  }
  return out
}

/** A waiting task's own worth, 0–1. Missing fields read as defaults. */
export function ownValue(task: Task, opts: UnlockOptions = {}): number {
  if (opts.markedIds?.has(task.id)) return 1
  const n = normalizePriorityInputs(task)
  return (n.importance + n.urgency) / 2
}

const fade = (distance: number) => UNLOCK_FADE ** (distance - 1)

/** Sum of own values of everything waiting, faded by distance. 0 when nothing waits. */
export function unlockValue(
  taskId: string,
  tasks: readonly Task[],
  opts: UnlockOptions = {},
  index?: Dependents,
): number {
  return waitingOn(taskId, tasks, index).reduce((sum, w) => sum + ownValue(w.task, opts) * fade(w.distance), 0)
}

/** The Formula's fifth signal: 1 − 1/(1 + value). 0 when nothing waits. */
export function normalizeUnlockValue(value: number): number {
  return value > 0 ? 1 - 1 / (1 + value) : 0
}

export interface UnlockBreakdown {
  count: number
  value: number
  items: { id: string; name: string; own: number; distance: number; credit: number }[]
  /** "unlocks 3 · Release CD (0.9), Mix (0.6), Master (0.5 × 0.7)". Empty when nothing waits. */
  label: string
}

const round1 = (n: number) => Math.round(n * 10) / 10
const nameOf = (t: Task) => t.description?.trim() || "Untitled"

/** What is behind the number, for the hover and the Formula. */
export function unlockBreakdown(task: Pick<Task, "id">, tasks: readonly Task[], opts: UnlockOptions = {}): UnlockBreakdown {
  const items = waitingOn(task.id, tasks).map(({ task: w, distance }) => {
    const own = ownValue(w, opts)
    return { id: w.id, name: nameOf(w), own, distance, credit: own * fade(distance) }
  })
  const value = items.reduce((s, i) => s + i.credit, 0)
  const parts = items.map((i) => `${i.name} (${round1(i.own)}${i.distance > 1 ? ` × ${round1(fade(i.distance) * 100) / 100}` : ""})`)
  return {
    count: items.length,
    value,
    items,
    label: items.length ? `unlocks ${items.length} · ${parts.join(", ")}` : "",
  }
}

export interface InheritedDue {
  /** When this task must be done for the chain to make it. */
  due: Date
  /** The waiting task whose deadline set it. */
  forTask: Task
  overdue: boolean
}

const MINUTE = 60_000

function deadlineOf(task: Task): number | null {
  const d = parseLocalDate(task.deadline as Date | string | undefined)
  return d ? d.getTime() : null
}

/**
 * The earliest deadline of anything waiting on `taskId`, less the estimates
 * of the tasks in between (the waiting task included) along the longest
 * chain. Null when nothing waiting has a deadline. The task's own deadline is
 * not read and never written.
 */
export function inheritedDue(
  taskId: string,
  tasks: readonly Task[],
  now: Date = new Date(),
  index: Dependents = dependentsIndex(tasks),
): InheritedDue | null {
  // latest(X): when X must finish, from its own deadline and everything waiting on it.
  const memo = new Map<string, { at: number; source: Task } | null>()
  const visiting = new Set<string>()
  const latestStartOfDependents = (id: string): { at: number; source: Task } | null => {
    let best: { at: number; source: Task } | null = null
    for (const dep of index.get(id) ?? []) {
      const finish = latest(dep)
      if (!finish) continue
      const at = finish.at - (dep.estimatedDuration ?? 0) * MINUTE
      if (!best || at < best.at) best = { at, source: finish.source }
    }
    return best
  }
  const latest = (task: Task): { at: number; source: Task } | null => {
    if (memo.has(task.id)) return memo.get(task.id)!
    if (visiting.has(task.id)) return null
    visiting.add(task.id)
    const own = deadlineOf(task)
    let best: { at: number; source: Task } | null = own == null ? null : { at: own, source: task }
    const down = latestStartOfDependents(task.id)
    if (down && (!best || down.at < best.at)) best = down
    visiting.delete(task.id)
    memo.set(task.id, best)
    return best
  }
  visiting.add(taskId)
  const found = latestStartOfDependents(taskId)
  if (!found) return null
  return { due: new Date(found.at), forTask: found.source, overdue: found.at < now.getTime() }
}

/**
 * Urgency floor from a due date, 1–5, so an inherited deadline can raise
 * urgency (never lower it). Overdue or within a day → 5, three days → 4,
 * a week → 3; further out adds nothing.
 */
export function urgencyFloorForDue(due: Date, now: Date = new Date()): number {
  const days = (due.getTime() - now.getTime()) / (24 * 60 * MINUTE)
  if (days <= 1) return 5
  if (days <= 3) return 4
  if (days <= 7) return 3
  return 1
}

export interface UnlockContext {
  /** Raw unlock value (sum before normalizing). */
  unlocks: number
  inherited: InheritedDue | null
}

/**
 * Unlock value and inherited due date for every task in one pass. Tasks with
 * nothing waiting are left out, so a lookup miss means "score as before".
 */
export function unlockContextFor(
  tasks: readonly Task[],
  opts: UnlockOptions & { now?: Date } = {},
): Map<string, UnlockContext> {
  const index = dependentsIndex(tasks)
  const out = new Map<string, UnlockContext>()
  for (const id of index.keys()) {
    out.set(id, {
      unlocks: unlockValue(id, tasks, opts, index),
      inherited: inheritedDue(id, tasks, opts.now, index),
    })
  }
  return out
}
