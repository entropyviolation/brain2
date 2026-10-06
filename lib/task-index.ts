/**
 * lib/task-index.ts — In-memory indexes for the item vault
 *
 * Rebuilt when the tasks array identity changes. Tag lookup, backlinks, and
 * list membership should not rescan the vault on every read.
 */
import type { ItemRecord } from "@/lib/types"
import { normalizeTag } from "@/lib/links"

export type TaskIndex = {
  byId: Map<string, ItemRecord>
  byTag: Map<string, ItemRecord[]>
  byList: Map<string, ItemRecord[]>
  backlinks: Map<string, ItemRecord[]>
}

const empty: TaskIndex = {
  byId: new Map(),
  byTag: new Map(),
  byList: new Map(),
  backlinks: new Map(),
}

let source: ItemRecord[] | null = null
let index: TaskIndex = empty

function push(map: Map<string, ItemRecord[]>, key: string, item: ItemRecord) {
  const bucket = map.get(key)
  if (bucket) bucket.push(item)
  else map.set(key, [item])
}

export function taskIndexOf(tasks: ItemRecord[]): TaskIndex {
  if (source === tasks) return index
  source = tasks
  const byId = new Map<string, ItemRecord>()
  const byTag = new Map<string, ItemRecord[]>()
  const byList = new Map<string, ItemRecord[]>()
  const backlinks = new Map<string, ItemRecord[]>()
  for (const item of tasks) {
    byId.set(item.id, item)
    for (const listId of item.lists ?? []) push(byList, listId, item)
    for (const tag of item.tags ?? []) {
      const key = normalizeTag(tag)
      if (key) push(byTag, key, item)
    }
    for (const link of item.links ?? []) {
      if (link.targetId) push(backlinks, link.targetId, item)
    }
  }
  index = { byId, byTag, byList, backlinks }
  return index
}

export function tasksInList(tasks: ItemRecord[], listId: string): ItemRecord[] {
  return taskIndexOf(tasks).byList.get(listId) ?? []
}
