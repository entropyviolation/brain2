/**
 * lib/capture-target.ts — Resolve Quick Add / Bulk Add folder+list paths
 *
 * Turns a parsed `folder: … : list:` path into real folder/list ids, creating
 * missing ones. `folder: all: item` (also `all items`) files on that folder's
 * All Items pool (`__all-items__{folderId}`), not a list named "all". A bare
 * `all: item` is still a list named all. Callers then attach those list ids
 * on the captured task.
 */
import type { CaptureOrigin, Folder, List, Task } from "@/lib/types"
import {
  folderAllItemsCategoryId,
  isFolderAllItemsCategoryId,
  isFolderAllItemsKeyword,
  syncFolderAllItemsCategories,
} from "@/lib/folder-all-items"
import { createListItem, createNextActionItem, listIsNextActions, withCategoryDefaults } from "@/lib/item-utils"
import { findNextActionsFolder } from "@/lib/scheduled-lists-sync"
import type { SmartSuggestion } from "@/lib/smart-parse"

const NEXT_ACTIONS_RE = /next\s*actions?/i

export interface CaptureMutators {
  lists: List[]
  folders: Folder[]
  addList: (list: List) => void
  addFolder: (folder: Folder) => void
  addListToFolder: (folderId: string, listId: string) => void
  updateList: (list: List) => void
  updateFolder: (folder: Folder) => void
}

export type CaptureMutatorsFn = () => CaptureMutators

export interface CapturePreviewSegment {
  name: string
  exists: boolean
}

export interface CapturePathPreview {
  folders: CapturePreviewSegment[]
  list?: CapturePreviewSegment
}

export interface ResolvedCaptureTarget {
  list?: List
  folder?: Folder
  listIds: string[]
}

function namesEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

const LIST_COLORS = ["#3B82F6", "#EF4444", "#10B981", "#8B5CF6", "#F59E0B", "#06B6D4", "#EC4899", "#6366F1"]

function randomColor(): string {
  return LIST_COLORS[Math.floor(Math.random() * LIST_COLORS.length)]
}

function childrenOf(folders: Folder[], parentId: string | undefined): Folder[] {
  return folders.filter((f) => (f.parentFolderId ?? "") === (parentId ?? ""))
}

function findFolderNamed(folders: Folder[], name: string, parentId: string | undefined): Folder | undefined {
  const kids = childrenOf(folders, parentId)
  const exact = kids.find((f) => namesEqual(f.name, name))
  if (exact) return exact
  if (parentId) return undefined
  if (NEXT_ACTIONS_RE.test(name)) {
    const na = findNextActionsFolder(folders)
    if (na) return na
  }
  return folders.find((f) => namesEqual(f.name, name) && !f.parentFolderId)
    ?? folders.find((f) => namesEqual(f.name, name))
}

function listInFolder(lists: List[], folder: Folder, name: string): List | undefined {
  for (const id of folder.listIds) {
    if (isFolderAllItemsCategoryId(id)) continue
    const list = lists.find((l) => l.id === id)
    if (list && namesEqual(list.name, name)) return list
  }
  return undefined
}

function findListNamed(lists: List[], name: string): List | undefined {
  return lists.find((l) => namesEqual(l.name, name) && !isFolderAllItemsCategoryId(l.id))
}

/** Preview whether path segments already exist (does not create). */
export function previewCapturePath(
  folderPath: string[] | undefined,
  listName: string | undefined,
  folders: Folder[],
  lists: List[],
): CapturePathPreview {
  const foldersOut: CapturePreviewSegment[] = []
  let parentId: string | undefined
  let currentFolders = folders
  for (const name of folderPath ?? []) {
    const found = findFolderNamed(currentFolders, name, parentId)
    foldersOut.push({ name, exists: Boolean(found) })
    parentId = found?.id
    currentFolders = folders
  }
  if (!listName) return { folders: foldersOut }
  if ((folderPath?.length ?? 0) > 0 && isFolderAllItemsKeyword(listName)) {
    return { folders: foldersOut, list: { name: "All Items", exists: true } }
  }
  const leaf = parentId ? folders.find((f) => f.id === parentId) : undefined
  const listExists = leaf
    ? Boolean(listInFolder(lists, leaf, listName))
    : Boolean(findListNamed(lists, listName))
  return { folders: foldersOut, list: { name: listName, exists: listExists } }
}

function ensureFolder(
  getMut: CaptureMutatorsFn,
  name: string,
  parentId: string | undefined,
): Folder {
  const mut = getMut()
  const existing = findFolderNamed(mut.folders, name, parentId)
  if (existing) return existing
  const folder: Folder = {
    id: newId("folder"),
    name,
    createdAt: new Date(),
    listIds: [],
    parentFolderId: parentId,
    color: randomColor(),
    scheduleable: false,
  }
  mut.addFolder(folder)
  return folder
}

