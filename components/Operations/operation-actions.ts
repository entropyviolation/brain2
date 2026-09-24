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
  getOperationCategories,
  getOperationPreset,
  normalizeOperationCategories,
  operationCategoriesAttribute,
  operationPanelsAttribute,
  operationTrackingTagIdsAttribute,
  resolveOperationPanels,
  sortOperationPanelIds,
  toggleOperationPanelIds,
  withOperationCategory,
  withoutOperationCategory,
  type OperationPanelId,
  type OperationStage,
} from "@/lib/operation-types"
import { OP_REL, getOperationTaskTree, getParts, getPhases, loggedMinutes, rollupMinutes } from "@/lib/operations"
import {
  OPERATIONS_FOLDER_ID,
  ensureOperationTaskList,
  findOperationTaskList,
  operationListTasks,
  syncOperationTaskListName,
} from "@/lib/operation-lists"
import {
  PART_TASK_ATTR,
  childFormulas,
  collectOperationTodoTasks,
  formulaDescendantIds,
  instanceTreeIds,
  normalizePartLabels,
  partFormulasAttribute,
  partInstancesAttribute,
  partTaskFor,
  readPartFormulas,
  readPartInstances,
  type PartFormula,
  type PartInstance,
  type PartTaskRole,
} from "@/lib/operation-parts"
import { ensureOperationPen } from "@/lib/operation-work-session"
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

export interface CreateOperationOptions {
  /** Prebuilt panel set to start from (see `OPERATION_PRESETS`). */
  presetId?: string
  /** Categories to file the new operation under. */
  categories?: string[]
  /** Explicit panel selection, overriding the preset. */
  panels?: OperationPanelId[]
}

/**
 * Create a brand-new Operation. The preset decides which panels it starts with,
 * so a "computer work" operation is not born with a Locations map; categories
 * decide where it lands on the home board. Returns the created task.
 */
