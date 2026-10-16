/**
 * lib/prereqs.ts — Marking what has to happen first
 *
 * Two kinds of prerequisite, one vocabulary:
 * - a **step** waits on other steps of the same task (`Subtask.dependsOn`);
 * - a **task** waits on other tasks (`Task.dependencies`, the field Scheduler,
 *   Available now and the critical path already read).
 *
 * Both refuse a loop. Step loops (and family: a step cannot wait on its own
 * ancestor or descendant) are refused by `blockerCandidates`; task loops by
 * `findCyclePath`, the same check item detail uses. Pure.
 */
import type { Subtask, Task } from "@/lib/types"
import { findCyclePath } from "@/lib/critical-path"
import { hasUnmetDependencies, type DepTask } from "@/lib/available-tasks"
import { isClearedFromWork } from "@/lib/completion-status"
import { blockerCandidates, findPlacedStep, openBlockers, placeSteps, setStepDependsOn } from "@/lib/next-step"

/** Open steps this step is waiting on (its own and its ancestors'). */
export function stepBlockers(steps: readonly Subtask[] | undefined, stepId: string): Subtask[] {
  const placed = findPlacedStep(steps, stepId)
  if (!placed) return []
  const byId = new Map(placeSteps(steps).map((p) => [p.step.id, p.step]))
  return openBlockers(placed, byId)
}

/** True when nothing this step waits on is still open. */
export function isStepAvailable(steps: readonly Subtask[] | undefined, stepId: string): boolean {
  return stepBlockers(steps, stepId).length === 0
}

/** Ids `stepId` may be made to wait on (open, not family, no loop). */
export function stepPrereqChoices(steps: readonly Subtask[] | undefined, stepId: string): Set<string> {
  return new Set(blockerCandidates(steps, stepId).map((p) => p.step.id))
}

/**
 * Add or remove one step prerequisite. Adding something that is not a valid
 * choice (a loop, family, a done step) leaves the tree as it was.
 */
export function toggleStepPrereq(steps: readonly Subtask[] | undefined, stepId: string, needsId: string): Subtask[] {
  const step = findPlacedStep(steps, stepId)?.step
  if (!step) return [...(steps ?? [])]
  const current = step.dependsOn ?? []
  if (current.includes(needsId)) return setStepDependsOn(steps, stepId, current.filter((id) => id !== needsId))
  if (!stepPrereqChoices(steps, stepId).has(needsId)) return [...(steps ?? [])]
  return setStepDependsOn(steps, stepId, [...current, needsId])
}

export type TaskPrereqResult = { ok: true; dependencies: string[] } | { ok: false; loop: string[] }

/** Make `task` wait on `needsId`, unless that closes a loop. */
export function addTaskPrereq(task: Task, needsId: string, allTasks: readonly Task[]): TaskPrereqResult {
  const current = task.dependencies ?? []
  if (current.includes(needsId)) return { ok: true, dependencies: current }
  const loop = findCyclePath([...allTasks], task.id, needsId)
  if (loop.length) return { ok: false, loop }
  return { ok: true, dependencies: [...current, needsId] }
}

export function removeTaskPrereq(task: Task, needsId: string): string[] {
  return (task.dependencies ?? []).filter((id) => id !== needsId)
}

/** Tasks this one still waits on: listed, existing, and open. */
export function openTaskBlockers(task: Pick<Task, "dependencies">, allTasks: readonly Task[]): Task[] {
  return (task.dependencies ?? [])
    .map((id) => allTasks.find((t) => t.id === id))
    .filter((t): t is Task => !!t && !isClearedFromWork(t))
}

/** Same predicate as Available now. */
export function isTaskBlocked(task: Pick<Task, "dependencies">, allTasks: readonly DepTask[]): boolean {
  return hasUnmetDependencies(task, allTasks)
}
