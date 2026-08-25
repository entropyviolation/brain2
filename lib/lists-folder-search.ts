/**
 * lib/lists-folder-search.ts — In-folder list view search + select helpers
 *
 * Folder List view searches only the current folder's lists and pins matches
 * to the top without leaving the folder or searching items/folders globally.
 */
import type { GridEntry } from "@/components/Lists/types"

/** Lists and subfolders can be multi-selected; All Items / smart / habits cannot. */
export function isMultiSelectableEntry(entry: GridEntry): boolean {
  return entry.kind === "list" || entry.kind === "folder"
}

export function selectableEntryIds(entries: GridEntry[]): { listIds: string[]; folderIds: string[] } {
  const listIds: string[] = []
  const folderIds: string[] = []
  for (const entry of entries) {
    if (entry.kind === "list") listIds.push(entry.id)
    else if (entry.kind === "folder") folderIds.push(entry.id)
  }
  return { listIds, folderIds }
}

/**
 * Pin lists whose names match `query` to the top, preserving relative order.
 * Non-list entries and unmatched lists stay below in their original order.
 */
export function pinMatchingListsToTop(entries: GridEntry[], query: string): GridEntry[] {
  const q = query.trim().toLowerCase()
  if (!q) return entries
  const matched: GridEntry[] = []
  const rest: GridEntry[] = []
  for (const entry of entries) {
    if (entry.kind === "list" && entry.name.toLowerCase().includes(q)) matched.push(entry)
    else rest.push(entry)
  }
  return [...matched, ...rest]
}
