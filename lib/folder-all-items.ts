/**
 * lib/folder-all-items.ts — Per-folder "All Items" list helpers
 *
 * Each folder gets an auto-managed All Items category. Items can live there
 * uncategorized until filed into a specific list in the folder.
 */
import type { Task, List, Folder } from "@/lib/types"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { getDescendantIds } from "@/lib/list-tree"
import { getFolderDescendantIds, getRootFolders, isAutoScheduledPeriodFolder } from "@/lib/folder-tree"

export const FOLDER_ALL_PREFIX = "__all-items__"

export function folderAllItemsCategoryId(folderId: string): string {
  return `${FOLDER_ALL_PREFIX}${folderId}`
}

export function isFolderAllItemsCategoryId(id: string): boolean {
  return id.startsWith(FOLDER_ALL_PREFIX)
}

type FolderMutators = {
  lists: List[]
  folders: Folder[]
  addList: (c: List) => void
  updateList: (c: List) => void
  updateFolder: (f: Folder) => void
}

/** Ensure every folder has a backing All Items category registered on the folder. */
export function syncFolderAllItemsCategories(mut: FolderMutators): void {
  for (const folder of mut.folders) {
    if (isScheduledFolderId(folder.id)) continue
    const allId = folderAllItemsCategoryId(folder.id)
    const existing = mut.lists.find((c) => c.id === allId)
    if (!existing) {
      mut.addList({
        id: allId,
        name: "All Items",
        color: folder.color || "#64748b",
        description: "All items in this folder",
        createdAt: new Date(),
        scheduleable: folder.scheduleable !== false,
      })
    }
    if (!folder.listIds.includes(allId)) {
      mut.updateFolder({
        ...folder,
        listIds: [allId, ...folder.listIds.filter((id) => id !== allId)],
      })
    }
  }
}

export function folderListCategoryIds(folder: Folder): string[] {
  return folder.listIds.filter((id) => !isFolderAllItemsCategoryId(id))
}

/**
 * The folder's list ids, expanded to include nested sublists (categories whose
 * `parentListId` chain leads back to a list in the folder). Passing
 * `categories` opts a folder's All view into nested-category membership
 * (Feature 8); omitting it preserves the flat, pre-nesting behavior.
 */
export function folderListCategoryIdsDeep(
  folder: Folder,
  categories?: List[],
): string[] {
  const listIds = folderListCategoryIds(folder)
  if (!categories || categories.length === 0) return listIds
  const expanded = new Set(listIds)
  for (const id of listIds) {
    for (const descId of getDescendantIds(categories, id)) expanded.add(descId)
  }
  return [...expanded]
}

export function taskInFolder(task: Task, folder: Folder, categories?: List[]): boolean {
  const allId = folderAllItemsCategoryId(folder.id)
  const listIds = folderListCategoryIdsDeep(folder, categories)
  const cats = task.lists ?? []
  if (cats.includes(allId)) return true
  return listIds.some((id) => cats.includes(id))
}

export function isTaskUncategorizedInFolder(
  task: Task,
  folder: Folder,
  categories?: List[],
): boolean {
  const allId = folderAllItemsCategoryId(folder.id)
  const listIds = folderListCategoryIdsDeep(folder, categories)
  const cats = task.lists ?? []
  if (!cats.includes(allId)) return false
  return !listIds.some((id) => cats.includes(id))
}

/**
 * Global All Items analog of folder uncategorized: not filed into any real list.
 * Empty membership or only folder All Items pool ids count as uncategorized.
 */
export function isTaskUncategorizedGlobally(task: Task): boolean {
  const cats = task.lists ?? []
  if (cats.length === 0) return true
  return cats.every((id) => isFolderAllItemsCategoryId(id))
}

export function getTasksForFolderAllView(
  tasks: Task[],
  folder: Folder,
  categories?: List[],
): Task[] {
  const allId = folderAllItemsCategoryId(folder.id)
  const listIds = folderListCategoryIdsDeep(folder, categories)
  return tasks.filter((t) => {
    if (t.completed) return false
    const cats = t.lists ?? []
    return cats.includes(allId) || listIds.some((id) => cats.includes(id))
  })
}

/** Lists in a folder (excluding All Items) in folder order, resolved from `categories`. */
export function listsInFolderForFilter(folder: Folder, categories: List[]): List[] {
  const byId = new Map(categories.map((c) => [c.id, c]))
  const out: List[] = []
  for (const id of folderListCategoryIds(folder)) {
    const list = byId.get(id)
    if (list) out.push(list)
  }
  return out
}

/**
 * Display-only filter for a folder's All Items view (every display mode).
 * Hidden list ids are omitted from this view; membership is not changed.
 * An item stays visible if it belongs to any non-hidden folder list, or if it
 * is uncategorized in the folder (no folder list membership).
 */
export function filterTasksByHiddenFolderLists(
  tasks: Task[],
  folder: Folder,
  hiddenListIds: string[],
  categories?: List[],
): Task[] {
  if (!hiddenListIds.length) return tasks
  const hidden = new Set(hiddenListIds)
  const folderListIds = folderListCategoryIdsDeep(folder, categories)
  return tasks.filter((t) => {
    const inFolderLists = (t.lists ?? []).filter((id) => folderListIds.includes(id))
    if (inFolderLists.length === 0) return true
    return inFolderLists.some((id) => !hidden.has(id))
  })
}

/** Root folders shown as Global All Items filter checkboxes (excludes auto period folders). */
export function foldersInGlobalAllForFilter(folders: Folder[]): Folder[] {
  return getRootFolders(folders).filter((f) => !isAutoScheduledPeriodFolder(f.id))
}

/**
 * Display-only filter for the global All Items view (every display mode).
 * Hidden folder ids omit items that belong only to that folder tree.
 * Membership is not changed. Items with no folder, or that also belong to a
 * still-selected folder, stay visible.
 */
export function filterTasksByHiddenGlobalFolders(
  tasks: Task[],
  folders: Folder[],
  hiddenFolderIds: string[],
  categories?: List[],
): Task[] {
  if (!hiddenFolderIds.length) return tasks
  const hidden = new Set(hiddenFolderIds)
  for (const id of hiddenFolderIds) {
    for (const descId of getFolderDescendantIds(folders, id)) hidden.add(descId)
  }
  return tasks.filter((t) => {
    const inFolders = folders.filter((f) => taskInFolder(t, f, categories))
    if (inFolders.length === 0) return true
    return inFolders.some((f) => !hidden.has(f.id))
  })
}

/** Place a task in the folder's All Items pool without assigning a specific list. */
export function assignTaskToFolderUncategorized(task: Task, folder: Folder): Task {
  const allId = folderAllItemsCategoryId(folder.id)
  const listIds = folderListCategoryIds(folder)
  const cats = (task.lists ?? []).filter(
    (id) => !listIds.includes(id) && !isFolderAllItemsCategoryId(id),
  )
  if (!cats.includes(allId)) cats.push(allId)
  return { ...task, lists: cats, stage: "clarified" }
}

/** File a task into a specific list, removing uncategorized folder membership. */
export function assignTaskToFolderList(task: Task, folder: Folder, listId: string): Task {
  const allId = folderAllItemsCategoryId(folder.id)
  const cats = [...(task.lists ?? [])]
  if (!cats.includes(listId)) cats.push(listId)
  return { ...task, lists: cats.filter((id) => id !== allId), stage: "clarified" }
}
