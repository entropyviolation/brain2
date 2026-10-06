/**
 * lib/lists-duplicate.ts — Duplicate folders/lists (settings vs settings+contents)
 *
 * Pure planners + name helpers. Store writes stay in the Lists UI so selection,
 * filing, and parent links go through the same paths as New Folder / New List.
 */
import type { Folder, List, Task } from "@/lib/types"
import { getFolderChildren, getFolderDescendantIds } from "@/lib/folder-tree"
import { wouldCreateFolderCycle } from "@/lib/folder-selection"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { isAutoScheduledPeriodFolder, isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { directFolderIdsForList } from "@/lib/folder-membership"

export type DuplicateScope = "settings" | "settings_and_contents"

/** Trimmed non-empty names, one per line (bulk create folders/lists). */
export function parseBulkCreateNames(text: string): string[] {
  return String(text || "")
    .split(/\r\n|\r|\n|\u2028|\u2029/)
    .map((line) => line.trim())
    .filter(Boolean)
}

/** "Name copy", then "Name copy 2", … until unused among existing names. */
export function disambiguatedCopyName(baseName: string, existingNames: Iterable<string>): string {
  const base = (baseName || "Untitled").trim() || "Untitled"
  const taken = new Set(
    [...existingNames].map((n) => n.trim().toLowerCase()).filter(Boolean),
  )
  const first = `${base} copy`
  if (!taken.has(first.toLowerCase())) return first
  let n = 2
  while (taken.has(`${base} copy ${n}`.toLowerCase())) n += 1
  return `${base} copy ${n}`
}

export function isAutoCreatedFolder(folder: Pick<Folder, "id" | "createdByModuleId">): boolean {
  return (
    Boolean(folder.createdByModuleId) ||
    isAutoScheduledPeriodFolder(folder.id) ||
    isScheduledFolderId(folder.id)
  )
}

export function isAutoCreatedList(list: Pick<List, "id" | "createdByModuleId">): boolean {
  return Boolean(list.createdByModuleId) || isFolderAllItemsCategoryId(list.id)
}

function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** Settings fields copied onto a new folder (never auto / never aliases contents). */
export function folderSettingsClone(
  source: Folder,
  opts: { id: string; name: string; parentFolderId?: string },
): Folder {
  return {
    id: opts.id,
    name: opts.name,
    createdAt: new Date(),
    listIds: [],
    parentFolderId: opts.parentFolderId,
    color: source.color,
    description: source.description,
    scheduleable: source.scheduleable,
    icon: source.icon,
    hiddenFromGlobalAll: source.hiddenFromGlobalAll,
    // copies are user-created
  }
}

/** Settings fields copied onto a new list (no module auto flag, no links). */
export function listSettingsClone(
  source: List,
  opts: { id: string; name: string; order?: number; parentListId?: string },
): List {
  const {
    id: _id,
    name: _name,
    createdAt: _createdAt,
    createdByModuleId: _auto,
    linkedTargetListIds: _links,
    parentListId: _parent,
    order: _order,
    ...rest
  } = source
  return {
    ...rest,
    id: opts.id,
    name: opts.name,
    createdAt: new Date(),
    order: opts.order,
    parentListId: opts.parentListId,
  }
}

/** New task record for a duplicated list — new id, only the new list membership. */
export function cloneTaskOntoList(task: Task, newListId: string, newTaskId: string): Task {
  const copy = structuredClone(task) as Task
  return {
    ...copy,
    id: newTaskId,
    lists: [newListId],
    createdAt: new Date(),
    // Drop graph edges that would still point at the originals.
    links: undefined,
    dependencies: undefined,
    parentTaskId: undefined,
    listMembershipExclusions: undefined,
  }
}

export interface DuplicateListPlan {
  list: List
  /** Folder ids to file the new list into (same as the source’s direct folders). */
  folderIds: string[]
  tasks: Task[]
}

export interface DuplicateFolderPlan {
  folder: Folder
  /** Nested folders created under this one (depth-first). */
  childFolders: DuplicateFolderPlan[]
  lists: DuplicateListPlan[]
}

export function planDuplicateList(
  source: List,
  opts: {
    scope: DuplicateScope
    lists: List[]
    folders: Folder[]
    tasks: Task[]
    /** Override filing; default = source’s direct folders. */
    folderIds?: string[]
    parentListId?: string
    existingNames?: Iterable<string>
  },
): DuplicateListPlan {
  const names = opts.existingNames ?? opts.lists.map((l) => l.name)
  const name = disambiguatedCopyName(source.name, names)
  const id = newId("list-")
  const list = listSettingsClone(source, {
    id,
    name,
    order: opts.lists.length,
    parentListId: opts.parentListId ?? source.parentListId,
  })
  const folderIds =
    opts.folderIds ??
    directFolderIdsForList(opts.folders, source.id).filter((fid) => !isScheduledFolderId(fid))
  const tasks: Task[] = []
  if (opts.scope === "settings_and_contents") {
    for (const task of opts.tasks) {
      if (!(task.lists ?? []).includes(source.id)) continue
      if (isFolderAllItemsCategoryId(source.id)) continue
      tasks.push(cloneTaskOntoList(task, id, newId("task-")))
    }
  }
  return { list, folderIds, tasks }
}

export function planDuplicateFolder(
  source: Folder,
  opts: {
    scope: DuplicateScope
    folders: Folder[]
    lists: List[]
    tasks: Task[]
    parentFolderId?: string
    existingFolderNames?: Iterable<string>
    existingListNames?: Iterable<string>
  },
): DuplicateFolderPlan {
  const folderNames = new Set(
    [...(opts.existingFolderNames ?? opts.folders.map((f) => f.name))].map((n) => n),
  )
  const listNames = new Set(
    [...(opts.existingListNames ?? opts.lists.map((l) => l.name))].map((n) => n),
  )
  const name = disambiguatedCopyName(source.name, folderNames)
  folderNames.add(name)
  const id = newId("folder-")
  const parentFolderId =
    opts.parentFolderId !== undefined ? opts.parentFolderId : source.parentFolderId
  // Guard cycles if caller passes a bad parent.
  const safeParent =
    parentFolderId && wouldCreateFolderCycle(opts.folders, source.id, parentFolderId)
      ? source.parentFolderId
      : parentFolderId

  const folder = folderSettingsClone(source, { id, name, parentFolderId: safeParent })
  const childFolders: DuplicateFolderPlan[] = []
  const lists: DuplicateListPlan[] = []

  if (opts.scope === "settings_and_contents") {
    for (const child of getFolderChildren(opts.folders, source.id)) {
      if (isAutoScheduledPeriodFolder(child.id)) continue
      const plan = planDuplicateFolder(child, {
        scope: opts.scope,
        folders: opts.folders,
        lists: opts.lists,
        tasks: opts.tasks,
        parentFolderId: id,
        existingFolderNames: folderNames,
        existingListNames: listNames,
      })
      folderNames.add(plan.folder.name)
      for (const nested of walkFolderPlans(plan)) {
        folderNames.add(nested.folder.name)
        for (const lp of nested.lists) listNames.add(lp.list.name)
      }
      childFolders.push(plan)
    }
    for (const listId of source.listIds) {
      if (isFolderAllItemsCategoryId(listId)) continue
      const sourceList = opts.lists.find((l) => l.id === listId)
      if (!sourceList) continue
      const plan = planDuplicateList(sourceList, {
        scope: opts.scope,
        lists: opts.lists,
        folders: opts.folders,
        tasks: opts.tasks,
        folderIds: [id],
        existingNames: listNames,
      })
      listNames.add(plan.list.name)
      lists.push(plan)
    }
  }

  return { folder, childFolders, lists }
}

function walkFolderPlans(plan: DuplicateFolderPlan): DuplicateFolderPlan[] {
  return [plan, ...plan.childFolders.flatMap(walkFolderPlans)]
}

/** Apply a folder plan into the store mutators (depth-first). */
export function applyDuplicateFolderPlan(
  plan: DuplicateFolderPlan,
  mut: {
    addFolder: (folder: Folder) => void
    addList: (list: List) => void
    addListToFolder: (folderId: string, listId: string) => void
    addTask: (task: Task) => void
  },
): void {
  mut.addFolder(plan.folder)
  for (const child of plan.childFolders) applyDuplicateFolderPlan(child, mut)
  for (const lp of plan.lists) {
    mut.addList(lp.list)
    for (const folderId of lp.folderIds) mut.addListToFolder(folderId, lp.list.id)
    for (const task of lp.tasks) mut.addTask(task)
  }
}

export function applyDuplicateListPlan(
  plan: DuplicateListPlan,
  mut: {
    addList: (list: List) => void
    addListToFolder: (folderId: string, listId: string) => void
    addTask: (task: Task) => void
  },
): void {
  mut.addList(plan.list)
  for (const folderId of plan.folderIds) mut.addListToFolder(folderId, plan.list.id)
  for (const task of plan.tasks) mut.addTask(task)
}

/** Valid parent candidates for a folder (no self / descendants / cycles). */
export function parentFolderChoices(folders: Folder[], folderId: string): Folder[] {
  const blocked = new Set([folderId, ...getFolderDescendantIds(folders, folderId)])
  return folders.filter((f) => {
    if (blocked.has(f.id)) return false
    if (isAutoScheduledPeriodFolder(f.id)) return false
    if (wouldCreateFolderCycle(folders, folderId, f.id)) return false
    return true
  })
}
