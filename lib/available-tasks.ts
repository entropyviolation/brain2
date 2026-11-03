/**
 * lib/available-tasks.ts — Unmet-dependency predicate
 *
 * Shared by Scheduler (`getAvailableTasks`) and To Do's Available-now filter.
 * A dependency is unmet only when the referenced task exists and is still
 * open work. Done and missed opportunities do not block. Missing ids do not
 * block (same as the Scheduler funnel).
 *
 * A parent with no `dependencyCombine` keeps that rule exactly. A set mode
 * asks `lib/graph/dependency-combine.ts` instead. Scheduler edges stay on
 * `dependencies`.
 */
import type { Task } from "@/lib/types"
import { isClearedFromWork } from "@/lib/completion-status"
import { combineSatisfied } from "@/lib/graph/dependency-combine"

export type DepTask = Pick<Task, "id" | "completed" | "status">
export type DepOwner = Pick<Task, "dependencies" | "dependencyCombine" | "links" | "title"> & {
  id?: string
  description?: string
}

/** True when any listed dependency still exists and is incomplete / not missed. */
export function hasUnmetDependencies(task: DepOwner, allTasks: readonly DepTask[]): boolean {
  if (!task.dependencyCombine) {
    return (task.dependencies ?? []).some((depId) => {
      const depTask = allTasks.find((t) => t.id === depId)
      return Boolean(depTask && !isClearedFromWork(depTask))
    })
  }
  const children = (task.dependencies ?? []).flatMap((depId) => {
    const depTask = allTasks.find((t) => t.id === depId)
    return depTask ? [depTask] : []
  })
  return !combineSatisfied(task, children)
}

/** Available-now = no unmet dependencies. Does not inspect completion status. */
export function isAvailableNow(task: DepOwner, allTasks: readonly DepTask[]): boolean {
  return !hasUnmetDependencies(task, allTasks)
}
