/**
 * lib/step-points.ts — Pay step points on tick, take them back on untick (Phase 12, Decision 7)
 *
 * A step with `points` (else the nearest `stepPoints` above it) pays them when ticked, as `step:{taskId}:{stepId}` in
 * the points store, extra to the task's own points. Unticking (or deleting a
 * ticked step) removes that row from the day it was paid. Paid whether or not
 * **Points visible** is on (Decision 13): the switch only hides figures.
 * A step with `tierPoints` pays by level instead: each level it reaches
 * (done to that level's view) pays once, keyed `…:{tier}`; falling back takes it.
 * Called from the To Do steps write (`todo-panel` `handleSteps`), which the
 * lid and the task card share.
 */
import type { Subtask } from "@/lib/types"
import { usePointsStore } from "@/lib/points-store"
import { hasTierPoints, stepPointChanges, stepPointsKey } from "@/lib/task-card"
import { STEP_TIERS, stepsForTier } from "@/lib/step-tiers"
import { doneToView } from "@/lib/step-progress"
import { flattenSteps } from "@/lib/todo-steps"

export function settleStepPoints(
  task: { id: string; description?: string; stepPoints?: number },
  prev: readonly Subtask[] | undefined,
  next: readonly Subtask[] | undefined,
  now: Date = new Date(),
): void {
  const changes = stepPointChanges(prev, next, task.stepPoints)
  if (!changes.length) return
  const store = usePointsStore.getState()
  for (const { step, paid } of changes) {
    const key = stepPointsKey(task.id, step.id)
    if (paid) store.addPoints(key, step.points ?? 0, `${task.description ?? ""} › ${step.description}`, now)
    else store.removePointsForTask(key, step.completedAt ? new Date(step.completedAt) : now)
  }
  for (const { step, tier, paid } of tierPointChanges(prev, next)) {
    const key = `${stepPointsKey(task.id, step.id)}:${tier}`
    if (paid) store.addPoints(key, step.tierPoints?.[tier] ?? 0, `${task.description ?? ""} › ${step.description} (${tier})`, now)
    else store.removePointsForTask(key, now)
  }
}

/** Levels reached or lost by steps that pay by level. */
export function tierPointChanges(prev: readonly Subtask[] | undefined, next: readonly Subtask[] | undefined) {
  const out: { step: Subtask; tier: (typeof STEP_TIERS)[number]; paid: boolean }[] = []
  const before = new Map(flattenSteps(prev).map((s) => [s.id, s]))
  const after = new Map(flattenSteps(next).map((s) => [s.id, s]))
  const ids = new Set([...before.keys(), ...after.keys()].filter((id) => hasTierPoints(before.get(id)) || hasTierPoints(after.get(id))))
  if (!ids.size) return out
  for (const tier of STEP_TIERS) {
    const vPrev = stepsForTier(prev ?? [], tier)
    const vNext = stepsForTier(next ?? [], tier)
    for (const id of ids) {
      const was = before.get(id)
      const now = after.get(id)
      const step = (now ?? was)!
      if (!((step.tierPoints?.[tier] ?? was?.tierPoints?.[tier] ?? 0) > 0)) continue
      const a = !!was && doneToView(was, vPrev)
      const b = !!now && doneToView(now, vNext)
      if (a !== b) out.push({ step: b ? step : { ...step, tierPoints: { ...was?.tierPoints, ...step.tierPoints } }, tier, paid: b })
    }
  }
  return out
}
