/**
 * lib/text-list-to-list.ts — Text-list reorder and “Make Brain2 List”.
 *
 * Pure. The item stores the new list’s id on `textListIds`; names can diverge.
 */
import type { List, Task } from "@/lib/types"

/** Remember which Brain2 list a text-list attribute made. Names stay independent. */
export function withTextListId(task: Task, attributeId: string, listId: string): Task {
  return { ...task, textListIds: { ...task.textListIds, [attributeId]: listId } }
}

function withoutTextListId(task: Task, attributeId: string): Pick<Task, "textListIds"> {
  if (!task.textListIds || !(attributeId in task.textListIds)) return {}
  const textListIds = { ...task.textListIds }
  delete textListIds[attributeId]
  return { textListIds: Object.keys(textListIds).length ? textListIds : undefined }
}

/**
 * An item-only text list becomes a list reference whose value is the new list.
 * A shared definition is left alone (changing it would rewrite every item);
 * the join stays on `textListIds`.
 */
export function asListReference(task: Task, attributeId: string, listId: string): Task {
  const owns = task.itemAttributeDefinitions?.some((def) => def.id === attributeId)
  if (!owns) return withTextListId(task, attributeId, listId)
  return {
    ...task,
    attributes: { ...(task.attributes ?? {}), [attributeId]: listId },
    itemAttributeDefinitions: task.itemAttributeDefinitions!.map((def) =>
      def.id === attributeId ? { ...def, type: "list" } : def,
    ),
    ...withoutTextListId(task, attributeId),
  }
}

/** Move `from` to `to`. Same reference when the indexes are equal or out of range. */
export function reorderStrings(items: string[], from: number, to: number): string[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items
  const next = items.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

function randomSlice(): string {
  return Math.random().toString(36).slice(2, 8)
}

/** One clarified item per non-empty trimmed line. Blank lines are skipped; duplicates stay. */
export function textListToBrainList(name: string, lines: string[]): { list: List; items: Task[] } {
  const now = Date.now()
  const base = now.toString(36)
  const list: List = {
    id: `list-${base}-${randomSlice()}`,
    name: name.trim() || "List",
    color: "#5b8def",
    createdAt: new Date(),
    scheduleable: false,
  }
  const items: Task[] = []
  let index = 0
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    items.push({
      id: `item-${base}-${index}-${randomSlice()}`,
      description: line,
      title: line,
      stage: "clarified",
      type: "item",
      createdAt: new Date(now + index),
      completed: false,
      lists: [list.id],
      tags: [],
      links: [],
      subtasks: [],
      rewardValue: 1,
    })
    index += 1
  }
  return { list, items }
}
