/**
 * lib/step-items.ts — Steps become items when needed (Phase 11, Decision 5)
 *
 * A step is a `Subtask` in `task.subtasks`. When it opens in item detail it
 * gets a normal `Task` to hold what a step cannot: notes, note log, resources,
 * links, tags, attributes, pens. The step points at it (`Subtask.itemId`); the
 * item points back (`parentTaskId`, `stepOf`). Lookup goes by `stepOf`, so an
 * older draft that saves the tree without `itemId` keeps the link.
 *
 * The tree is the source of truth for order, nesting, done, estimate,
 * `dependsOn`, actuals, tier, spark and points. The item keeps a read mirror
 * of the name and estimate so item detail can draw them; edits there go back
 * to the step through `updateStepField`. The item itself is never completed.
 *
 * A step item is never a To Do row, lens, list, Scheduler or search hit
 * (`isStepItem`). Pure helpers first; the store writers sit at the bottom.
 */
import type { Subtask, Task } from "@/lib/types"
import { findPlacedStep, placeSteps } from "@/lib/next-step"
import { storedActualMinutes } from "@/lib/tracked-time"
import { countingMinutes, internalStepProgress, updateNestedStep } from "@/lib/todo-steps"
import { useTaskStore } from "@/lib/task-store"
import { orbFor } from "@/components/Icons/Icon"
import { withoutUndo } from "@/lib/action-history"
import type { StepRef } from "@/lib/step-item-guard"

export { isOwnStepOrParent, isStepItem, withoutStepItems, type StepRef } from "@/lib/step-item-guard"

export function findStep(task: Pick<Task, "subtasks"> | undefined, stepId: string): Subtask | undefined {
  return task ? findPlacedStep(task.subtasks, stepId)?.step : undefined
}

/** The item for this step, by `stepOf` first, then the step's `itemId`. */
export function findStepItem(tasks: readonly Task[], taskId: string, stepId: string): Task | undefined {
  const byRef = tasks.find((t) => t.stepOf?.taskId === taskId && t.stepOf.stepId === stepId)
  if (byRef) return byRef
  const itemId = findStep(tasks.find((t) => t.id === taskId), stepId)?.itemId
  return itemId ? tasks.find((t) => t.id === itemId) : undefined
}

/** A fresh item for a step. Pure; the caller adds it. */
export function buildStepItem(parent: Task, step: Subtask, id: string, now: Date = new Date()): Task {
  return {
    id,
    type: "task",
    title: step.description,
    description: step.description,
    stage: "list",
    createdAt: now,
    completed: false,
    lists: [],
    estimatedDuration: step.estimatedDuration,
    parentTaskId: parent.id,
    stepOf: { taskId: parent.id, stepId: step.id },
    // Born with the orb the tree already showed for this step.
    icon: orbFor(step.id),
  } as Task
}

/** Name and estimate the item mirrors from its step. Empty when they agree. */
export function mirrorPatch(item: Task, step: Subtask): Partial<Task> {
  const patch: Partial<Task> = {}
  if (item.description !== step.description) {
    patch.description = step.description
    patch.title = step.description
  }
  if ((item.estimatedDuration ?? undefined) !== (step.estimatedDuration ?? undefined)) {
    patch.estimatedDuration = step.estimatedDuration
  }
  return patch
}

/** Shared fields edited on the item that must go back to the step. */
export function sharedEdits(item: Task, step: Subtask): { description?: string; estimatedDuration?: number } {
  const out: { description?: string; estimatedDuration?: number } = {}
  const name = item.description?.trim()
  if (name && name !== step.description) out.description = name
  if ((item.estimatedDuration || undefined) !== (step.estimatedDuration || undefined)) {
    out.estimatedDuration = item.estimatedDuration
  }
  return out
}

/** Replace the steps inside `stepId`. */
export function setStepChildren(steps: readonly Subtask[] | undefined, stepId: string, children: Subtask[]): Subtask[] {
  const walk = (list: readonly Subtask[]): Subtask[] =>
    list.map((s) =>
      s.id === stepId ? { ...s, subtasks: children } : s.subtasks?.length ? { ...s, subtasks: walk(s.subtasks) } : s,
    )
  return walk(steps ?? [])
}

/** Set or clear `itemId` on one step. */
export function setStepItemId(steps: readonly Subtask[] | undefined, stepId: string, itemId: string | undefined): Subtask[] {
  const walk = (list: readonly Subtask[]): Subtask[] =>
    list.map((s) => {
      if (s.id === stepId) {
        const next = { ...s }
        if (itemId) next.itemId = itemId
        else delete next.itemId
        return next
      }
      return s.subtasks?.length ? { ...s, subtasks: walk(s.subtasks) } : s
    })
  return walk(steps ?? [])
}

export type StepItemFix = { remove: string[]; relink: { id: string; taskId: string }[] }

/**
 * Step items whose step is gone. A step deleted (or its parent deleted) takes
 * its item along; a step that now lives in another task moves its item there.
 */
