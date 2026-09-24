/**
 * lib/operation-parts.ts — Part formulas, instances, ideas, and glance meters
 *
 * A **part** is a piece of an operation with its own page. A **kind** is the
 * formula for that piece:
 *
 *   - Fashion Magazine has a kind "Issue" whose finish steps are ordered, then
 *     printed, and a child kind "Article" whose stages are drafted → written →
 *     formatted. An idea can sit on the issue or on one article.
 *   - Clean the house can be a kind "Room" with no stages at all — Living room,
 *     Bedroom — each still a page that can hold ideas.
 *
 * Formulas and instances (including ideas) live on the operation as JSON
 * attributes. Stages and finish steps are real tasks, so they join the To do
 * list. Ideas are not tasks.
 *
 * Pure: no store imports. Mutations live in `operation-actions.ts`.
 */
import type { Task } from "@/lib/types"
import { getParts, getPhases } from "@/lib/operations"

/** Attribute keys on the operation. Formulas and instances are JSON strings. */
export const PARTS_ATTR = {
  formulas: "partFormulas",
  instances: "partInstances",
  /** Labels to tally at a glance. Absent means every label. */
  glance: "partsGlance",
} as const

/** Attribute keys on a task spawned from a part formula. */
export const PART_TASK_ATTR = {
  instanceId: "partInstanceId",
  /** `"stage"` or `"finish"`. */
  role: "partTaskRole",
  label: "partTaskLabel",
  operationId: "partOperationId",
} as const

export type PartTaskRole = "stage" | "finish"

/** The repeating shape of one kind of part. */
export interface PartFormula {
  id: string
  /** Kind name, e.g. "Issue", "Article", "Room". */
  name: string
  /** When set, instances of this kind live inside an instance of that kind. */
  parentFormulaId: string | null
  /** Ordered work on every instance. Each name becomes a task. */
  stages: string[]
  /** Tasks that close the instance out (ordered, printed). */
  finishSteps: string[]
}

/** A note attached to one part. Not a task, and not on the To do list. */
export interface PartIdea {
  id: string
  text: string
  createdAt: string
}

/** One part: an issue, an article, a room. */
export interface PartInstance {
  id: string
  formulaId: string
  title: string
  /** The part this one sits inside, when the kind is nested. */
  parentInstanceId: string | null
  ideas: PartIdea[]
}

export interface GlanceMeter {
  label: string
  done: number
  total: number
}

export interface FormulaCount {
  id: string
  name: string
  count: number
}

const FINISHED_LABEL = "finished"

function unwrapJson(value: unknown): unknown {
  if (typeof value !== "string") return value
  const trimmed = value.trim()
  if (!trimmed) return []
  try {
    return JSON.parse(trimmed) as unknown
  } catch {
    return []
  }
}

function attrString(task: Pick<Task, "attributes">, key: string): string {
  const raw = task.attributes?.[key]
  return typeof raw === "string" ? raw : ""
}

