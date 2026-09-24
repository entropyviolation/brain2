/**
 * lib/item-selection.ts — Add/move selected items into a destination list
 */
import type { Folder, ItemTypeDefinition, List, Task } from "@/lib/types"
import { assignTaskToFolderList, isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { withListMembership } from "@/lib/item-utils"
import { isNaPeriodSmartCategoryId } from "@/lib/scheduled-lists-sync"

export type ItemPlacementMode = "keep" | "move"

/** Real user lists that can receive a multi-selection (excludes All Items / smart / current). */
export function destinationListsForSelection(
  lists: List[],
  opts: { currentListId?: string | null } = {},
): List[] {
  return lists
    .filter((list) => {
      if (isFolderAllItemsCategoryId(list.id)) return false
      if (isNaPeriodSmartCategoryId(list.id)) return false
      if (opts.currentListId && list.id === opts.currentListId) return false
      return true
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** List ids that the item-placement picker should hide (virtual + current). */
export function excludedListIdsForSelection(lists: List[], currentListId?: string | null): string[] {
  const allowed = new Set(destinationListsForSelection(lists, { currentListId }).map((l) => l.id))
  return lists.filter((l) => !allowed.has(l.id)).map((l) => l.id)
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
  if (isNaPeriodSmartCategoryId(listId)) return false
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

/** Strip `listId` from every item. Does not delete items; other lists stay. */
export function clearItemsFromList(tasks: Task[], listId: string): Task[] {
  return tasks.map((task) => removeTaskFromList(task, listId))
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
  if (unlink && unlink !== destListId) {
    next = removeTaskFromList(next, unlink)
  } else if (opts.mode === "move" && opts.canMove && !opts.originListId) {
    // No single origin (search / multi-home): keep dest, drop other movable memberships.
    for (const id of [...(next.lists ?? [])]) {
      if (id !== destListId && canMoveItemsFromOpenList(id)) {
        next = removeTaskFromList(next, id)
      }
    }
  }
  const dest = opts.lists.find((c) => c.id === destListId)
  return withListMembership(next, dest, opts.types ?? [])
}

/**
 * Place into one or more destination lists. Search-style move (no origin) keeps
 * every destination and drops other movable memberships in one pass.
 */
export function placeTaskIntoDestinationLists(
  task: Task,
  destListIds: string[],
  opts: {
    mode: ItemPlacementMode
    originListId?: string | null
    canMove: boolean
    lists: List[]
    folders: Folder[]
    types?: ItemTypeDefinition[]
  },
): Task {
  const unique = [...new Set(destListIds.filter(Boolean))]
  if (unique.length === 0) return task

  if (opts.mode === "move" && opts.canMove && !opts.originListId) {
    let next = task
    for (const destListId of unique) {
      next = addTaskToList(next, destListId, opts.folders)
      const dest = opts.lists.find((c) => c.id === destListId)
      next = withListMembership(next, dest, opts.types ?? [])
    }
    const keep = new Set(unique)
    for (const id of [...(next.lists ?? [])]) {
      if (!keep.has(id) && canMoveItemsFromOpenList(id)) {
        next = removeTaskFromList(next, id)
      }
    }
    return next
  }

  let next = task
  for (const destListId of unique) {
    next = placeTaskInList(next, destListId, opts)
  }
  return next
}
