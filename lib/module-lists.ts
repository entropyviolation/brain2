/**
 * lib/module-lists.ts — Auto-created folders for lists a module creates
 *
 * Lists created directly by a module live in `{ModuleName} Lists`, nested under
 * a root `Module Lists` folder. That whole tree is hidden from the Lists tab's
 * global All directory (and All Items) by default, remains in the sidebar, and
 * stays findable via search.
 */
import type { Folder, List, Task } from "@/lib/types"
import type { ModuleInstance, ModuleViewConfig } from "@/lib/modules-store"
import { isFolderAllItemsCategoryId, FOLDER_ALL_PREFIX } from "@/lib/folder-all-items"
import { useTaskStore } from "@/lib/task-store"

export const MODULE_LISTS_FOLDER_ID = "folder-module-lists"
export const MODULE_LISTS_FOLDER_NAME = "Module Lists"

const MODULE_CHILD_FOLDER_PREFIX = "module-lists-"

export interface ModuleListsMutators {
  lists: List[]
  folders: Folder[]
  addList: (c: List) => void
  updateList: (c: List) => void
  addFolder: (f: Folder) => void
  updateFolder: (f: Folder) => void
  addListToFolder: (folderId: string, categoryId: string) => void
  removeListFromFolder: (folderId: string, categoryId: string) => void
}

export function moduleChildFolderId(moduleId: string): string {
  return `${MODULE_CHILD_FOLDER_PREFIX}${moduleId}`
}

export function moduleChildFolderName(moduleTitle: string): string {
  const name = moduleTitle.trim() || "Untitled"
  return `${name} Lists`
}

export function isModuleListsRootFolder(id: string): boolean {
  return id === MODULE_LISTS_FOLDER_ID
}

export function isModuleListsChildFolder(id: string): boolean {
  return id.startsWith(MODULE_CHILD_FOLDER_PREFIX)
}

function folderById(folders: Folder[]): Map<string, Folder> {
  const map = new Map<string, Folder>()
  for (const f of folders) map.set(f.id, f)
  return map
}

/** Self + ancestors, root last. */
function ancestorChain(folderId: string, folders: Folder[]): string[] {
  const byId = folderById(folders)
  const out: string[] = []
  const seen = new Set<string>()
  let current = byId.get(folderId)
  while (current && !seen.has(current.id)) {
    seen.add(current.id)
    out.push(current.id)
    current = current.parentFolderId ? byId.get(current.parentFolderId) : undefined
  }
  return out
}

export function isUnderModuleListsTree(folderId: string, folders: Folder[]): boolean {
  return ancestorChain(folderId, folders).includes(MODULE_LISTS_FOLDER_ID)
}

export function isListInModuleListsTree(listId: string, folders: Folder[]): boolean {
  return folders.some((f) => f.listIds.includes(listId) && isUnderModuleListsTree(f.id, folders))
}

function isFiledOutsideModuleLists(listId: string, folders: Folder[]): boolean {
  return folders.some((f) => f.listIds.includes(listId) && !isUnderModuleListsTree(f.id, folders))
}

export function isFolderHiddenFromGlobalAll(folder: Folder, folders: Folder[]): boolean {
  if (folder.hiddenFromGlobalAll === false) return false
  if (folder.hiddenFromGlobalAll === true) return true
  return isUnderModuleListsTree(folder.id, folders)
}

export function isListHiddenFromGlobalAll(list: List, folders: Folder[]): boolean {
  if (list.hiddenFromGlobalAll === false) return false
  if (list.hiddenFromGlobalAll === true) return true
  if (isListInModuleListsTree(list.id, folders)) return true
  // Unfiled lists a module created (sync hasn't placed them yet).
  if (list.createdByModuleId && !folders.some((f) => f.listIds.includes(list.id))) return true
  return false
}

function folderIdFromAllItemsCategory(id: string): string | null {
  if (!isFolderAllItemsCategoryId(id)) return null
  return id.slice(FOLDER_ALL_PREFIX.length) || null
}

/**
 * Hide from Global All Items when every list the task belongs to is a hidden
 * module list (or the All Items pool of a hidden module folder). Items that
 * also belong to a visible list stay shown.
 */
export function isTaskHiddenFromGlobalAll(task: Task, lists: List[], folders: Folder[]): boolean {
  const cats = task.lists ?? []
  if (cats.length === 0) return false
  const byId = new Map(lists.map((l) => [l.id, l]))
  return !cats.some((id) => {
    const allFolderId = folderIdFromAllItemsCategory(id)
    if (allFolderId) {
      const folder = folders.find((f) => f.id === allFolderId)
      return folder ? !isFolderHiddenFromGlobalAll(folder, folders) : true
    }
    const list = byId.get(id)
    if (!list) return true
    return !isListHiddenFromGlobalAll(list, folders)
  })
}

export function filterTasksHiddenFromGlobalAll(tasks: Task[], lists: List[], folders: Folder[]): Task[] {
  return tasks.filter((t) => !isTaskHiddenFromGlobalAll(t, lists, folders))
}

function addId(ids: Set<string>, id?: string | null) {
  if (id) ids.add(id)
}

function collectFromViewConfig(ids: Set<string>, config: ModuleViewConfig | undefined) {
  if (!config) return
  addId(ids, config.categoryId)
  addId(ids, config.matchTargetCategoryId)
  addId(ids, config.quizSourceCategoryId)
  addId(ids, config.daysCategoryId)
  addId(ids, config.flightsCategoryId)
  addId(ids, config.entriesCategoryId)
  addId(ids, config.placesCategoryId)
  for (const card of config.cards ?? []) {
    addId(ids, card.categoryId)
    addId(ids, card.subtract?.categoryId)
  }
}

