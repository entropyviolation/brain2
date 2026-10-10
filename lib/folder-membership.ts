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

const FOLDER_PATH_SEP = " \\ "

/**
 * Shortest folder path that does not collide with another folder.
 * A unique name stays the name. A repeated name grows just enough ancestors
 * (`Life \ Writing`) using the Lists breadcrumb separator.
 * Returns "" when `folderId` is unknown.
 */
export function shortestFolderPath(folders: Folder[], folderId: string): string {
  const self = folders.find((folder) => folder.id === folderId)
  if (!self) return ""
  const chain = (id: string): string[] => {
    const folder = folders.find((row) => row.id === id)
    if (!folder) return []
    const ancestors = getFolderAncestors(folders, id)
    return [...ancestors.reverse().map((ancestor) => ancestor.name), folder.name]
  }
  const mine = chain(folderId)
  const others = folders.filter((folder) => folder.id !== folderId).map((folder) => chain(folder.id))
  for (let length = 1; length <= mine.length; length++) {
    const suffix = mine.slice(-length)
    const key = suffix.join("\0").toLocaleLowerCase()
    const clash = others.some((path) => path.slice(-length).join("\0").toLocaleLowerCase() === key)
    if (!clash) return suffix.join(FOLDER_PATH_SEP)
  }
  return mine.join(FOLDER_PATH_SEP)
}

export interface AssignedListFolderGroup {
  /** Sorted direct folder ids, or "" when none of these lists are filed. */
  key: string
  /** Plate text. Null when the lists sit in no folder — omit the label. */
  label: string | null
  listIds: string[]
}

/**
 * Group assigned list ids by the exact set of folders they are filed in.
 * Lists that share a folder set share one plate, so the folder name is not
 * repeated on every chip. A list filed in several folders is one chip; the
 * plate joins those paths with " · ". Unfiled lists are one group with no label.
 */
export function assignedListFolderGroups(
  listIds: readonly string[],
  folders: Folder[],
): AssignedListFolderGroup[] {
  const buckets = new Map<string, string[]>()
  for (const id of listIds) {
    if (!id || isFolderAllItemsCategoryId(id)) continue
    const containing = foldersContainingList(folders, id)
    const key = containing.map((folder) => folder.id).join("\0")
    const bucket = buckets.get(key)
    if (bucket) {
      if (!bucket.includes(id)) bucket.push(id)
    } else {
      buckets.set(key, [id])
    }
  }
  const groups: AssignedListFolderGroup[] = []
  for (const [key, ids] of buckets) {
    if (!key) continue
    const label = key
      .split("\0")
      .map((folderId) => shortestFolderPath(folders, folderId))
      .filter(Boolean)
      .join(" · ")
    groups.push({ key, label: label || null, listIds: ids })
  }
  groups.sort((a, b) => (a.label || "").localeCompare(b.label || "", undefined, { sensitivity: "base" }))
  const loose = buckets.get("")
  if (loose) groups.push({ key: "", label: null, listIds: loose })
  return groups
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
