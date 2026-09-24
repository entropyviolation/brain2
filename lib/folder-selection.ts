/**
 * lib/folder-selection.ts — Move/keep selected lists and folders into a destination
 */
import type { Folder } from "@/lib/types"
import { getFolderAncestorIds } from "@/lib/folder-tree"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"

export type ListPlacementMode = "keep" | "move"

/** True if setting `folderId`'s parent to `newParentId` would create a cycle. */
export function wouldCreateFolderCycle(folders: Folder[], folderId: string, newParentId: string): boolean {
  if (folderId === newParentId) return true
  return getFolderAncestorIds(folders, newParentId).includes(folderId)
}

/** User folders that can receive a multi-selection (excludes scheduled + current + selected). */
export function destinationFoldersForSelection(
  folders: Folder[],
  opts: { currentFolderId?: string | null; selectedFolderIds?: string[] } = {},
): Folder[] {
  const selected = new Set(opts.selectedFolderIds ?? [])
  return folders.filter((f) => {
    if (isScheduledFolderId(f.id)) return false
    if (opts.currentFolderId && f.id === opts.currentFolderId) return false
    if (selected.has(f.id)) return false
    for (const sid of selected) {
      if (wouldCreateFolderCycle(folders, sid, f.id)) return false
    }
    return true
  })
}

/**
 * Origin folder to unlink when placing lists.
 * All is not a real folder — lists must never be removed from it.
 * Home / no current folder also has nothing to unlink.
 * Search selections unlink every other folder (see place path).
 */
export function originFolderIdToUnlink(opts: {
  mode: ListPlacementMode
  originFolderId?: string | null
  isAll: boolean
}): string | null {
  if (opts.mode !== "move") return null
  if (opts.isAll) return null
  return opts.originFolderId ?? null
}

/** Folder ids that currently hold `listId`, excluding `exceptFolderId`. */
export function otherFolderIdsHoldingList(
  folders: Folder[],
  listId: string,
  exceptFolderId: string,
): string[] {
  return folders
    .filter((f) => f.id !== exceptFolderId && !isScheduledFolderId(f.id) && f.listIds.includes(listId))
    .map((f) => f.id)
}