export function reconcileStepItems(tasks: readonly Task[]): StepItemFix {
  const items = tasks.filter((t) => t.stepOf)
  if (!items.length) return { remove: [], relink: [] }
  const owner = new Map<string, string>()
  for (const t of tasks) {
    if (t.stepOf || !t.subtasks?.length) continue
    for (const p of placeSteps(t.subtasks)) owner.set(p.step.id, t.id)
  }
  const fix: StepItemFix = { remove: [], relink: [] }
  for (const item of items) {
    const at = owner.get(item.stepOf!.stepId)
    if (!at) fix.remove.push(item.id)
    else if (at !== item.stepOf!.taskId) fix.relink.push({ id: item.id, taskId: at })
  }
  return fix
}

export type StepCrumb = { label: string; taskId: string; stepId?: string }

/** `Finish CDs › insert › disc` for a step item. Last crumb is the step itself. */
export function stepCrumbs(tasks: readonly Task[], item: Task): StepCrumb[] {
  if (!item.stepOf) return []
  const parent = tasks.find((t) => t.id === item.stepOf!.taskId)
  if (!parent) return []
  const placed = findPlacedStep(parent.subtasks, item.stepOf.stepId)
  if (!placed) return []
  return [
    { label: parent.description, taskId: parent.id },
    ...[...placed.path, placed.step].map((s) => ({ label: s.description, taskId: parent.id, stepId: s.id })),
  ]
}

/** `est · parts · spent` for a step. Spent rolls up parts' saved actuals. Estimates stay as typed. */
export function stepReadout(step: Subtask): { est: number; parts: string | null; spent: number } {
  const progress = internalStepProgress(step.subtasks)
  return {
    est: countingMinutes(step, 0),
    parts: progress ? `${progress.completed}/${progress.total}` : null,
    spent: storedActualMinutes(step),
  }
}

// ── Store writers ────────────────────────────────────────────────────────────

function newItemId(): string {
  const uuid = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `step-item-${uuid}`
}

/**
 * The step's item id, made now if it has none (no prompt, no undo step). The
 * mirror is refreshed from the step. Null when the parent or step is missing.
 */
export function ensureStepItem(taskId: string, stepId: string): string | null {
  const store = useTaskStore.getState()
  const parent = store.tasks.find((t) => t.id === taskId)
  const step = findStep(parent, stepId)
  if (!parent || !step) return null
  const found = findStepItem(store.tasks, taskId, stepId)
  return withoutUndo(() => {
    if (found) {
      const patch = mirrorPatch(found, step)
      if (Object.keys(patch).length) store.updateTask({ ...found, ...patch })
      if (step.itemId !== found.id) store.updateTask({ ...parent, subtasks: setStepItemId(parent.subtasks, stepId, found.id) })
      return found.id
    }
    const item = buildStepItem(parent, step, newItemId())
    store.addTask(item)
    store.updateTask({ ...parent, subtasks: setStepItemId(parent.subtasks, stepId, item.id) })
    return item.id
  })
}

/** Write shared fields on the step (the source of truth) and refresh the item's mirror. */
export function updateStepField(
  ref: StepRef,
  patch: { description?: string; estimatedDuration?: number; completed?: boolean },
): void {
  const store = useTaskStore.getState()
  const parent = store.tasks.find((t) => t.id === ref.taskId)
  if (!parent || !findStep(parent, ref.stepId)) return
  store.updateTask({ ...parent, subtasks: updateNestedStep(parent.subtasks, ref.stepId, patch) })
  const after = useTaskStore.getState()
  const step = findStep(after.tasks.find((t) => t.id === ref.taskId), ref.stepId)
  const item = findStepItem(after.tasks, ref.taskId, ref.stepId)
  if (step && item) {
    const mirror = mirrorPatch(item, step)
    if (Object.keys(mirror).length) withoutUndo(() => after.updateTask({ ...item, ...mirror }))
  }
}

/** Replace the steps inside a step (item detail → Subtasks on a step item). */
export function updateStepChildren(ref: StepRef, children: Subtask[]): void {
  const store = useTaskStore.getState()
  const parent = store.tasks.find((t) => t.id === ref.taskId)
  if (!parent || !findStep(parent, ref.stepId)) return
  store.updateTask({ ...parent, subtasks: setStepChildren(parent.subtasks, ref.stepId, children) })
}

/**
 * Apply `reconcileStepItems` to the store. Runs inside the action that deleted
 * the step (no undo step of its own), so one undo brings both back. A live
 * step item is also taken off the removal tombstones, so an undo that restores
 * it is not dropped again by the next merge.
 */
export function applyStepItemFixes(): void {
  const state = useTaskStore.getState()
  const fix = reconcileStepItems(state.tasks)
  const live = new Set(state.tasks.filter((t) => t.stepOf).map((t) => t.id))
  const tomb = state.removedTaskIds ?? []
  const revived = tomb.some((id) => live.has(id) && !fix.remove.includes(id))
  if (!fix.remove.length && !fix.relink.length && !revived) return
  withoutUndo(() => {
    for (const { id, taskId } of fix.relink) {
      const item = useTaskStore.getState().tasks.find((t) => t.id === id)
      if (item?.stepOf) state.updateTask({ ...item, parentTaskId: taskId, stepOf: { taskId, stepId: item.stepOf.stepId } })
    }
    for (const id of fix.remove) state.deleteTask(id)
    if (revived) {
      useTaskStore.setState((s) => ({
        removedTaskIds: (s.removedTaskIds ?? []).filter((id) => !(live.has(id) && !fix.remove.includes(id))),
      }))
    }
  })
}
