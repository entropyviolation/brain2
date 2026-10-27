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
import { useItemTypeStore } from "@/lib/item-type-store"
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

/**
 * Put a parked objective back on a live list, in Next. Banked `workedMs`
 * comes with it. `at` is the sitting that picked it up; it does not start a
 * stint, so a refresh of a sitting already in Now is not this path.
 */
export function resumeParked(row: ParkedObjective, _at: Date): NowObjective {
  const next: NowObjective = {
    id: row.id,
    text: row.text,
    addedAt: row.addedAt,
    workedMs: row.workedMs,
    lane: "next",
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

/** Item type for lines filed onto a task's Objectives list. Created the first time one is attached. */
export const OBJECTIVES_ITEM_TYPE_ID = "objectives"

/** Every task in the vault, by title. Steps are not choices. */
export function taskAttachChoices(tasks: readonly Task[]): ObjectiveAttachChoice[] {
  const out: ObjectiveAttachChoice[] = []
  for (const task of tasks) {
    if (task.type !== "task") continue
    out.push({ taskId: task.id, label: itemTitle(task) || "Untitled" })
  }
  out.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }))
  return out
}

/**
 * Tasks the attach search offers. The pen and the clock do not narrow it:
 * the search is the whole vault, and it does not list steps.
 */
export function attachChoicesForPen(
  tasks: readonly Task[],
  _penId?: string,
  _clockTaskId?: string,
): ObjectiveAttachChoice[] {
  return taskAttachChoices(tasks)
}

/** Tasks the attach search offers. The operation does not narrow it. */
export function attachChoicesForOperation(tasks: readonly Task[], _operationId?: string): ObjectiveAttachChoice[] {
  return taskAttachChoices(tasks)
}

function objectivesItemId(objectiveId: string): string {
  return `objective-item-${objectiveId}`
}

/** The Objectives item type, or one the vault already named Objectives. */
export function ensureObjectivesItemType(): string {
  const store = useItemTypeStore.getState()
  const named = store.types.find((type) => type.name.trim().toLowerCase() === "objectives")
  if (named) return String(named.id)
  if (store.types.some((type) => type.id === OBJECTIVES_ITEM_TYPE_ID)) return OBJECTIVES_ITEM_TYPE_ID
  store.addType({
    id: OBJECTIVES_ITEM_TYPE_ID,
    name: "Objectives",
    pluralName: "Objectives",
    itemLabel: "objective",
    description: "A line of work attached to a task.",
    detailPanels: ["details"],
    attributes: [],
    capabilities: {},
  })
  return OBJECTIVES_ITEM_TYPE_ID
}

/**
 * File these objectives on the task. The task gains a list attribute named
 * Objectives. That list's item type is Objectives, and each objective is an
 * item on it. A second attach reuses the list and the same item ids.
 */
export function fileObjectivesOnTask(
  taskId: string,
  objectives: readonly { id: string; text: string }[],
): void {
  const rows: { id: string; text: string }[] = []
  for (const row of objectives) {
    const text = row.text.trim()
    if (!row.id || !text) continue
    rows.push({ id: row.id, text })
  }
  if (!taskId || rows.length === 0) return

  const typeId = ensureObjectivesItemType()
  const store = useTaskStore.getState()
  const task = store.tasks.find((item) => item.id === taskId)
  if (!task) return

  const preferredId = `objectives-for-${taskId}`
  const existingValue = (task.itemAttributeDefinitions ?? [])
    .filter((def) => def.type === "list" && def.name.trim().toLowerCase() === "objectives")
    .map((def) => task.attributes?.[def.id])
    .find((value): value is string => typeof value === "string" && value.length > 0)
  const listId = existingValue && store.lists.some((list) => list.id === existingValue) ? existingValue : preferredId

  if (!store.lists.some((list) => list.id === listId)) {
    store.addList({
      id: listId,
      name: `${itemTitle(task) || "Task"} Objectives`,
      color: "#3d6b58",
      createdAt: new Date(),
      itemTypeId: typeId,
      itemTypeIds: [typeId],
      itemLabel: "objective",
      scheduleable: false,
    })
  } else {
    const list = store.lists.find((item) => item.id === listId)
    if (list && !list.itemTypeId) {
      store.updateList({
        ...list,
        itemTypeId: typeId,
        itemTypeIds: list.itemTypeIds?.length ? list.itemTypeIds : [typeId],
        itemLabel: list.itemLabel ?? "objective",
      })
    }
  }

  const current = useTaskStore.getState().tasks.find((item) => item.id === taskId)
  if (!current) return
  const defs = [...(current.itemAttributeDefinitions ?? [])]
  let defIndex = defs.findIndex((def) => def.type === "list" && def.name.trim().toLowerCase() === "objectives")
  if (defIndex < 0) {
    const id = defs.some((def) => def.id === "objectives") ? "task-objectives" : "objectives"
    defs.push({ id, name: "Objectives", type: "list", refListId: listId, createdAt: new Date().toISOString() })
    defIndex = defs.length - 1
  }
  const attrId = defs[defIndex].id
  defs[defIndex] = { ...defs[defIndex], name: "Objectives", type: "list", refListId: listId }
  const sameDef = (current.itemAttributeDefinitions ?? []).some(
    (def) => def.id === attrId && def.type === "list" && def.name === "Objectives" && def.refListId === listId,
  )
  if (current.attributes?.[attrId] !== listId || !sameDef) {
    useTaskStore.getState().updateTask({
      ...current,
      itemAttributeDefinitions: defs,
      attributes: { ...(current.attributes ?? {}), [attrId]: listId },
    })
  }

  const vault = useTaskStore.getState()
  for (const row of rows) {
    const itemId = objectivesItemId(row.id)
    const have = vault.tasks.find((item) => item.id === itemId)
    if (!have) {
      vault.addTask({
        id: itemId,
        title: row.text,
        description: row.text,
        type: typeId,
        stage: "clarified",
        createdAt: new Date(),
        completed: false,
        lists: [listId],
        tags: [],
        links: [],
        subtasks: [],
        rewardValue: 1,
      })
      continue
    }
    const lists = (have.lists ?? []).filter((id) => id === listId || !id.startsWith("objectives-for-"))
    if (!lists.includes(listId)) lists.push(listId)
    const sameLists =
      lists.length === (have.lists ?? []).length && lists.every((id, index) => (have.lists ?? [])[index] === id)
    if (have.title === row.text && have.description === row.text && have.type === typeId && sameLists) continue
    vault.updateTask({ ...have, title: row.text, description: row.text, type: typeId, lists })
  }
}

/** Objectives on this sitting that already point at the task. */
export function objectivesAttachedToTask(
  list: readonly NowObjective[] | undefined,
  taskId: string,
): { id: string; text: string }[] {
  return (list ?? []).filter((row) => row.taskId === taskId).map((row) => ({ id: row.id, text: row.text }))
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
    tags: [],
    links: [],
    subtasks: [],
    rewardValue: 1,
    ...(pen ? { penLinks: [{ scopeId: pen.scopeId, penId: pen.penId }] } : {}),
  })
  return id
}
