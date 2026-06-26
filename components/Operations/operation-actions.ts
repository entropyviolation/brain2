/**
 * components/Operations/operation-actions.ts — Operation mutations (Worker B)
 *
 * Thin imperative helpers the Operations UI calls to mutate the task store. They
 * never edit a store file: they only CALL `useTaskStore.getState().updateTask` /
 * `addTask` and the pure `lib/links.ts` helpers to attach phases / parts /
 * resources, write the Home notes pad, set the stage, and log time. The op
 * post-mortem is persisted through the reviews-store action Worker G added
 * (`addOperationReview`), called defensively in case it is not present yet.
 */
"use client"

import { useTaskStore } from "@/lib/task-store"
import { useReviewsStore, type OperationReviewInput, type OperationReview } from "@/lib/reviews-store"
import { addLink, removeLinkByTarget } from "@/lib/links"
import {
  OPERATION_TYPE_ID,
  OPERATION_ATTR,
  DEFAULT_OPERATION_STAGE,
  type OperationStage,
} from "@/lib/operation-types"
import { OP_REL, getOperationTaskTree, loggedMinutes, rollupMinutes } from "@/lib/operations"
import type { Task, TimeLogEntry } from "@/lib/types"

function genId(prefix = "op"): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return `${prefix}_${crypto.randomUUID()}`
    }
  } catch {
    /* fall through */
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/**
 * Promote an existing task into an Operation (directed enterprise). Idempotent:
 * an already-typed operation is returned untouched. Exported for the item "⋯"
 * menu wiring (integration pass).
 */
export function upgradeTaskToOperation(taskId: string): Task | null {
  const store = useTaskStore.getState()
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task) return null
  if (task.type === OPERATION_TYPE_ID) return task
  const updated: Task = {
    ...task,
    type: OPERATION_TYPE_ID,
    attributes: {
      [OPERATION_ATTR.stage]: DEFAULT_OPERATION_STAGE,
      ...(task.attributes ?? {}),
    },
  }
  store.updateTask(updated)
  return updated
}

/** Create a brand-new Operation with a title; returns the created task. */
export function createOperation(title: string): Task {
  const store = useTaskStore.getState()
  const op: Task = {
    id: genId("op"),
    description: title.trim() || "New operation",
    type: OPERATION_TYPE_ID,
    stage: "clarified",
    createdAt: new Date(),
    completed: false,
    lists: [],
    attributes: { [OPERATION_ATTR.stage]: DEFAULT_OPERATION_STAGE },
    links: [],
  }
  store.addTask(op)
  return op
}

function patchOperation(operationId: string, patch: Partial<Task>): void {
  const store = useTaskStore.getState()
  const op = store.tasks.find((t) => t.id === operationId)
  if (!op) return
  store.updateTask({ ...op, ...patch })
}

/** Merge attributes onto the operation (does not clobber other attributes). */
function patchOperationAttributes(operationId: string, attrs: Record<string, unknown>): void {
  const store = useTaskStore.getState()
  const op = store.tasks.find((t) => t.id === operationId)
  if (!op) return
  store.updateTask({ ...op, attributes: { ...(op.attributes ?? {}), ...attrs } } as Task)
}

/** Set the Home notes pad (stored in the dedicated `homeNotes` attribute). */
export function setHomeNotes(operationId: string, notes: string): void {
  patchOperationAttributes(operationId, { [OPERATION_ATTR.homeNotes]: notes })
}

export function setStage(operationId: string, stage: OperationStage): void {
  patchOperationAttributes(operationId, { [OPERATION_ATTR.stage]: stage })
}

export function setMission(operationId: string, mission: string): void {
  patchOperationAttributes(operationId, { [OPERATION_ATTR.mission]: mission })
}

export function renameOperation(operationId: string, title: string): void {
  const next = title.trim()
  if (next) patchOperation(operationId, { description: next })
}

/**
 * Attach an *existing* task to the operation via a forward relation
 * (`has-phase`/`has-part`/`has-resource`). No-op for self-links / duplicates.
 */