/** Trim, drop blanks, de-duplicate case-insensitively, keep first-seen casing. */
export function normalizePartLabels(value: unknown): string[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[,\n]/)
      : []
  const seen = new Set<string>()
  const out: string[] = []
  for (const entry of raw) {
    if (typeof entry !== "string") continue
    const name = entry.trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

/** Parse formulas from a JSON string or a raw array. Drops cycles and missing parents. */
export function readPartFormulas(value: unknown): PartFormula[] {
  const raw = unwrapJson(value)
  if (!Array.isArray(raw)) return []
  const draft: PartFormula[] = []
  const ids = new Set<string>()
  for (const entry of raw) {
    const record = asRecord(entry)
    if (!record) continue
    const id = typeof record.id === "string" ? record.id.trim() : ""
    const name = typeof record.name === "string" ? record.name.trim() : ""
    if (!id || !name || ids.has(id)) continue
    ids.add(id)
    const parent = typeof record.parentFormulaId === "string" ? record.parentFormulaId.trim() : ""
    draft.push({
      id,
      name,
      parentFormulaId: parent || null,
      stages: normalizePartLabels(record.stages),
      finishSteps: normalizePartLabels(record.finishSteps),
    })
  }
  const byId = new Map(draft.map((formula) => [formula.id, formula]))
  return draft.map((formula) => ({
    ...formula,
    parentFormulaId: safeParent(formula.id, formula.parentFormulaId, byId),
  }))
}

function safeParent(
  id: string,
  parentId: string | null,
  byId: Map<string, PartFormula>,
): string | null {
  if (!parentId || parentId === id || !byId.has(parentId)) return null
  const seen = new Set<string>([id])
  let cursor: string | null = parentId
  while (cursor) {
    if (seen.has(cursor)) return null
    seen.add(cursor)
    cursor = byId.get(cursor)?.parentFormulaId ?? null
  }
  return parentId
}

/** Parse instances (and their ideas) from a JSON string or a raw array. */
export function readPartInstances(value: unknown): PartInstance[] {
  const raw = unwrapJson(value)
  if (!Array.isArray(raw)) return []
  const out: PartInstance[] = []
  const ids = new Set<string>()
  for (const entry of raw) {
    const record = asRecord(entry)
    if (!record) continue
    const id = typeof record.id === "string" ? record.id.trim() : ""
    const formulaId = typeof record.formulaId === "string" ? record.formulaId.trim() : ""
    const title = typeof record.title === "string" ? record.title.trim() : ""
    if (!id || !formulaId || !title || ids.has(id)) continue
    ids.add(id)
    const parent = typeof record.parentInstanceId === "string" ? record.parentInstanceId.trim() : ""
    out.push({
      id,
      formulaId,
      title,
      parentInstanceId: parent || null,
      ideas: readIdeas(record.ideas),
    })
  }
  const idSet = new Set(out.map((instance) => instance.id))
  return out.map((instance) => ({
    ...instance,
    parentInstanceId:
      instance.parentInstanceId && idSet.has(instance.parentInstanceId) && instance.parentInstanceId !== instance.id
        ? instance.parentInstanceId
        : null,
  }))
}

function readIdeas(value: unknown): PartIdea[] {
  if (!Array.isArray(value)) return []
  const out: PartIdea[] = []
  const ids = new Set<string>()
  for (const entry of value) {
    const record = asRecord(entry)
    if (!record) continue
    const id = typeof record.id === "string" ? record.id.trim() : ""
    const text = typeof record.text === "string" ? record.text.trim() : ""
    if (!id || !text || ids.has(id)) continue
    ids.add(id)
    out.push({
      id,
      text,
      createdAt: typeof record.createdAt === "string" ? record.createdAt : "",
    })
  }
  return out
}

export function partFormulasAttribute(formulas: PartFormula[]): Record<string, string> {
  return { [PARTS_ATTR.formulas]: JSON.stringify(readPartFormulas(formulas)) }
}

export function partInstancesAttribute(instances: PartInstance[]): Record<string, string> {
  return { [PARTS_ATTR.instances]: JSON.stringify(readPartInstances(instances)) }
}

/** Ids of kinds nested under `id`, not including `id`. */
export function formulaDescendantIds(formulas: PartFormula[], id: string): Set<string> {
  const children = new Map<string, string[]>()
  for (const formula of formulas) {
    if (!formula.parentFormulaId) continue
    const list = children.get(formula.parentFormulaId) ?? []
    list.push(formula.id)
    children.set(formula.parentFormulaId, list)
  }
  const out = new Set<string>()
  const walk = (current: string) => {
    for (const child of children.get(current) ?? []) {
      if (out.has(child)) continue
      out.add(child)
      walk(child)
    }
  }
  walk(id)
  return out
}

export function topLevelFormulas(formulas: PartFormula[]): PartFormula[] {
  return formulas.filter((formula) => !formula.parentFormulaId)
}

export function childFormulas(formulas: PartFormula[], parentFormulaId: string): PartFormula[] {
  return formulas.filter((formula) => formula.parentFormulaId === parentFormulaId)
}

export function instancesOf(
  instances: PartInstance[],
  formulaId: string,
  parentInstanceId: string | null,
): PartInstance[] {
  return instances.filter(
    (instance) => instance.formulaId === formulaId && instance.parentInstanceId === parentInstanceId,
  )
}

/** This part and every part nested inside it. */
export function instanceTreeIds(instances: PartInstance[], rootId: string): string[] {
  const ids: string[] = []
  const walk = (id: string) => {
    ids.push(id)
    for (const child of instances) {
      if (child.parentInstanceId === id) walk(child.id)
    }
  }
  walk(rootId)
  return ids
}

export function formulaCounts(formulas: PartFormula[], instances: PartInstance[]): FormulaCount[] {
  return formulas.map((formula) => ({
    id: formula.id,
    name: formula.name,
    count: instances.filter((instance) => instance.formulaId === formula.id).length,
  }))
}

/** Stage and finish labels, in first-seen order, plus "finished" when that word is free. */
export function glanceLabelUniverse(formulas: PartFormula[]): string[] {
  const labels = normalizePartLabels(formulas.flatMap((formula) => [...formula.stages, ...formula.finishSteps]))
  if (labels.some((label) => label.toLowerCase() === FINISHED_LABEL)) return labels
  return [...labels, FINISHED_LABEL]
}

/**
 * Which glance labels to show. `stored === null` (attribute absent) means all
 * of them. A stored array, including empty, is an explicit choice.
 */
export function resolveGlanceSelection(stored: unknown, universe: string[]): string[] {
  if (stored == null) return universe
  if (!Array.isArray(stored)) return universe
  const wanted = new Set(
    stored.filter((entry): entry is string => typeof entry === "string").map((entry) => entry.trim().toLowerCase()),
  )
  return universe.filter((label) => wanted.has(label.toLowerCase()))
}

function formulaHasLabel(formula: PartFormula | undefined, label: string): boolean {
  if (!formula) return false
  const key = label.toLowerCase()
  return [...formula.stages, ...formula.finishSteps].some((entry) => entry.toLowerCase() === key)
}

export function partTaskFor(
  tasks: Task[],
  instanceId: string,
  role: PartTaskRole,
  label: string,
): Task | undefined {
  const key = label.toLowerCase()
  return tasks.find(
    (task) =>
      attrString(task, PART_TASK_ATTR.instanceId) === instanceId &&
      attrString(task, PART_TASK_ATTR.role) === role &&
      attrString(task, PART_TASK_ATTR.label).toLowerCase() === key,
  )
}

export function instanceTaskProgress(
  instance: PartInstance,
  formula: PartFormula | undefined,
  tasks: Task[],
): { done: number; total: number } {
  if (!formula) return { done: 0, total: 0 }
  const slots: { role: PartTaskRole; label: string }[] = [
    ...formula.stages.map((label) => ({ role: "stage" as const, label })),
    ...formula.finishSteps.map((label) => ({ role: "finish" as const, label })),
  ]
  const done = slots.filter((slot) => partTaskFor(tasks, instance.id, slot.role, slot.label)?.completed).length
  return { done, total: slots.length }
}

function instanceIsFinished(instance: PartInstance, formula: PartFormula | undefined, tasks: Task[]): boolean {
  const progress = instanceTaskProgress(instance, formula, tasks)
  return progress.total > 0 && progress.done === progress.total
}

/** Completion counts for the labels the parts board is showing. */
export function glanceMeters(
  formulas: PartFormula[],
  instances: PartInstance[],
  tasks: Task[],
  selection: string[],
): GlanceMeter[] {
  const byId = new Map(formulas.map((formula) => [formula.id, formula]))
  const stepKeys = new Set(
    formulas.flatMap((formula) => [...formula.stages, ...formula.finishSteps]).map((label) => label.toLowerCase()),
  )
  return selection
    .map((label) => {
      if (label.toLowerCase() === FINISHED_LABEL && !stepKeys.has(FINISHED_LABEL)) {
        const relevant = instances.filter((instance) => {
          const formula = byId.get(instance.formulaId)
          return !!formula && formula.stages.length + formula.finishSteps.length > 0
        })
        return {
          label,
          total: relevant.length,
          done: relevant.filter((instance) => instanceIsFinished(instance, byId.get(instance.formulaId), tasks)).length,
        }
      }
      const relevant = instances.filter((instance) => formulaHasLabel(byId.get(instance.formulaId), label))
      const done = relevant.filter((instance) =>
        tasks.some(
          (task) =>
            attrString(task, PART_TASK_ATTR.instanceId) === instance.id &&
            attrString(task, PART_TASK_ATTR.label).toLowerCase() === label.toLowerCase() &&
            task.completed,
        ),
      ).length
      return { label, done, total: relevant.length }
    })
    .filter((meter) => meter.total > 0)
}

/**
 * Tasks that belong on the operation's To do list: the list itself, checklist
 * steps of each phase, and stage/finish tasks from parts. Ideas are not here.
 * De-duplicated. The operation itself is excluded.
 */
export function collectOperationTodoTasks(
  operationId: string,
  allTasks: Task[],
  listId: string | null,
): Task[] {
  const seen = new Set<string>()
  const out: Task[] = []
  const add = (task: Task | undefined) => {
    if (!task || task.id === operationId || seen.has(task.id)) return
    if (task.type === "operation") return
    seen.add(task.id)
    out.push(task)
  }
  if (listId) {
    for (const task of allTasks) {
      if ((task.lists ?? []).includes(listId)) add(task)
    }
  }
  for (const step of getParts(operationId, allTasks)) add(step)
  for (const phase of getPhases(operationId, allTasks)) {
    for (const step of getParts(phase.id, allTasks)) add(step)
  }
  for (const task of allTasks) {
    if (attrString(task, PART_TASK_ATTR.operationId) === operationId) add(task)
  }
  return out
}
