/**
 * lib/structure-edges.ts — Where an item sits, as Links tab edges
 *
 * Nesting is already stored on the item (`parentTaskId`, `stepOf`,
 * `subtasks`, `penLinks`, `lists`). The Links tab reads it as derived edges so
 * making a subtask, joining a pen or filing in a list shows up there without
 * anyone adding a link by hand. Nothing here is stored; edit the real field
 * and the edge follows.
 *
 * - Up: the parent step's item and the parent task (`part-of`).
 * - Down: each subtask (`has-part`). A step with no item yet is a virtual
 *   `step:` node; opening it makes the item (`openStepItem`).
 * - Tracking pens: the item's own `penLinks`, else the ones a step inherits
 *   from the nearest parent step or task. Virtual `pen:` nodes.
 * - Lists: virtual `list:` nodes.
 *
 * Virtual nodes are not tasks. `parseNodeId` tells the Links tab how to name
 * and open them. Edges carry `derivedFrom: STRUCTURE_SOURCE`.
 */
import { edgeKey, relationFamily, type EgoEdge } from "@/lib/link-graph"
import { findStepItem } from "@/lib/step-items"
import { stepPenLinks } from "@/lib/task-clock"
import type { Subtask, Task } from "@/lib/types"

export const STRUCTURE_SOURCE = "structure"

export type NodeRef =
  | { kind: "step"; taskId: string; stepId: string }
  | { kind: "pen"; penId: string }
  | { kind: "list"; listId: string }

export const stepNodeId = (taskId: string, stepId: string) => `step:${taskId}:${stepId}`
export const penNodeId = (penId: string) => `pen:${penId}`
export const listNodeId = (listId: string) => `list:${listId}`

/** A virtual node's meaning, or null for a real item id. */
export function parseNodeId(id: string): NodeRef | null {
  if (id.startsWith("pen:")) return { kind: "pen", penId: id.slice(4) }
  if (id.startsWith("list:")) return { kind: "list", listId: id.slice(5) }
  if (id.startsWith("step:")) {
    const [taskId, stepId] = id.slice(5).split(":")
    return taskId && stepId ? { kind: "step", taskId, stepId } : null
  }
  return null
}

function edge(otherId: string, relation: string, label?: string): EgoEdge {
  return {
    key: edgeKey(otherId, relation),
    otherId,
    relation,
    direction: "derived",
    family: relationFamily(relation),
    derivedFrom: STRUCTURE_SOURCE,
    ...(label ? { label } : {}),
  }
}

/** The step's chain of ancestors inside `subtasks`, outermost first. */
function stepTrail(steps: readonly Subtask[] | undefined, stepId: string): Subtask[] {
  const trail: Subtask[] = []
  const walk = (list: readonly Subtask[] | undefined): boolean => {
    for (const s of list ?? []) {
      trail.push(s)
      if (s.id === stepId || walk(s.subtasks)) return true
      trail.pop()
    }
    return false
  }
  walk(steps)
  return trail
}

/** Ids that still exist. A pen or list that was deleted leaves no edge. */
export interface StructureKnown {
  listIds: ReadonlySet<string>
  penIds: ReadonlySet<string>
}

export function structureEdges(task: Task, tasks: readonly Task[], known: StructureKnown): EgoEdge[] {
  const out: EgoEdge[] = []
  const seen = new Set<string>()
  const push = (e: EgoEdge) => {
    if (e.otherId === task.id || seen.has(e.key)) return
    seen.add(e.key)
    out.push(e)
  }

  const parentId = task.stepOf?.taskId ?? task.parentTaskId
  const parent = parentId ? tasks.find((t) => t.id === parentId) : undefined

  if (task.stepOf && parent) {
    // Nearest enclosing step that already has an item, then the task itself.
    const trail = stepTrail(parent.subtasks, task.stepOf.stepId).slice(0, -1)
    for (let i = trail.length - 1; i >= 0; i--) {
      const item = findStepItem(tasks, parent.id, trail[i].id)
      push(edge(item ? item.id : stepNodeId(parent.id, trail[i].id), "part-of", "step of"))
    }
  }
  if (parent) push(edge(parent.id, "part-of", task.stepOf ? "step of" : "subtask of"))

  // Steps inside this item: its own tree, or the parent's step when this is a step item.
  const ownerId = task.stepOf ? task.stepOf.taskId : task.id
  const inside: readonly Subtask[] = task.stepOf
    ? (stepTrail(parent?.subtasks, task.stepOf.stepId).at(-1)?.subtasks ?? [])
    : (task.subtasks ?? [])
  for (const step of inside) {
    const item = findStepItem(tasks, ownerId, step.id)
    push(edge(item ? item.id : stepNodeId(ownerId, step.id), "has-part", "has step"))
  }
  // Older subtasks that live only as child tasks.
  if (!task.stepOf) {
    const known = new Set(inside.map((s) => s.id))
    for (const child of tasks) {
      if (child.parentTaskId === task.id && !child.stepOf && !known.has(child.id)) push(edge(child.id, "has-part", "has subtask"))
    }
  }

  const pens = task.penLinks ?? (task.stepOf && parent ? stepPenLinks(parent, task.stepOf.stepId).links : [])
  for (const link of pens) if (known.penIds.has(link.penId)) push(edge(penNodeId(link.penId), "related", "tracked with pen"))

  for (const listId of task.lists ?? []) if (known.listIds.has(listId)) push(edge(listNodeId(listId), "part-of", "in list"))
  return out
}