export function linkChild(operationId: string, forwardRel: string, childId: string): void {
  const store = useTaskStore.getState()
  const op = store.tasks.find((t) => t.id === operationId)
  if (!op) return
  const links = addLink(op.links, forwardRel, childId, op.id)
  if (links !== op.links) store.updateTask({ ...op, links })
}

/** Detach a child relation (removes the forward link on the operation). */
export function unlinkChild(operationId: string, forwardRel: string, childId: string): void {
  const store = useTaskStore.getState()
  const op = store.tasks.find((t) => t.id === operationId)
  if (!op) return
  const links = removeLinkByTarget(op.links, forwardRel, childId)
  if (links !== op.links) store.updateTask({ ...op, links })
}

/**
 * Create a new child task (phase/part/resource) and link it to the operation in
 * one step. `forwardRel` should be one of OP_REL.has*. Returns the new task.
 */
export function addChild(
  operationId: string,
  forwardRel: string,
  description: string,
  extra: Partial<Task> = {},
): Task | null {
  const store = useTaskStore.getState()
  const op = store.tasks.find((t) => t.id === operationId)
  if (!op) return null
  const child: Task = {
    id: genId("op"),
    description: description.trim() || "Untitled",
    stage: "clarified",
    createdAt: new Date(),
    completed: false,
    lists: op.lists ?? [],
    ...extra,
  }
  store.addTask(child)
  linkChild(operationId, forwardRel, child.id)
  return child
}

export const addPhase = (operationId: string, description: string) =>
  addChild(operationId, OP_REL.hasPhase, description)
export const addPart = (parentId: string, description: string) =>
  addChild(parentId, OP_REL.hasPart, description)
export const addResource = (operationId: string, description: string) =>
  addChild(operationId, OP_REL.hasResource, description)

/** Toggle a child task's completion (calls updateTask — never the hot path). */
export function setTaskCompleted(taskId: string, completed: boolean): void {
  const store = useTaskStore.getState()
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task) return
  store.updateTask({ ...task, completed })
}

/** Append a time-log entry to a task (defaults the date to today, local). */
export function logTime(
  taskId: string,
  entry: { durationMinutes: number; date?: string; notes?: string; activityLabel?: string },
): void {
  const store = useTaskStore.getState()
  const task = store.tasks.find((t) => t.id === taskId)
  if (!task) return
  const log: TimeLogEntry = {
    id: genId("log"),
    date: entry.date ?? localDayKey(new Date()),
    durationMinutes: entry.durationMinutes,
    notes: entry.notes,
    activityLabel: entry.activityLabel,
    taskId,
  }
  store.updateTask({ ...task, timeLogs: [...(task.timeLogs ?? []), log] })
}

/**
 * Persist the operation post-mortem (#277) via the reviews-store action Worker G
 * adds (`addOperationReview`). Rolls up total logged hours across the operation
 * task tree before saving. Returns the stored review, or `null` when the action
 * is not present yet (integration not complete) — callers can surface a notice.
 */
export function saveOperationPostMortem(
  operationId: string,
  input: Omit<OperationReviewInput, "operationId" | "hoursLogged"> & { hoursLogged?: number },
): OperationReview | null {
  const taskStore = useTaskStore.getState()
  const op = taskStore.tasks.find((t) => t.id === operationId)
  const tree = op ? getOperationTaskTree(operationId, taskStore.tasks) : []
  const totalMinutes = (op ? loggedMinutes(op) : 0) + rollupMinutes(tree)
  const hoursLogged = input.hoursLogged ?? Math.round((totalMinutes / 60) * 10) / 10

  const reviews = useReviewsStore.getState() as {
    addOperationReview?: (r: OperationReviewInput) => OperationReview
  }
  if (typeof reviews.addOperationReview !== "function") {
    // Worker G's action isn't wired yet — see Operations/README.md integration note.
    return null
  }
  return reviews.addOperationReview({ ...input, operationId, hoursLogged })
}

function localDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
