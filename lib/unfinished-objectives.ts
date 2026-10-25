/**
 * lib/unfinished-objectives.ts — Objectives parked for the next sitting
 *
 * A live "objectives for right now" row can be saved for later, or carried
 * when Stop is answered Yes. It waits on the task, the subtask, the pen, or
 * the operation it belonged to, and comes back when that same thing is
 * tracked again. `addedAt` stays the day it was written. `workedMs` is only
 * time it spent on a live list. The gap while it waits is not work.
 *
 * Not Home Goals, and not the Tracking Objective pen.
 */
import type { Task } from "@/lib/types"
import type { NowObjective } from "@/lib/now-objective"
import { itemTitle } from "@/lib/item-utils"
import { getOperationTaskTree } from "@/lib/operations"
import { flattenSteps } from "@/lib/todo-steps"
import { useTaskStore } from "@/lib/task-store"

export type UnfinishedHome =
  | { kind: "task"; taskId: string }
  | { kind: "step"; taskId: string; stepId: string }
  | { kind: "pen"; scopeId: string; penId: string }
  | { kind: "operation"; operationId: string }

/** One parked objective. `workedMs` does not include the wait. */
export interface ParkedObjective {
  id: string
  text: string
  addedAt: string
  workedMs: number
  home: UnfinishedHome
  stepId?: string
  completes?: boolean
  taskId?: string
}

export interface ObjectiveAttachChoice {
  taskId: string
  stepId?: string
  label: string
}

export function sameUnfinishedHome(a: UnfinishedHome, b: UnfinishedHome): boolean {
  if (a.kind !== b.kind) return false
  if (a.kind === "task" && b.kind === "task") return a.taskId === b.taskId
  if (a.kind === "step" && b.kind === "step") return a.taskId === b.taskId && a.stepId === b.stepId
  if (a.kind === "pen" && b.kind === "pen") return a.scopeId === b.scopeId && a.penId === b.penId
  if (a.kind === "operation" && b.kind === "operation") return a.operationId === b.operationId
  return false
}

export interface ObjectiveHomeContext {
  taskId?: string
  stepId?: string
  operationId?: string
  scopeId?: string
  penId?: string
}

/**
 * Where an objective waits. An explicit attachment wins. Otherwise it follows
 * the subtask on the clock, then the task, then the operation, then the pen.
 */
export function homeForObjective(
  row: Pick<NowObjective, "taskId" | "stepId">,
  ctx: ObjectiveHomeContext,
): UnfinishedHome | null {
  if (row.taskId && row.stepId) return { kind: "step", taskId: row.taskId, stepId: row.stepId }
  if (row.taskId) return { kind: "task", taskId: row.taskId }
  if (ctx.taskId && (row.stepId || ctx.stepId)) {
    return { kind: "step", taskId: ctx.taskId, stepId: row.stepId ?? ctx.stepId! }
  }
  if (ctx.taskId) return { kind: "task", taskId: ctx.taskId }
  if (ctx.operationId) return { kind: "operation", operationId: ctx.operationId }
  if (ctx.scopeId && ctx.penId) return { kind: "pen", scopeId: ctx.scopeId, penId: ctx.penId }
  return null
}

export function homesForPen(scopeId: string, penId: string): UnfinishedHome[] {
  return [{ kind: "pen", scopeId, penId }]
}

/** Task-level rows, plus the step's own rows when a subtask is on the clock. */
export function homesForTask(taskId: string, stepId?: string): UnfinishedHome[] {
  const homes: UnfinishedHome[] = [{ kind: "task", taskId }]
  if (stepId) homes.push({ kind: "step", taskId, stepId })
  return homes
}

/** The operation clock, and rows attached to the operation item itself. */
export function homesForOperation(operationId: string): UnfinishedHome[] {
  return [
    { kind: "operation", operationId },
    { kind: "task", taskId: operationId },
  ]
}

/** A copy that can wait. Does not bank the open stint — the caller does that when the sitting counted. */
export function toParked(row: NowObjective, home: UnfinishedHome): ParkedObjective | null {
  const text = row.text.trim()
  if (!text || row.completedAt) return null
  const parked: ParkedObjective = {
    id: row.id,
    text,
    addedAt: row.addedAt,
    workedMs: row.workedMs ?? 0,
    home,
  }
  if (row.stepId) parked.stepId = row.stepId
  if (row.completes !== undefined) parked.completes = row.completes
  if (row.taskId) parked.taskId = row.taskId
  return parked
}

/** Put a parked objective back on a live list. The new stint starts at `at`. */
export function resumeParked(row: ParkedObjective, at: Date): NowObjective {
  const next: NowObjective = {
    id: row.id,
    text: row.text,
    addedAt: row.addedAt,
    workedMs: row.workedMs,
    stintStartedAt: at.toISOString(),
  }
  if (row.stepId) next.stepId = row.stepId
  if (row.completes !== undefined) next.completes = row.completes
  if (row.taskId) next.taskId = row.taskId
  return next
}

/** Append parked rows whose ids are not already on the list. */
export function mergeResumed(
  list: NowObjective[] | undefined,
  parked: readonly ParkedObjective[],
  at: Date,
): NowObjective[] | undefined {
  const have = new Set((list ?? []).map((row) => row.id))
  const added = parked.filter((row) => !have.has(row.id)).map((row) => resumeParked(row, at))
  if (!added.length) return list
  return [...(list ?? []), ...added]
}

function pushTaskChoices(out: ObjectiveAttachChoice[], task: Task, seen: Set<string>): void {
  if (task.completed || seen.has(task.id)) return
  seen.add(task.id)
  const title = itemTitle(task) || "Untitled"
  out.push({ taskId: task.id, label: title })
  for (const step of flattenSteps(task.subtasks)) {
    if (step.completed) continue
    out.push({ taskId: task.id, stepId: step.id, label: `${title} › ${step.description}` })
  }
}

/** Open tasks linked to this pen, plus the task already on the clock, and their open steps. */
export function attachChoicesForPen(
  tasks: readonly Task[],
  penId: string | undefined,
  clockTaskId?: string,
): ObjectiveAttachChoice[] {
  const out: ObjectiveAttachChoice[] = []
  const seen = new Set<string>()
  for (const task of tasks) {
    const linked = !!penId && !!task.penLinks?.some((link) => link.penId === penId)
    if (linked || task.id === clockTaskId) pushTaskChoices(out, task, seen)
  }
  return out
}

/** The operation, its open phases and parts, and their open steps. */
export function attachChoicesForOperation(tasks: readonly Task[], operationId: string): ObjectiveAttachChoice[] {
  const out: ObjectiveAttachChoice[] = []
  const seen = new Set<string>()
  const op = tasks.find((task) => task.id === operationId)
  if (op) pushTaskChoices(out, op, seen)
  for (const task of getOperationTaskTree(operationId, [...tasks])) pushTaskChoices(out, task, seen)
  return out
}

/** A new task named from the objective. Linked to the pen when the clock has one. */
export function createTaskForObjective(
  name: string,
  pen?: { scopeId: string; penId: string },
): string | null {
  const title = name.trim()
  if (!title) return null
  const id = `task-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  useTaskStore.getState().addTask({
    id,
    title,
    description: title,
    type: "task",
    stage: "clarified",
    createdAt: new Date(),
    completed: false,
    lists: [],
    ...(pen ? { penLinks: [{ scopeId: pen.scopeId, penId: pen.penId }] } : {}),
  })
  return id
}
