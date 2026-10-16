/**
 * lib/step-item-guard.ts — Is this a step's item? (Phase 11)
 *
 * No store imports, so the ledger, Scheduler, Lists and search can ask it
 * without pulling in the task store. `lib/step-items.ts` re-exports these.
 */
export type StepRef = { taskId: string; stepId: string }

/** True for a step's item. Pair with `isSessionOnly` once Phase 13 adds it. */
export function isStepItem(task: { stepOf?: StepRef | null } | null | undefined): boolean {
  return !!task?.stepOf
}

/** Drop step items from a list of tasks (lens, list, search, Scheduler). Same array when there are none. */
export function withoutStepItems<T extends { stepOf?: StepRef | null }>(tasks: readonly T[]): T[] {
  return tasks.some((t) => t.stepOf) ? tasks.filter((t) => !t.stepOf) : (tasks as T[])
}

/** A task cannot wait on its own step's item, nor a step's item on its parent (Phase 11 rule 8). */
export function isOwnStepOrParent(
  task: { id: string; stepOf?: StepRef | null },
  needs: { id: string; stepOf?: StepRef | null } | undefined,
): boolean {
  if (!needs) return false
  return needs.stepOf?.taskId === task.id || task.stepOf?.taskId === needs.id
}
