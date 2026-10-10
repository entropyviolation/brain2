import type { Folder, Task, List } from "@/lib/types"
import { isFolderAllItemsCategoryId, getTasksForFolderAllView } from "@/lib/folder-all-items"
import { isPeriodLedgerListId, isScheduledFolderId, getTasksForScheduledFolder } from "@/lib/scheduled-lists-sync"
import { getRootFolders } from "@/lib/folder-tree"
import { navContainer } from "@/lib/lists-navigator"
import { ROOT_ALL_FOLDER_ID, SMART_LISTS, OBJECTIVES_LIST_ID } from "@/components/Lists/constants"
import { isFolderHiddenFromGlobalAll, isListHiddenFromGlobalAll, filterTasksHiddenFromGlobalAll } from "@/lib/module-lists"
import { isClearedFromWork } from "@/lib/completion-status"
import type { GridEntry, SmartId } from "@/components/Lists/types"

export interface BuildGridEntriesParams {
  isHome: boolean
  isAll: boolean
  currentFolder: Folder | null
  folders: Folder[]
  categories: List[]
  homePinned: string[]
  showSmartLists: boolean
  /** Global All only: when false, omit period To do / Done / Undone ledger lists. Default true. */
  showPeriodLedgerListsInAll?: boolean
  allTasks: Task[]
  getSmartTasks: (id: SmartId) => Task[]
  getTasksForCategory: (categoryId: string) => Task[]
  countForFolder: (f: Folder) => number
  objectiveCount?: number
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
    showPeriodLedgerListsInAll = true,
    allTasks,
    getSmartTasks,
    getTasksForCategory,
    countForFolder,
    objectiveCount = 0,
  } = params

  const objectivesEntry = (): GridEntry => ({
    kind: "objectives",
    id: OBJECTIVES_LIST_ID,
    name: "Objectives",
    color: "#d97706",
    count: objectiveCount,
  })

  const byKey = new Map<string, GridEntry>()

  const add = (entry: GridEntry) => {
    byKey.set(entryKey(entry), entry)
  }

  if (isHome) {
    add(objectivesEntry())
    add({ kind: "habits", id: "habits", name: "Daily Habits", color: "#0ea5e9", count: 0 })
    add({ kind: "habits", id: "weekly-habits", name: "Weekly Habits", color: "#6366f1", count: 0 })
    add({ kind: "habits", id: "monthly-habits", name: "Monthly Habits", color: "#9333ea", count: 0 })
    add({ kind: "habits", id: "season-habits", name: "Season Habits", color: "#c4622d", count: 0 })
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
    add(objectivesEntry())
    add({
      kind: "folder-all",
      id: "all-root",
      name: "All Items",
      color: "#64748b",
      count: filterTasksHiddenFromGlobalAll(
        allTasks.filter((t) => !isClearedFromWork(t)),
        categories,
        folders,
      ).length,
    })
    getRootFolders(folders)
      .filter((f) => !isFolderHiddenFromGlobalAll(f, folders))
      .forEach((f) =>
        add({ kind: "folder", id: f.id, name: f.name, color: f.color, icon: f.icon, count: countForFolder(f) }),
      )
    categories
      .filter((c) => {
        if (isFolderAllItemsCategoryId(c.id)) return false
        if (isListHiddenFromGlobalAll(c, folders)) return false
        if (!showPeriodLedgerListsInAll && isPeriodLedgerListId(c.id)) return false
        return true
      })
      .forEach((c) =>
        add({ kind: "list", id: c.id, name: c.name, color: c.color, icon: c.icon, count: getTasksForCategory(c.id).length }),
      )
  } else if (currentFolder) {
    const ordered = navContainer(categories, folders, { kind: "folder", id: currentFolder.id })
    const folderById = new Map(folders.map((folder) => [folder.id, folder]))
    const listById = new Map(categories.map((list) => [list.id, list]))
    const addOrdered = (ref: (typeof ordered)[number]) => {
      if (ref.kind === "folder") {
        const folder = folderById.get(ref.id)
        if (!folder) return
        add({ kind: "folder", id: folder.id, name: folder.name, color: folder.color, icon: folder.icon, count: countForFolder(folder) })
        return
      }
      const list = listById.get(ref.id)
      if (!list) return
      add({
        kind: "list",
        id: list.id,
        name: list.name,
        color: list.color,
        icon: list.icon,
        count: getTasksForCategory(list.id).length,
      })
    }
    const allCount = isScheduledFolderId(currentFolder.id)
      ? getTasksForScheduledFolder(allTasks, currentFolder.id).length
      : getTasksForFolderAllView(allTasks, currentFolder).length
    const allEntry = {
      kind: "folder-all" as const,
      id: `all-${currentFolder.id}`,
      name: "All Items",
      color: currentFolder.color,
      icon: currentFolder.icon,
      count: allCount,
    }
    if (!currentFolder.contentsOrder?.length) {
      ordered.filter((ref) => ref.kind === "folder").forEach(addOrdered)
      add(allEntry)
      ordered.filter((ref) => ref.kind === "list").forEach(addOrdered)
    } else {
      add(allEntry)
      ordered.forEach(addOrdered)
    }
  }

  return Array.from(byKey.values())
}

export { ROOT_ALL_FOLDER_ID }
