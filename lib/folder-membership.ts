/**
 * lib/folder-membership.ts — Which folders contain a list or nested folder
 */
import type { Folder } from "@/lib/types"
import type { GridEntry } from "@/components/Lists/types"
import { getFolderAncestors } from "@/lib/folder-tree"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"

/** Folders that directly contain this list (via `listIds`, ignoring All Items ids). */
export function foldersContainingList(folders: Folder[], listId: string): Folder[] {
  if (!listId || isFolderAllItemsCategoryId(listId)) return []
  return folders
    .filter((f) => f.listIds.includes(listId))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
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
