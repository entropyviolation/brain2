/**
 * lib/todo-steps.ts — Nested To Do steps
 *
 * A task's `subtasks` tree is a breakdown into steps. Steps are independent:
 * finishing one does not finish another, and nothing has to happen in order.
 * The minutes that count on a step (and on the task) are the greater of the
 * number typed there and the sum of the steps inside it.
 */
import type { Subtask } from "@/lib/types"
import { createSubtaskId } from "@/lib/molecular"

function ownMinutes(minutes: number | undefined): number {
  if (minutes == null || !Number.isFinite(minutes) || minutes <= 0) return 0
  return minutes
}

/** Greater of the typed estimate and the sum of nested steps, at every level. */
export function effectiveDurationMinutes(
  minutes: number | undefined,
  steps: readonly Subtask[] | undefined,
): number {
  const own = ownMinutes(minutes)
  const children = steps ?? []
  if (children.length === 0) return own
  const sum = children.reduce((total, step) => total + effectiveDurationMinutes(step.estimatedDuration, step.subtasks), 0)
  return Math.max(own, sum)
}

export function flattenSteps(steps: readonly Subtask[] | undefined): Subtask[] {
  const out: Subtask[] = []
  for (const step of steps ?? []) {
    out.push(step)
    if (step.subtasks?.length) out.push(...flattenSteps(step.subtasks))
  }
  return out
}

/** Completed internal steps over every step nested inside, not the step itself. */
export function internalStepProgress(steps: readonly Subtask[] | undefined): { completed: number; total: number } | null {
  const all = flattenSteps(steps)
  if (all.length === 0) return null
  return { completed: all.filter((step) => step.completed).length, total: all.length }
}

/**
 * How much of the step tree is finished. No steps, or none finished, is 0.
 * This is not minutes against a day — a 30-minute estimate is 30/480 of an
 * 8-hour day (6%), and that figure was being shown as “% complete”.
 */
export function todoCompletionPercent(steps: readonly Subtask[] | undefined): number {
  const progress = internalStepProgress(steps)
  if (!progress || progress.total <= 0) return 0
  return Math.round((progress.completed / progress.total) * 100)
}

export function formatInternalProgress(steps: readonly Subtask[] | undefined): string | null {
  const progress = internalStepProgress(steps)
  if (!progress) return null
  return `${progress.completed}/${progress.total} · ${todoCompletionPercent(steps)}%`
}

export function taskMatchesAssignedQuery(
  title: string,
  steps: readonly Subtask[] | undefined,
  query: string,
): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  if (title.toLowerCase().includes(needle)) return true
  return flattenSteps(steps).some((step) => step.description.toLowerCase().includes(needle))
}

function mapSteps(steps: readonly Subtask[], visit: (step: Subtask) => Subtask | null): Subtask[] {
  const next: Subtask[] = []
  for (const step of steps) {
    const visited = visit(step)
    if (!visited) continue
    const children = step.subtasks?.length ? mapSteps(step.subtasks, visit) : step.subtasks
    next.push(children === step.subtasks ? visited : { ...visited, subtasks: children })
  }
  return next
}

function insertUnder(steps: readonly Subtask[], parentId: string, made: Subtask): Subtask[] {
  return steps.map((step) => {
    if (step.id === parentId) return { ...step, subtasks: [...(step.subtasks ?? []), made] }
    if (!step.subtasks?.length) return step
    return { ...step, subtasks: insertUnder(step.subtasks, parentId, made) }
  })
}

export function addNestedStep(
  steps: readonly Subtask[] | undefined,
  parentId: string | null,
  draft: { description: string; estimatedDuration?: number },
): Subtask[] {
  const description = draft.description.trim()
  if (!description) return [...(steps ?? [])]
  const minutes = ownMinutes(draft.estimatedDuration)
  const made: Subtask = {
    id: createSubtaskId(),
    description,
    completed: false,
    ...(minutes > 0 ? { estimatedDuration: minutes } : {}),
  }
  const list = steps ?? []
  if (!parentId) return [...list, made]
  return insertUnder(list, parentId, made)
}

export function updateNestedStep(
  steps: readonly Subtask[] | undefined,
  id: string,
  patch: { description?: string; estimatedDuration?: number; completed?: boolean },
): Subtask[] {
  return mapSteps(steps ?? [], (step) => {
    if (step.id !== id) return step
    const next: Subtask = { ...step }
    if (patch.description != null) {
      const description = patch.description.trim()
      if (description) next.description = description
    }
    if ("estimatedDuration" in patch) {
      const minutes = ownMinutes(patch.estimatedDuration)
      if (minutes > 0) next.estimatedDuration = minutes
      else delete next.estimatedDuration
    }
    if (patch.completed != null) next.completed = patch.completed
    return next
  })
}

export function removeNestedStep(steps: readonly Subtask[] | undefined, id: string): Subtask[] {
  const kept: Subtask[] = []
  for (const step of steps ?? []) {
    if (step.id === id) continue
    const children = step.subtasks?.length ? removeNestedStep(step.subtasks, id) : step.subtasks
    kept.push(children === step.subtasks ? step : { ...step, subtasks: children })
  }
  return kept
}
