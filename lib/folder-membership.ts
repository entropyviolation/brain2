/**
 * lib/folder-membership.ts — Which folders contain a list or nested folder
 *
 * A list may live in **many folders** at once. Canonical write is
 * `Folder.listIds` (many-to-many). That is not `List.parentListId` (list
 * nesting) and not `Folder.parentFolderId` (folder tree, one parent).
 * See `components/Lists/LIST_FOLDERS.md`.
 */
import type { Folder } from "@/lib/types"
import type { GridEntry } from "@/components/Lists/types"
import { getFolderAncestors } from "@/lib/folder-tree"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"

export type FolderMembershipKind = "direct" | "inherited"

/** One folder a list sits in — filed there, or an ancestor of a filed folder. */
export interface FolderMembership {
  folder: Folder
  kind: FolderMembershipKind
  /** Direct folder ids this ancestor was reached through. Empty for direct. */
  viaFolderIds: string[]
}

/** Folders that directly contain this list (via `listIds`, ignoring All Items ids). */
export function foldersContainingList(folders: Folder[], listId: string): Folder[] {
  if (!listId || isFolderAllItemsCategoryId(listId)) return []
  return folders
    .filter((f) => f.listIds.includes(listId))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
}

export function directFolderIdsForList(folders: Folder[], listId: string): string[] {
  return foldersContainingList(folders, listId).map((f) => f.id)
}

/**
 * Ancestor folders of each direct placement, excluding folders that are
 * themselves a direct placement (direct wins; no duplicate count).
 */
export function inheritedFoldersForList(folders: Folder[], listId: string): FolderMembership[] {
  const directs = foldersContainingList(folders, listId)
  const directIds = new Set(directs.map((f) => f.id))
  const byId = new Map<string, FolderMembership>()

  for (const direct of directs) {
    for (const ancestor of getFolderAncestors(folders, direct.id)) {
      if (directIds.has(ancestor.id)) continue
      const existing = byId.get(ancestor.id)
      if (existing) {
        if (!existing.viaFolderIds.includes(direct.id)) existing.viaFolderIds.push(direct.id)
        continue
      }
      byId.set(ancestor.id, {
        folder: ancestor,
        kind: "inherited",
        viaFolderIds: [direct.id],
      })
    }
  }

  return [...byId.values()].sort((a, b) =>
    a.folder.name.localeCompare(b.folder.name, undefined, { sensitivity: "base" }),
  )
}

/**
 * Chips / rows to show for a list.
 * Default (`showNested` false): direct folders only.
 * Nested on: direct first, then inherited ancestors (marked, not duplicated).
 */
export function visibleFolderMemberships(
  folders: Folder[],
  listId: string,
  showNested: boolean,
): FolderMembership[] {
  const direct: FolderMembership[] = foldersContainingList(folders, listId).map((folder) => ({
    folder,
    kind: "direct" as const,
    viaFolderIds: [],
  }))
  if (!showNested) return direct
  return [...direct, ...inheritedFoldersForList(folders, listId)]
}

/**
 * Folders an entry sits inside.
 * Lists: every folder that references them.
 * Folders: the ancestor chain (parent → root).
 * Per-folder All Items: that folder only.
 */
export function foldersContainingEntry(
  entry: Pick<GridEntry, "kind" | "id">,
  folders: Folder[],
): Folder[] {
  if (entry.kind === "list") return foldersContainingList(folders, entry.id)
  if (entry.kind === "folder") return getFolderAncestors(folders, entry.id)
  if (entry.kind === "folder-all") {
    if (entry.id === "all-root") return []
    const folderId = entry.id.startsWith("all-") ? entry.id.slice("all-".length) : ""
    const folder = folders.find((f) => f.id === folderId)
    return folder ? [folder] : []
  }
  return []
}

export function formatWithinValue(containing: Folder[], showNames: boolean): string {
  if (containing.length === 0) return showNames ? "—" : "0"
  if (!showNames) return String(containing.length)
  return containing.map((f) => f.name).join(", ")
}

export function entryHasFolderMembership(kind: GridEntry["kind"]): boolean {
  return kind === "list" || kind === "folder" || kind === "folder-all"
}

export type FileListInFolderReason = "self" | "missing" | "scheduled" | "virtual-list"

/**
 * Whether this list may be filed into `folderId`.
 * A list is not a folder, so the only identity cycle is `listId === folderId`.
 * Scheduled period folders are generated and cannot receive a filing.
 */
export function fileListInFolderBlockReason(
  folders: Folder[],
  listId: string,
  folderId: string,
): FileListInFolderReason | null {
  if (!listId || isFolderAllItemsCategoryId(listId)) return "virtual-list"
  if (!folderId || listId === folderId) return "self"
  if (isScheduledFolderId(folderId)) return "scheduled"
  if (!folders.some((f) => f.id === folderId)) return "missing"
  return null
}

export function canFileListInFolder(folders: Folder[], listId: string, folderId: string): boolean {
  return fileListInFolderBlockReason(folders, listId, folderId) === null
}

/** User folders a list can be added to (excludes scheduled period folders). */
export function selectableFoldersForList(folders: Folder[], listId: string): Folder[] {
  return folders
    .filter((f) => canFileListInFolder(folders, listId, f.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
}

export function diffListFolderMembership(
  folders: Folder[],
  listId: string,
  nextDirectIds: string[],
): { add: string[]; remove: string[] } {
  const current = new Set(directFolderIdsForList(folders, listId))
  const wanted = new Set(nextDirectIds.filter((id) => canFileListInFolder(folders, listId, id)))
  const add = [...wanted].filter((id) => !current.has(id))
  const remove = [...current].filter((id) => !wanted.has(id))
  return { add, remove }
}
