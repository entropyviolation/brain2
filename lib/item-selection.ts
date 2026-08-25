/**
 * lib/item-selection.ts — Add/move selected items into a destination list
 */
import type { Folder, ItemTypeDefinition, List, Task } from "@/lib/types"
import { assignTaskToFolderList, isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { withListMembership } from "@/lib/item-utils"
import { isNaSmartCategoryId } from "@/lib/scheduled-lists-sync"

export type ItemPlacementMode = "keep" | "move"

/** Real user lists that can receive a multi-selection (excludes All Items / smart / current). */
export function destinationListsForSelection(
  lists: List[],
  opts: { currentListId?: string | null } = {},
): List[] {
  return lists
    .filter((list) => {
      if (isFolderAllItemsCategoryId(list.id)) return false
      if (isNaSmartCategoryId(list.id)) return false
      if (opts.currentListId && list.id === opts.currentListId) return false
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Origin list to unlink when placing items.
 * Smart lists, folder All Items, and views with no owning list cannot unlink.
 */
export function originListIdToUnlink(opts: {
  mode: ItemPlacementMode
  originListId?: string | null
  canMove: boolean
}): string | null {
  if (opts.mode !== "move") return null
  if (!opts.canMove) return null
  return opts.originListId ?? null
}

export function canMoveItemsFromOpenList(listId?: string | null): boolean {
  if (!listId) return false
  if (isFolderAllItemsCategoryId(listId)) return false
  if (isNaSmartCategoryId(listId)) return false
  return true
}

export function addTaskToList(task: Task, listId: string, folders: Folder[]): Task {
  const folder = folders.find((f) => f.listIds.includes(listId) && !isFolderAllItemsCategoryId(listId))
  if (folder) return assignTaskToFolderList(task, folder, listId)
  if ((task.lists ?? []).includes(listId)) return task
  return { ...task, lists: [...(task.lists ?? []), listId], stage: "clarified" }
}

export function removeTaskFromList(task: Task, listId: string): Task {
  const lists = (task.lists ?? []).filter((id) => id !== listId)
  if (lists.length === (task.lists ?? []).length) return task
  return { ...task, lists }
}

export function placeTaskInList(
  task: Task,
  destListId: string,
  opts: {
    mode: ItemPlacementMode
    originListId?: string | null
    canMove: boolean
    lists: List[]
    folders: Folder[]
    types?: ItemTypeDefinition[]
  },
): Task {
  let next = addTaskToList(task, destListId, opts.folders)
  const unlink = originListIdToUnlink({
    mode: opts.mode,
    originListId: opts.originListId,
    canMove: opts.canMove,
  })
  if (unlink && unlink !== destListId) next = removeTaskFromList(next, unlink)
  const dest = opts.lists.find((c) => c.id === destListId)
  return withListMembership(next, dest, opts.types ?? [])
}
