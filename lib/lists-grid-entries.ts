import type { CategoryFolder, Task, TaskCategory } from "@/lib/types"
import { isFolderAllItemsCategoryId, folderListCategoryIds, getTasksForFolderAllView } from "@/lib/folder-all-items"
import { isScheduledFolderId, getTasksForScheduledFolder } from "@/lib/scheduled-lists-sync"
import { ROOT_ALL_FOLDER_ID, SMART_LISTS } from "@/components/Lists/constants"
import type { GridEntry, SmartId } from "@/components/Lists/types"

export interface BuildGridEntriesParams {
  isHome: boolean
  isAll: boolean
  currentFolder: CategoryFolder | null
  folders: CategoryFolder[]
  categories: TaskCategory[]
  homePinned: string[]
  showSmartLists: boolean
  allTasks: Task[]
  getSmartTasks: (id: SmartId) => Task[]
  getTasksForCategory: (categoryId: string) => Task[]
  countForFolder: (f: CategoryFolder) => number
}

function entryKey(entry: GridEntry): string {
  return `${entry.kind}-${entry.id}`
}

/** Build folder/list grid entries without duplicates (Map keyed by kind-id). */
export function buildGridEntries(params: BuildGridEntriesParams): GridEntry[] {
  const {
    isHome,
    isAll,
    currentFolder,
    folders,
    categories,
    homePinned,
    showSmartLists,
    allTasks,
    getSmartTasks,
    getTasksForCategory,
    countForFolder,
  } = params

  const byKey = new Map<string, GridEntry>()

  const add = (entry: GridEntry) => {
    byKey.set(entryKey(entry), entry)
  }

  if (isHome) {
    add({ kind: "habits", id: "habits", name: "Daily Habits", color: "#0ea5e9", count: 0 })
    add({ kind: "habits", id: "weekly-habits", name: "Weekly Habits", color: "#6366f1", count: 0 })
    add({ kind: "habits", id: "monthly-habits", name: "Monthly Habits", color: "#9333ea", count: 0 })
    if (showSmartLists) {
      SMART_LISTS.forEach((s) =>
        add({ kind: "smart", id: s.id, name: s.name, color: s.color, count: getSmartTasks(s.id).length }),
      )
    }
    folders
      .filter((f) => homePinned.includes(f.id))
      .forEach((f) =>
        add({ kind: "folder", id: f.id, name: f.name, color: f.color, icon: f.icon, count: countForFolder(f) }),
      )
    categories
      .filter((c) => homePinned.includes(c.id))
      .forEach((c) =>
        add({ kind: "list", id: c.id, name: c.name, color: c.color, icon: c.icon, count: getTasksForCategory(c.id).length }),
      )
  } else if (isAll) {
    add({
      kind: "folder-all",
      id: "all-root",
      name: "All Items",
      color: "#64748b",
      count: allTasks.filter((t) => !t.completed).length,
    })
    folders.forEach((f) =>
      add({ kind: "folder", id: f.id, name: f.name, color: f.color, icon: f.icon, count: countForFolder(f) }),
    )
    categories
      .filter((c) => !isFolderAllItemsCategoryId(c.id))
      .forEach((c) =>
        add({ kind: "list", id: c.id, name: c.name, color: c.color, icon: c.icon, count: getTasksForCategory(c.id).length }),
      )
  } else if (currentFolder) {
    folders
      .filter((f) => f.parentFolderId === currentFolder.id)
      .forEach((f) =>
        add({ kind: "folder", id: f.id, name: f.name, color: f.color, icon: f.icon, count: countForFolder(f) }),
      )
    const folderListIds = folderListCategoryIds(currentFolder)
    const allCount = isScheduledFolderId(currentFolder.id)
      ? getTasksForScheduledFolder(allTasks, currentFolder.id).length
      : getTasksForFolderAllView(allTasks, currentFolder).length
    add({
      kind: "folder-all",
      id: `all-${currentFolder.id}`,
      name: "All Items",
      color: currentFolder.color,
      icon: currentFolder.icon,
      count: allCount,
    })
    categories
      .filter((c) => folderListIds.includes(c.id))
      .forEach((c) =>
        add({ kind: "list", id: c.id, name: c.name, color: c.color, icon: c.icon, count: getTasksForCategory(c.id).length }),
      )
  }

  return Array.from(byKey.values())
}

export { ROOT_ALL_FOLDER_ID }
