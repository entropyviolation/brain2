/**
 * lib/step-points.ts — Pay step points on tick, take them back on untick (Phase 12, Decision 7)
 *
 * A step with `points` pays them when ticked, as `step:{taskId}:{stepId}` in
 * the points store, extra to the task's own points. Unticking (or deleting a
 * ticked step) removes that row from the day it was paid. Paid whether or not
 * **Points visible** is on (Decision 13): the switch only hides figures.
 * Called from the To Do steps write (`todo-panel` `handleSteps`), which the
 * lid and the task card share.
 */
import type { Subtask } from "@/lib/types"
import { usePointsStore } from "@/lib/points-store"
import { stepPointChanges, stepPointsKey } from "@/lib/task-card"

export function settleStepPoints(
  task: { id: string; description?: string },
  prev: readonly Subtask[] | undefined,
  next: readonly Subtask[] | undefined,
  now: Date = new Date(),
): void {
  const changes = stepPointChanges(prev, next)
  if (!changes.length) return
  const store = usePointsStore.getState()
  for (const { step, paid } of changes) {
    const key = stepPointsKey(task.id, step.id)
    if (paid) store.addPoints(key, step.points ?? 0, `${task.description ?? ""} › ${step.description}`, now)
    else store.removePointsForTask(key, step.completedAt ? new Date(step.completedAt) : now)
  }
}
