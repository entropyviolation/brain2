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

/** The default estimate when nothing is typed (To Do → Pace → Default est). */
export const DEFAULT_ESTIMATE_MIN = 30

/**
 * The one rule for minutes that count (Phase 6): the typed estimate, else
 * `defaultMin`, against the sum of the steps, whichever is greater. Pass
 * `defaultMin` 0 to get `effectiveDurationMinutes`. The default is never written.
 */
export function countingMinutes(
  item: { estimatedDuration?: number; subtasks?: readonly Subtask[] } | undefined,
  defaultMin = DEFAULT_ESTIMATE_MIN,
): number {
  const typed = effectiveDurationMinutes(item?.estimatedDuration, item?.subtasks)
  if (typed > 0) return typed
  return defaultMin > 0 ? defaultMin : 0
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

// ---- Moving steps like files (Phase 9, R5) --------------------------------

/** Where a move lands: before or after a step, inside it (as its last child), or at the end of a list. */
export type StepMoveTarget =
  | { id: string; where: "before" | "after" | "inside" }
  | { where: "end"; parentId: string | null }

/**
 * The selected ids whose ancestors are not also selected, in tree order. A
 * selected child rides along with its selected parent, so it is not moved twice.
 */
export function topMostSelected(steps: readonly Subtask[] | undefined, ids: Iterable<string>): string[] {
  const wanted = new Set(ids)
  const out: string[] = []
  const walk = (list: readonly Subtask[]) => {
    for (const step of list) {
      if (wanted.has(step.id)) out.push(step.id)
      else if (step.subtasks?.length) walk(step.subtasks)
    }
  }
  walk(steps ?? [])
  return out
}

function findStepIn(list: readonly Subtask[], id: string): Subtask | undefined {
  for (const step of list) {
    if (step.id === id) return step
    const hit = step.subtasks?.length ? findStepIn(step.subtasks, id) : undefined
    if (hit) return hit
  }
  return undefined
}

function insertAt(list: readonly Subtask[], target: StepMoveTarget, moved: Subtask[]): { list: Subtask[]; done: boolean } {
  if (target.where === "end" && target.parentId == null) return { list: [...list, ...moved], done: true }
  let done = false
  const out: Subtask[] = []
  for (const step of list) {
    if (done) {
      out.push(step)
      continue
    }
    if (target.where !== "end" && step.id === target.id) {
      done = true
      if (target.where === "before") out.push(...moved, step)
      else if (target.where === "after") out.push(step, ...moved)
      else out.push({ ...step, subtasks: [...(step.subtasks ?? []), ...moved] })
      continue
    }
    if (target.where === "end" && step.id === target.parentId) {
      done = true
      out.push({ ...step, subtasks: [...(step.subtasks ?? []), ...moved] })
      continue
    }
    if (step.subtasks?.length) {
      const inner = insertAt(step.subtasks, target, moved)
      if (inner.done) {
        done = true
        out.push({ ...step, subtasks: inner.list })
        continue
      }
    }
    out.push(step)
  }
  return { list: out, done }
}

/**
 * Move steps (and everything inside them) to `target`, keeping their order.
 * Refused, and the same array returned, when nothing is selected, the target
 * is missing, or the target is one of the moved steps or inside one. Ids,
 * `dependsOn` and every other field ride along unchanged. Pure.
 */
export function moveSteps(
  steps: readonly Subtask[] | undefined,
  ids: Iterable<string>,
  target: StepMoveTarget,
): Subtask[] {
  const list = (steps ?? []) as Subtask[]
  const tops = topMostSelected(list, ids)
  if (tops.length === 0) return list
  const moved = tops.map((id) => findStepIn(list, id)!)
  const anchorId = target.where === "end" ? target.parentId : target.id
  if (anchorId != null) {
    if (!findStepIn(list, anchorId)) return list
    if (moved.some((step) => step.id === anchorId || findStepIn(step.subtasks ?? [], anchorId))) return list
  }
  let pruned: Subtask[] = list
  for (const id of tops) pruned = removeNestedStep(pruned, id)
  const placed = insertAt(pruned, target, moved)
  return placed.done ? placed.list : list
}

/** The parent of a step (null at the top), or undefined when the id is not in the tree. */
export function stepParentId(steps: readonly Subtask[] | undefined, id: string): string | null | undefined {
  const walk = (list: readonly Subtask[], parent: string | null): string | null | undefined => {
    for (const step of list) {
      if (step.id === id) return parent
      if (step.subtasks?.length) {
        const hit = walk(step.subtasks, step.id)
        if (hit !== undefined) return hit
      }
    }
    return undefined
  }
  return walk(steps ?? [], null)
}

/** The list a step sits in (its siblings, itself included). */
export function stepSiblings(steps: readonly Subtask[] | undefined, id: string): readonly Subtask[] {
  const parent = stepParentId(steps, id)
  if (parent === undefined) return []
  if (parent === null) return steps ?? []
  return findStepIn(steps ?? [], parent)?.subtasks ?? []
}