export function createOperation(title: string, options: CreateOperationOptions = {}): Task {
  const store = useTaskStore.getState()
  const preset = options.presetId ? getOperationPreset(options.presetId) : undefined
  const panels = options.panels ?? preset?.panels
  // Explicit categories win; otherwise the preset's suggestions are used.
  const categories = normalizeOperationCategories(options.categories ?? preset?.categories ?? [])

  const op: Task = {
    id: genId("op"),
    description: title.trim() || "New operation",
    type: OPERATION_TYPE_ID,
    stage: "clarified",
    createdAt: new Date(),
    completed: false,
    lists: [],
    attributes: {
      [OPERATION_ATTR.stage]: DEFAULT_OPERATION_STAGE,
      ...(panels ? operationPanelsAttribute(panels) : {}),
      ...(categories.length > 0 ? operationCategoriesAttribute(categories) : {}),
    },
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
  if (!next) return
  patchOperation(operationId, { description: next })
  // The backing Tasks list carries the operation's name in the Lists tab.
  syncOperationTaskListName(operationId, next)
}

/** Target date is stored as a `YYYY-MM-DD` string (empty clears it). */
export function setTargetDate(operationId: string, date: string): void {
  patchOperationAttributes(operationId, { [OPERATION_ATTR.targetDate]: date.trim() })
}

// --- Categories ------------------------------------------------------------

/** Replace the operation's categories (normalized: trimmed, de-duplicated). */
export function setOperationCategories(operationId: string, categories: string[]): void {
  patchOperationAttributes(operationId, operationCategoriesAttribute(categories))
}

/** File the operation under one more category. Creating a category = using it. */
export function addOperationCategory(operationId: string, name: string): void {
  if (!name.trim()) return
  const op = useTaskStore.getState().tasks.find((t) => t.id === operationId)
  if (!op) return
  setOperationCategories(operationId, withOperationCategory(getOperationCategories(op), name))
}

export function removeOperationCategory(operationId: string, name: string): void {
  const op = useTaskStore.getState().tasks.find((t) => t.id === operationId)
  if (!op) return
  setOperationCategories(operationId, withoutOperationCategory(getOperationCategories(op), name))
}

// --- Panels ----------------------------------------------------------------

/** Replace the operation's enabled panels (locked panels stay on). */
export function setOperationPanels(operationId: string, panels: Iterable<OperationPanelId>): void {
  patchOperationAttributes(operationId, operationPanelsAttribute(panels))
}

/** Switch a single panel on/off for this operation. */
export function toggleOperationPanel(
  operationId: string,
  panelId: OperationPanelId,
  enabled: boolean,
): void {
  const op = useTaskStore.getState().tasks.find((t) => t.id === operationId)
  if (!op) return
  setOperationPanels(operationId, toggleOperationPanelIds(resolveOperationPanels(op), panelId, enabled))
}

/**
 * Apply a prebuilt panel set. Categories the preset suggests are merged in
 * (never removed) so re-shaping an operation doesn't unfile it.
 */
export function applyOperationPreset(operationId: string, presetId: string): void {
  const preset = getOperationPreset(presetId)
  if (!preset) return
  const op = useTaskStore.getState().tasks.find((t) => t.id === operationId)
  if (!op) return
  const categories = normalizeOperationCategories([
    ...getOperationCategories(op),
    ...(preset.categories ?? []),
  ])
  patchOperationAttributes(operationId, {
    ...operationPanelsAttribute(sortOperationPanelIds(preset.panels)),
    ...operationCategoriesAttribute(categories),
  })
}

/**
 * Create (once) the `List` backing this operation's Tasks panel. Exported so the
 * Tasks panel can call it on mount; see `lib/operation-lists.ts`.
 */
export function ensureTaskList(operationId: string) {
  return ensureOperationTaskList(operationId)
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

/**
 * A phase checklist step that also lands on the operation's To do list.
 * Linked `has-part` to the phase, and filed in the operation's backing list.
 */
export function addPhaseStep(operationId: string, phaseId: string, description: string): Task | null {
  const list = ensureOperationTaskList(operationId)
  return addChild(phaseId, OP_REL.hasPart, description, list ? { lists: [list.id] } : {})
}

/**
 * Add an item to the operation's **Tasks** panel. The item is a real list item
 * (filed in the operation's backing `List`, adopting its item type and default
 * attribute values) *and* a `has-part` child of the operation, so it also feeds
 * progress and the Queue rail.
 */
export function addOperationListTask(
  operationId: string,
  description: string,
  extra: Partial<Task> = {},
): Task | null {
  const list = ensureOperationTaskList(operationId)
  if (!list) return null
  const store = useTaskStore.getState()
  const { attributes: extraAttributes, ...rest } = extra
  const item: Task = {
    id: genId("op"),
    description: description.trim() || "Untitled",
    type: list.itemTypeId,
    stage: "list",
    createdAt: new Date(),
    completed: false,
    lists: [list.id],
    attributes: { ...(list.defaultAttributeValues ?? {}), ...(extraAttributes ?? {}) },
    ...rest,
  }
  store.addTask(item)
  linkChild(operationId, OP_REL.hasPart, item.id)
  return item
}

/** Bulk add to the Tasks panel; `items` come from `parseListBulkAddText`. */
export function addOperationListTasks(
  operationId: string,
  items: { description: string; tags?: string[] }[],
): Task[] {
  const created: Task[] = []
  for (const item of items) {
    const task = addOperationListTask(operationId, item.description, {
      tags: item.tags?.length ? item.tags : undefined,
    })
    if (task) created.push(task)
  }
  return created
}

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
 * Attach Tracking-library tag ids (the join to daily habits) and refresh the
 * operation's Activity pen so "working on this now" paints with those tags.
 */
export function setOperationTrackingTags(operationId: string, tagIds: string[]): void {
  patchOperationAttributes(operationId, operationTrackingTagIdsAttribute(tagIds))
  const op = useTaskStore.getState().tasks.find((t) => t.id === operationId)
  if (op) ensureOperationPen(op)
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

/**
 * Put phase steps and part tasks that aren't filed yet onto the To do list,
 * so the big list and the Lists tab see the same work.
 */
export function fileLooseOperationTodos(operationId: string): void {
  const list = ensureOperationTaskList(operationId)
  if (!list) return
  const loose = collectOperationTodoTasks(operationId, useTaskStore.getState().tasks, null)
  for (const task of loose) {
    if ((task.lists ?? []).includes(list.id)) continue
    const current = useTaskStore.getState().tasks.find((t) => t.id === task.id)
    if (!current || (current.lists ?? []).includes(list.id)) continue
    useTaskStore.getState().updateTask({ ...current, lists: [...(current.lists ?? []), list.id] })
  }
}

function readFormulas(operationId: string): PartFormula[] {
  const op = useTaskStore.getState().tasks.find((t) => t.id === operationId)
  return readPartFormulas(op?.attributes?.[OPERATION_ATTR.partFormulas])
}

function readInstances(operationId: string): PartInstance[] {
  const op = useTaskStore.getState().tasks.find((t) => t.id === operationId)
  return readPartInstances(op?.attributes?.[OPERATION_ATTR.partInstances])
}

function writeFormulas(operationId: string, formulas: PartFormula[]): void {
  patchOperationAttributes(operationId, partFormulasAttribute(formulas))
}

function writeInstances(operationId: string, instances: PartInstance[]): void {
  patchOperationAttributes(operationId, partInstancesAttribute(instances))
}

function ensurePartTask(
  operationId: string,
  instance: PartInstance,
  role: PartTaskRole,
  label: string,
): void {
  const existing = partTaskFor(useTaskStore.getState().tasks, instance.id, role, label)
  if (existing) {
    const description = `${instance.title} — ${label}`
    if (existing.description !== description) {
      useTaskStore.getState().updateTask({ ...existing, description })
    }
    return
  }
  addOperationListTask(operationId, `${instance.title} — ${label}`, {
    attributes: {
      [PART_TASK_ATTR.instanceId]: instance.id,
      [PART_TASK_ATTR.role]: role,
      [PART_TASK_ATTR.label]: label,
      [PART_TASK_ATTR.operationId]: operationId,
    },
  })
}

/** Create any missing stage and finish tasks for every part of this operation. */
export function syncAllPartTasks(operationId: string): void {
  const formulas = readFormulas(operationId)
  const instances = readInstances(operationId)
  for (const instance of instances) {
    const formula = formulas.find((entry) => entry.id === instance.formulaId)
    if (!formula) continue
    for (const label of formula.stages) ensurePartTask(operationId, instance, "stage", label)
    for (const label of formula.finishSteps) ensurePartTask(operationId, instance, "finish", label)
  }
}

export interface SavePartFormulaInput {
  id?: string
  name: string
  parentFormulaId?: string | null
  stages?: string | string[]
  finishSteps?: string | string[]
}

/** Create or replace a part kind. New stages spawn tasks on existing parts. */
export function savePartFormula(operationId: string, input: SavePartFormulaInput): PartFormula | null {
  const name = input.name.trim()
  if (!name) return null
  const formulas = readFormulas(operationId)
  const id = input.id?.trim() || genId("kind")
  const descendants = formulaDescendantIds(formulas, id)
  const requestedParent = input.parentFormulaId?.trim() || null
  const parentFormulaId =
    requestedParent &&
    requestedParent !== id &&
    formulas.some((formula) => formula.id === requestedParent) &&
    !descendants.has(requestedParent)
      ? requestedParent
      : null
  const next: PartFormula = {
    id,
    name,
    parentFormulaId,
    stages: normalizePartLabels(input.stages ?? []),
    finishSteps: normalizePartLabels(input.finishSteps ?? []),
  }
  const exists = formulas.some((formula) => formula.id === id)
  writeFormulas(
    operationId,
    exists ? formulas.map((formula) => (formula.id === id ? next : formula)) : [...formulas, next],
  )
  syncAllPartTasks(operationId)
  return next
}

/** Remove a kind that has no parts and no child kinds. */
export function deletePartFormula(operationId: string, formulaId: string): boolean {
  const formulas = readFormulas(operationId)
  const instances = readInstances(operationId)
  if (instances.some((instance) => instance.formulaId === formulaId)) return false
  if (childFormulas(formulas, formulaId).length > 0) return false
  writeFormulas(
    operationId,
    formulas.filter((formula) => formula.id !== formulaId),
  )
  return true
}

/** Add one part of a kind. Nested kinds must name the parent part. */
export function addPartInstance(
  operationId: string,
  formulaId: string,
  title: string,
  parentInstanceId: string | null = null,
): PartInstance | null {
  const name = title.trim()
  if (!name) return null
  const formulas = readFormulas(operationId)
  const formula = formulas.find((entry) => entry.id === formulaId)
  if (!formula) return null
  const instances = readInstances(operationId)
  if (formula.parentFormulaId) {
    const parent = instances.find((instance) => instance.id === parentInstanceId)
    if (!parent || parent.formulaId !== formula.parentFormulaId) return null
  } else if (parentInstanceId) {
    return null
  }
  const instance: PartInstance = {
    id: genId("part"),
    formulaId,
    title: name,
    parentInstanceId: formula.parentFormulaId ? parentInstanceId : null,
    ideas: [],
  }
  writeInstances(operationId, [...instances, instance])
  syncAllPartTasks(operationId)
  return instance
}

export function renamePartInstance(operationId: string, instanceId: string, title: string): void {
  const name = title.trim()
  if (!name) return
  const instances = readInstances(operationId)
  const current = instances.find((instance) => instance.id === instanceId)
  if (!current || current.title === name) return
  writeInstances(
    operationId,
    instances.map((instance) => (instance.id === instanceId ? { ...instance, title: name } : instance)),
  )
  syncAllPartTasks(operationId)
}

/** Remove a part, the parts inside it, and the tasks those formulas spawned. */
export function deletePartInstance(operationId: string, instanceId: string): void {
  const instances = readInstances(operationId)
  const ids = new Set(instanceTreeIds(instances, instanceId))
  if (!ids.has(instanceId)) return
  writeInstances(
    operationId,
    instances.filter((instance) => !ids.has(instance.id)),
  )
  const store = useTaskStore.getState()
  for (const task of store.tasks) {
    const marked = String(task.attributes?.[PART_TASK_ATTR.instanceId] ?? "")
    if (marked && ids.has(marked)) store.deleteTask(task.id)
  }
}

/** An idea is a note on a part. It is not a task and does not join To do. */
export function addPartIdea(operationId: string, instanceId: string, text: string): void {
  const idea = text.trim()
  if (!idea) return
  const instances = readInstances(operationId)
  if (!instances.some((instance) => instance.id === instanceId)) return
  writeInstances(
    operationId,
    instances.map((instance) =>
      instance.id === instanceId
        ? {
            ...instance,
            ideas: [
              ...instance.ideas,
              { id: genId("idea"), text: idea, createdAt: new Date().toISOString() },
            ],
          }
        : instance,
    ),
  )
}

export function removePartIdea(operationId: string, instanceId: string, ideaId: string): void {
  const instances = readInstances(operationId)
  writeInstances(
    operationId,
    instances.map((instance) =>
      instance.id === instanceId
        ? { ...instance, ideas: instance.ideas.filter((idea) => idea.id !== ideaId) }
        : instance,
    ),
  )
}

/** Replace the Parts board's glance selection. An empty list hides every meter. */
export function setPartsGlance(operationId: string, labels: string[]): void {
  patchOperationAttributes(operationId, { [OPERATION_ATTR.partsGlance]: normalizePartLabels(labels) })
}

/**
 * Delete an operation and the work that belongs to it: phases, phase steps,
 * to-dos, part tasks, and the backing list. Attached resources are left alone.
 */
export function deleteOperation(operationId: string): void {
  const store = useTaskStore.getState()
  const tasks = store.tasks
  const op = tasks.find((t) => t.id === operationId)
  if (!op || op.type !== OPERATION_TYPE_ID) return

  const ids = new Set<string>([operationId])
  for (const phase of getPhases(operationId, tasks)) {
    ids.add(phase.id)
    for (const step of getParts(phase.id, tasks)) ids.add(step.id)
  }
  for (const part of getParts(operationId, tasks)) ids.add(part.id)
  for (const task of tasks) {
    if (String(task.attributes?.[PART_TASK_ATTR.operationId] ?? "") === operationId) ids.add(task.id)
  }

  const list = findOperationTaskList(op, store.lists)
  if (list) {
    for (const task of operationListTasks(list.id, tasks)) ids.add(task.id)
    store.removeListFromFolder(OPERATIONS_FOLDER_ID, list.id)
    useTaskStore.getState().deleteList(list.id)
  }

  const latest = useTaskStore.getState()
  for (const id of ids) latest.deleteTask(id)
}

function localDayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}