/** List ids a workspace module binds via views / config / plan-sync. */
export function listIdsUsedByModule(module: ModuleInstance): string[] {
  const ids = new Set<string>()
  addId(ids, module.config?.categoryId)
  addId(ids, module.config?.daysCategoryId)
  addId(ids, module.config?.flightsCategoryId)
  addId(ids, module.config?.entriesCategoryId)
  addId(ids, module.config?.placesCategoryId)
  addId(ids, module.config?.filmsCategoryId)
  addId(ids, module.planSync?.categoryId)
  addId(ids, module.scheduleSync?.categoryId)
  for (const view of module.views ?? []) collectFromViewConfig(ids, view.config)
  return [...ids]
}

export function isWorkspaceModule(module: ModuleInstance): boolean {
  return module.kind === "workspace" || module.type === "workspace"
}

function ensureRootFolder(mut: ModuleListsMutators): Folder {
  const existing = mut.folders.find((f) => f.id === MODULE_LISTS_FOLDER_ID)
  if (existing) return existing
  const folder: Folder = {
    id: MODULE_LISTS_FOLDER_ID,
    name: MODULE_LISTS_FOLDER_NAME,
    createdAt: new Date(),
    listIds: [],
    color: "#6366f1",
    description: "Lists created by Modules. Hidden from All by default; still in the sidebar and search.",
    scheduleable: false,
  }
  mut.addFolder(folder)
  return mut.folders.find((f) => f.id === MODULE_LISTS_FOLDER_ID) ?? folder
}

function ensureChildFolder(mut: ModuleListsMutators, module: ModuleInstance): Folder {
  ensureRootFolder(mut)
  const id = moduleChildFolderId(module.id)
  const name = moduleChildFolderName(module.title)
  const existing = mut.folders.find((f) => f.id === id)
  if (existing) {
    const next: Folder = {
      ...existing,
      parentFolderId: MODULE_LISTS_FOLDER_ID,
      name,
    }
    if (next.name !== existing.name || next.parentFolderId !== existing.parentFolderId) {
      mut.updateFolder(next)
    }
    return mut.folders.find((f) => f.id === id) ?? next
  }
  const folder: Folder = {
    id,
    name,
    createdAt: new Date(),
    listIds: [],
    parentFolderId: MODULE_LISTS_FOLDER_ID,
    color: "#818cf8",
    description: `Lists created by the ${module.title.trim() || "Untitled"} module.`,
    scheduleable: false,
    createdByModuleId: module.id,
  }
  mut.addFolder(folder)
  return mut.folders.find((f) => f.id === id) ?? folder
}

function shouldPlaceList(list: List, module: ModuleInstance, folders: Folder[], usedIds: Set<string>): boolean {
  if (isFolderAllItemsCategoryId(list.id)) return false
  if (list.createdByModuleId && list.createdByModuleId !== module.id) return false
  if (isFiledOutsideModuleLists(list.id, folders)) return false
  if (list.createdByModuleId === module.id) return true
  return usedIds.has(list.id) && !folders.some((f) => f.listIds.includes(list.id))
}

/** Put a module-created list into `{ModuleName} Lists` under Module Lists. */
export function placeListsForModule(mut: ModuleListsMutators, module: ModuleInstance, listIds?: string[]): void {
  if (!isWorkspaceModule(module)) return
  const child = ensureChildFolder(mut, module)
  const used = new Set(listIds?.length ? listIds : listIdsUsedByModule(module))
  const ids = listIds?.length ? listIds : [...used]

  for (const listId of ids) {
    const list = mut.lists.find((c) => c.id === listId)
    if (!list) continue
    if (!shouldPlaceList(list, module, mut.folders, used)) continue

    if (!list.createdByModuleId) {
      mut.updateList({ ...list, createdByModuleId: module.id })
    }

    for (const folder of mut.folders) {
      if (folder.id === child.id) continue
      if (folder.listIds.includes(listId) && isUnderModuleListsTree(folder.id, mut.folders)) {
        mut.removeListFromFolder(folder.id, listId)
      }
    }
    mut.addListToFolder(child.id, listId)
  }
}

/** Stamp + add lists a module just created, then file them under Module Lists. */
export function addModuleCreatedLists(mut: ModuleListsMutators, module: ModuleInstance, lists: List[]): void {
  const ids: string[] = []
  for (const list of lists) {
    ids.push(list.id)
    const existing = mut.lists.find((c) => c.id === list.id)
    if (!existing) {
      mut.addList({
        ...list,
        createdByModuleId: list.createdByModuleId ?? module.id,
      })
    }
  }
  placeListsForModule(mut, module, ids)
}

/**
 * Ensure Module Lists + per-module child folders exist and file autocreated
 * lists. Idempotent. No-op when there are no workspace modules.
 */
export function syncModuleListFolders(mut: ModuleListsMutators, modules: ModuleInstance[]): void {
  const workspaces = modules.filter(isWorkspaceModule)
  if (workspaces.length === 0) return
  ensureRootFolder(mut)
  for (const module of workspaces) {
    placeListsForModule(mut, module)
  }
}

/** Live mutators that always read the current task store (safe after writes). */
export function taskStoreModuleListsMutators(): ModuleListsMutators {
  const g = () => useTaskStore.getState()
  return {
    get lists() {
      return g().lists
    },
    get folders() {
      return g().folders
    },
    addList: (c) => g().addList(c),
    updateList: (c) => g().updateList(c),
    addFolder: (f) => g().addFolder(f),
    updateFolder: (f) => g().updateFolder(f),
    addListToFolder: (folderId, categoryId) => g().addListToFolder(folderId, categoryId),
    removeListFromFolder: (folderId, categoryId) => g().removeListFromFolder(folderId, categoryId),
  }
}
