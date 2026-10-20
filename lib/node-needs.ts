/**
 * lib/node-needs.ts — What a step (or task) waits on beyond its own tree
 *
 * Three kinds, all optional on `Subtask` and `Task`:
 * - **Tasks first** (`needsTaskIds`, a task's `dependencies`): open until ticked.
 * - **Resources** (`resourceIds`): items or `list:{id}`. Reference only, never lock.
 * - **Awaiting** (`awaitIds`): `event` items. Happened once logged (ticked) or
 *   once their scheduled date has passed. Until then the node is locked.
 *
 * Pure.
 */
import type { Subtask, Task } from "@/lib/types"

type Lookup = (id: string) => Pick<Task, "completed" | "scheduledDate"> | undefined

export const LIST_REF = "list:"

export function eventHappened(item: Pick<Task, "completed" | "scheduledDate"> | undefined, now: Date = new Date()): boolean {
  if (!item) return true // missing never blocks
  if (item.completed) return true
  return !!item.scheduledDate && new Date(item.scheduledDate).getTime() <= now.getTime()
}

/** Ids this node still waits on outside its tree: open tasks and unhappened events. */
export function externalWaits(node: Pick<Subtask, "needsTaskIds" | "awaitIds"> & { dependencies?: string[] }, find: Lookup, now: Date = new Date()): string[] {
  const tasks = [...(node.needsTaskIds ?? []), ...(node.dependencies ?? [])].filter((id) => {
    const t = find(id)
    return !!t && !t.completed
  })
  const events = (node.awaitIds ?? []).filter((id) => !eventHappened(find(id), now))
  return [...tasks, ...events]
}

/** Every need on a node, counted: own-tree steps, tasks, resources, events. */
export function needCount(step: Subtask): number {
  return (step.dependsOn?.length ?? 0) + (step.needsTaskIds?.length ?? 0) + (step.resourceIds?.length ?? 0) + (step.awaitIds?.length ?? 0)
}

/** The tree with one step's fields replaced (`undefined` deletes). */
export function patchStep(steps: readonly Subtask[] | undefined, id: string, patch: Partial<Subtask>): Subtask[] {
  return (steps ?? []).map((step) => {
    if (step.id === id) {
      const next = { ...step, ...patch } as Subtask & Record<string, unknown>
      for (const [k, v] of Object.entries(patch)) if (v === undefined) delete next[k]
      return next
    }
    return step.subtasks?.length ? { ...step, subtasks: patchStep(step.subtasks, id, patch) } : step
  })
}

/** Toggle one id in an optional id list; an emptied list becomes `undefined`. */
export function toggleId(list: readonly string[] | undefined, id: string): string[] | undefined {
  const cur = list ?? []
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]
  return next.length ? next : undefined
}
