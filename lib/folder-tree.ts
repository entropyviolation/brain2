/**
 * lib/folder-tree.ts — Nested folder helpers for sidebar navigation
 */
import type { Folder } from "@/lib/types"
import { NA_SCHEDULED_FOLDER, isAutoScheduledPeriodFolder } from "@/lib/scheduled-lists-sync"
import { isNextActionsFolder } from "@/lib/item-utils"

export interface FolderTreeNode {
  folder: Folder
  depth: number
  children: FolderTreeNode[]
}

/** Auto-generated scheduled period folders (year/month/week/day). Re-exported from sync. */
export { isAutoScheduledPeriodFolder }

/** Folders the user may rename, recolor, or delete from the sidebar. */
export function isEditableFolder(id: string): boolean {
  return !isAutoScheduledPeriodFolder(id)
}

function indexById(folders: Folder[]): Map<string, Folder> {
  const map = new Map<string, Folder>()
  for (const f of folders) map.set(f.id, f)
  return map
}

/** Chronological / stable sort key for scheduled hierarchy folders. */
export function scheduledFolderSortKey(id: string): string | null {
  if (id === NA_SCHEDULED_FOLDER) return "0"
  if (id.startsWith("na-sched-y-")) return `1-${id.slice("na-sched-y-".length)}`
  if (id.startsWith("na-sched-m-")) return `2-${id.slice("na-sched-m-".length)}`
  if (id.startsWith("na-sched-w-")) return `3-${id.slice("na-sched-w-".length).split("_")[0]}`
  if (id.startsWith("na-sched-d-")) return `4-${id.slice("na-sched-d-".length)}`
  return null
}

/** Compare two folders for sidebar / grid ordering. */
export function compareFolders(a: Folder, b: Folder, allFolders?: Folder[]): number {
  const aSched = scheduledFolderSortKey(a.id)
  const bSched = scheduledFolderSortKey(b.id)
  if (aSched && bSched) return aSched.localeCompare(bSched)
  if (aSched) return 1
  if (bSched) return -1
  if (allFolders) {
    if (isNextActionsFolder(a.id, allFolders)) return -1
    if (isNextActionsFolder(b.id, allFolders)) return 1
  } else {
    if (a.id === "folder-next-actions") return -1
    if (b.id === "folder-next-actions") return 1
  }
  if (a.id === "folder-module-lists") return -1
  if (b.id === "folder-module-lists") return 1
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
}

export function sortFolders(folders: Folder[]): Folder[] {
  return [...folders].sort((a, b) => compareFolders(a, b, folders))
}

export function getFolderById(folders: Folder[], id: string): Folder | undefined {
  return folders.find((f) => f.id === id)
}

export function getFolderChildren(folders: Folder[], parentId: string): Folder[] {
  return sortFolders(folders.filter((f) => f.parentFolderId === parentId))
}

export function getRootFolders(folders: Folder[]): Folder[] {
  const byId = indexById(folders)
  return sortFolders(folders.filter((f) => !f.parentFolderId || !byId.has(f.parentFolderId)))
}

export function getFolderAncestors(folders: Folder[], id: string): Folder[] {
  const byId = indexById(folders)
  const out: Folder[] = []
  const seen = new Set<string>([id])
  let current = byId.get(id)?.parentFolderId
  while (current && byId.has(current) && !seen.has(current)) {
    seen.add(current)
    const parent = byId.get(current)!
    out.push(parent)
    current = parent.parentFolderId
  }
  return out
}

export function getFolderAncestorIds(folders: Folder[], id: string): string[] {
  return getFolderAncestors(folders, id).map((f) => f.id)
}

export function buildFolderTree(folders: Folder[]): FolderTreeNode[] {
  const byId = indexById(folders)

  const build = (folder: Folder, depth: number, seen: Set<string>): FolderTreeNode => {
    seen.add(folder.id)
    const children = sortFolders(
      folders.filter((f) => f.parentFolderId === folder.id && !seen.has(f.id)),
    ).map((child) => build(child, depth + 1, seen))
    return { folder, depth, children }
  }

  const seen = new Set<string>()
  return getRootFolders(folders).map((root) => build(root, 0, seen))
}

/** Flatten folder tree respecting expanded ids (pre-order). */
export function flattenFolderTree(
  nodes: FolderTreeNode[],
  expandedIds: Set<string>,
): Array<FolderTreeNode & { hasChildren: boolean }> {
  const out: Array<FolderTreeNode & { hasChildren: boolean }> = []
  const walk = (node: FolderTreeNode) => {
    const hasChildren = node.children.length > 0
    out.push({ ...node, hasChildren })
    if (hasChildren && expandedIds.has(node.folder.id)) {
      node.children.forEach(walk)
    }
  }
  nodes.forEach(walk)
  return out
}

/** Default expanded ids: ancestors of active location + Next Actions branch roots. */
export function defaultExpandedFolderIds(folders: Folder[], location: string): Set<string> {
  const expanded = new Set<string>()
  if (location && location !== "home" && location !== "all") {
    for (const id of getFolderAncestorIds(folders, location)) expanded.add(id)
    expanded.add(location)
  }
  const nextActions = folders.find((f) => isNextActionsFolder(f.id, folders))
  if (nextActions) expanded.add(nextActions.id)
  return expanded
}
