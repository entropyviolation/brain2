/**
 * lib/folder-all-items.ts — Per-folder "All Items" list helpers
 *
 * Each folder gets an auto-managed All Items category. Items can live there
 * uncategorized until filed into a specific list in the folder.
 */
import type { Task, List, Folder } from "@/lib/types"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { getDescendantIds } from "@/lib/list-tree"

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