function ensureList(getMut: CaptureMutatorsFn, name: string, folder?: Folder): List {
  const mut = getMut()
  if (folder) {
    const fresh = mut.folders.find((f) => f.id === folder.id) ?? folder
    const inFolder = listInFolder(mut.lists, fresh, name)
    if (inFolder) return inFolder
  } else {
    const existing = findListNamed(mut.lists, name)
    if (existing) return existing
  }
  const list: List = {
    id: newId("list"),
    name,
    color: randomColor(),
    description: `Auto-created from capture`,
    createdAt: new Date(),
    // A folder's Send to Scheduler switch does not opt this list in.
    // Turn it on in List Settings, or add the item to a list already sent.
    scheduleable: false,
  }
  mut.addList(list)
  if (folder) mut.addListToFolder(folder.id, list.id)
  return list
}

/**
 * Create missing folders/lists for a capture path and return the list ids to
 * put on the task. No path + no list name → empty (global All Items).
 */
export function ensureCaptureTarget(
  suggestion: Pick<SmartSuggestion, "folderPath" | "category">,
  getMut: CaptureMutatorsFn,
): ResolvedCaptureTarget {
  let parent: Folder | undefined
  for (const name of suggestion.folderPath ?? []) {
    parent = ensureFolder(getMut, name, parent?.id)
  }

  if (parent) {
    syncFolderAllItemsCategories(getMut())
    parent = getMut().folders.find((f) => f.id === parent!.id) ?? parent
  }

  if (parent && suggestion.category && isFolderAllItemsKeyword(suggestion.category)) {
    const allId = folderAllItemsCategoryId(parent.id)
    const allList = getMut().lists.find((list) => list.id === allId)
    return { folder: parent, list: allList, listIds: [allId] }
  }

  if (!suggestion.category) {
    if (parent) {
      const allId = folderAllItemsCategoryId(parent.id)
      return { folder: parent, listIds: [allId] }
    }
    return { listIds: [] }
  }

  const list = ensureList(getMut, suggestion.category, parent)
  const { folders } = getMut()
  const folder =
    parent ?? folders.find((f) => f.listIds.includes(list.id) && !isFolderAllItemsCategoryId(list.id))
  return { list, folder, listIds: [list.id] }
}

export function applySuggestionFields(task: Task, suggestion: SmartSuggestion): Task {
  return {
    ...task,
    ...(suggestion.scheduledDate ? { scheduledDate: suggestion.scheduledDate } : {}),
    ...(suggestion.scheduledTime ? { scheduledTime: suggestion.scheduledTime } : {}),
    ...(suggestion.estimatedDuration ? { estimatedDuration: suggestion.estimatedDuration } : {}),
    ...(suggestion.urgency ? { urgency: suggestion.urgency } : {}),
    ...(suggestion.importance ? { importance: suggestion.importance } : {}),
  }
}

export function buildCapturedTask(opts: {
  suggestion: SmartSuggestion
  fallbackText: string
  sendToInbox: boolean
  target: ResolvedCaptureTarget
  folders: Folder[]
  /** When the person sent the capture. Desktop clicks omit this and use now. */
  now?: Date
  /** Door that created this line. Omitted on a rewrite that must keep the old one. */
  origin?: CaptureOrigin
}): Task {
  const description = opts.suggestion.description || opts.fallbackText.trim()
  const listIds = opts.target.listIds
  const isNext = listIds.some((id) => listIsNextActions(id, opts.folders))
  let task: Task = isNext
    ? createNextActionItem(description, listIds)
    : createListItem(description, listIds)
  task = withCategoryDefaults(task, opts.target.list)
  task = applySuggestionFields(task, opts.suggestion)
  if (opts.now) task = { ...task, createdAt: opts.now }
  if (opts.origin) task = { ...task, captureOrigin: opts.origin }

  if (!opts.target.list && opts.suggestion.category) {
    task = { ...task, tags: [...(task.tags ?? []), opts.suggestion.category] }
  }

  const monkey = opts.suggestion.monkeyBrain === true
  if (opts.sendToInbox || monkey) {
    task = {
      ...task,
      stage: "inbox",
      ...(monkey ? { monkeyBrain: true } : {}),
      estimatedDuration: task.estimatedDuration ?? 1,
      cognitiveLoad: task.cognitiveLoad ?? 1,
      urgency: task.urgency ?? 3,
      importance: task.importance ?? 3,
      dependencies: task.dependencies ?? [],
      context: task.context ?? "@inbox",
      entropy: task.entropy ?? 0.5,
      allowPartialCompletion: task.allowPartialCompletion ?? false,
      minimumChunkSize: task.minimumChunkSize ?? 15,
    }
  }
  return task
}
