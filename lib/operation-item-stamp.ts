/**
 * lib/operation-item-stamp.ts — Keep operations typed as Operation items
 *
 * An operation is already a task. This pass only fills a blank or generic
 * `item` type when the record is unmistakably an operation (it carries an
 * operation-only attribute). It never inserts a second item. Running it twice
 * returns the same array.
 */
import type { Task } from "@/lib/types"
import { OPERATION_ATTR, OPERATION_TYPE_ID } from "@/lib/operation-types"
import { COMPUTER_PROJECT_TYPE_ID } from "@/lib/computer-project-types"

const OPERATION_MARKS = [
  OPERATION_ATTR.taskListId,
  OPERATION_ATTR.partFormulas,
  OPERATION_ATTR.partInstances,
  OPERATION_ATTR.itineraryModuleId,
  OPERATION_ATTR.trackingPenId,
  OPERATION_ATTR.panels,
] as const

function markedOperation(task: Task): boolean {
  const attrs = task.attributes
  if (!attrs) return false
  return OPERATION_MARKS.some((id) => {
    const value = attrs[id]
    if (value == null || value === "") return false
    if (Array.isArray(value)) return value.length > 0
    return true
  })
}

export function stampUntypedOperations<T extends Task>(tasks: T[]): T[] {
  let changed = false
  const next = tasks.map((task) => {
    if (task.type === OPERATION_TYPE_ID || task.type === COMPUTER_PROJECT_TYPE_ID) return task
    if (task.type && task.type !== "item") return task
    if (!markedOperation(task)) return task
    changed = true
    return { ...task, type: OPERATION_TYPE_ID }
  })
  return changed ? next : tasks
}
