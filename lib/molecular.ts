/**
 * lib/molecular.ts — Molecular task decomposition helpers (Brain2 #1/#59/#128)
 *
 * Pure, immutable helpers for working with a Task's `Subtask[]` tree. The
 * "molecular" idea: recursively split a task into as many discrete steps as
 * possible; a step that cannot be split further is flagged `isMolecular`
 * ("atomic"). Each step can carry a self-contained `context` string so it reads
 * correctly out of its list context — the unit a "Just Start" focus session
 * works on to defeat task-initiation paralysis.
 *
 * Everything here is a pure function (no React, no store) so it is trivially
 * unit-testable. Owner: Worker A.
 */
import type { Subtask, Task } from "@/lib/types"

let __subtaskSeq = 0

/** Deterministic-enough unique id for a new subtask. */
export function createSubtaskId(): string {
  __subtaskSeq += 1
  return `st-${Date.now().toString(36)}-${__subtaskSeq.toString(36)}`
}

export interface NewStep {
  description: string
  /** Self-contained background so the step reads correctly out of context. */
  context?: string
  /** Mark the step atomic (cannot be split further) up front. */
  isMolecular?: boolean
}

/** Build a single Subtask from a description or a richer step spec. */
export function makeSubtask(step: string | NewStep): Subtask {
  const spec: NewStep = typeof step === "string" ? { description: step } : step
  return {
    id: createSubtaskId(),
    description: spec.description.trim(),
    completed: false,
    ...(spec.isMolecular ? { isMolecular: true } : {}),
    ...(spec.context && spec.context.trim() ? { context: spec.context.trim() } : {}),
  }
}

/**
 * Append a list of step descriptions (or specs) to an existing subtask array,
 * returning a NEW array. Blank descriptions are skipped. A shared `context` can
 * be applied to every added step (per-step context still wins).
 */
export function addStepsAsSubtasks(
  existing: Subtask[] | undefined,
  steps: Array<string | NewStep>,
  sharedContext?: string,
): Subtask[] {
  const additions = steps
    .map((s) => (typeof s === "string" ? { description: s } : { ...s }))
    .filter((s) => s.description.trim().length > 0)
    .map((s) =>
      makeSubtask({
        ...s,
        context: s.context ?? sharedContext,
      }),
    )
  return [...(existing ?? []), ...additions]
}

/**
 * Parse a free-form block of text into step descriptions: one step per non-empty
 * line, with a leading list marker / number stripped (e.g. "1. ", "- ", "* ").
 */
export function parseSteps(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter((line) => line.length > 0)
}

/** Return a new array with the matching subtask's `isMolecular` flag set. */
export function markMolecular(subtasks: Subtask[], id: string, isMolecular = true): Subtask[] {
  return subtasks.map((s) => (s.id === id ? { ...s, isMolecular } : s))
}

/** Toggle the `isMolecular` (atomic) flag of one subtask. */
export function toggleMolecular(subtasks: Subtask[], id: string): Subtask[] {
  return subtasks.map((s) => (s.id === id ? { ...s, isMolecular: !s.isMolecular } : s))
}

/** Return a new array with the matching subtask's `context` updated. */
export function setSubtaskContext(subtasks: Subtask[], id: string, context: string): Subtask[] {
  const trimmed = context.trim()
  return subtasks.map((s) => (s.id === id ? { ...s, context: trimmed || undefined } : s))
}

/** Toggle the completed flag of one subtask, returning a new array. */
export function toggleSubtaskComplete(subtasks: Subtask[], id: string): Subtask[] {
  return subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s))
}

/** Mark one subtask completed (idempotent), returning a new array. */
export function completeSubtask(subtasks: Subtask[], id: string): Subtask[] {
  return subtasks.map((s) => (s.id === id ? { ...s, completed: true } : s))
}

/** Remove one subtask, returning a new array. */
export function removeSubtask(subtasks: Subtask[], id: string): Subtask[] {
  return subtasks.filter((s) => s.id !== id)
}

/**
 * The single smallest incomplete "next step" of a task — what "Just Start"
 * surfaces. Selection is deterministic:
 *   1. The first incomplete subtask explicitly flagged `isMolecular` (atomic =
 *      smallest), in array order.
 *   2. Otherwise the first incomplete subtask in array order.
 *   3. `undefined` when there are no subtasks or all are complete.
 */
export function nextMolecularStep(task: Pick<Task, "subtasks"> | undefined): Subtask | undefined {
  const subtasks = task?.subtasks
  if (!subtasks || subtasks.length === 0) return undefined
  const incomplete = subtasks.filter((s) => !s.completed)
  if (incomplete.length === 0) return undefined
  return incomplete.find((s) => s.isMolecular) ?? incomplete[0]
}

/** Count of completed / total subtasks (for progress display). */
export function subtaskProgress(task: Pick<Task, "subtasks"> | undefined): {
  completed: number
  total: number
} {
  const subtasks = task?.subtasks ?? []
  return {
    completed: subtasks.filter((s) => s.completed).length,
    total: subtasks.length,
  }
}
