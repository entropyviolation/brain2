/**
 * lib/folder-all-query.ts — Folder All Items targets for list search
 *
 * Inbox Apply list understands `cleaning: all` and `all cleaning` (also
 * `all items`, and a missing space after the colon). The hit is that folder's
 * existing All Items pool (`__all-items__{folderId}`), not a list named all.
 * Folder names use the same exact / prefix / contains match as ingest
 * (`resolveName`). A tie stays a tie: every close folder is returned.
 */
import type { Folder } from "@/lib/types"
import { folderAllItemsCategoryId } from "@/lib/folder-all-items"
import { normalizeName, resolveName, type ResolveResult } from "@/lib/ingest/name-resolve"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"

/** Exact, prefix, or contains. Weaker word-overlap is not a folder context. */
const FOLDER_CONTEXT_SCORE = 0.8

export interface FolderAllTarget {
  folderId: string
  folderName: string
  listId: string
}

export type FolderAllSearch = {
  /** `all` is an explicit folder-All query. `context` is one unambiguous folder. */
  kind: "none" | "all" | "context"
  targets: FolderAllTarget[]
}

/**
 * Folder name inside `name: all` / `name:all` / `all name` / `all items name`.
 * A bare `all` or `all items` is not a folder query.
 */
export function parseFolderAllQuery(raw: string): string | null {
  const q = raw.trim().replace(/\s+/g, " ")
  if (!q) return null
  const colon = /^(.*?)\s*:\s*all(?:\s+items)?\s*$/i.exec(q)
  if (colon) {
    const name = colon[1].trim()
    return name || null
  }
  // "all items …" before "all …", so a bare "all items" stays a list search.
  const leadItems = /^all\s+items(?:\s+(.+))?$/i.exec(q)
  if (leadItems) {
    const name = (leadItems[1] ?? "").trim()
    return name || null
  }
  const lead = /^all\s+(.+)$/i.exec(q)
  if (lead) {
    const name = lead[1].trim()
    return name || null
  }
  return null
}

function eligibleFolders(folders: Folder[]): Folder[] {
  return folders.filter((folder) => folder.name.trim() && !isScheduledFolderId(folder.id))
}

/** Exact ties stay ambiguous. `resolveName` would otherwise keep the first exact name. */
function resolveEligibleFolders(query: string, folders: Folder[]): ResolveResult {
  const q = normalizeName(query)
  const exact = folders.filter((folder) => normalizeName(folder.name) === q)
  if (exact.length > 1) {
    return {
      status: "ambiguous",
      query,
      candidates: exact
        .map((folder) => ({ id: folder.id, name: folder.name, score: 1 }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  }
  return resolveName(query, folders)
}

function toTarget(folder: Folder): FolderAllTarget {
  return {
    folderId: folder.id,
    folderName: folder.name,
    listId: folderAllItemsCategoryId(folder.id),
  }
}

function targetsFor(query: string, folders: Folder[], includeAmbiguous: boolean, minScore: number): FolderAllTarget[] {
  const result = resolveEligibleFolders(query, folders)
  if (result.status === "match") {
    if (result.candidate.score < minScore) return []
    const folder = folders.find((item) => item.id === result.candidate.id)
    return folder ? [toTarget(folder)] : []
  }
  if (result.status === "ambiguous" && includeAmbiguous) {
    return result.candidates
      .map((candidate) => folders.find((folder) => folder.id === candidate.id))
      .filter((folder): folder is Folder => !!folder)
      .map(toTarget)
  }
  return []
}

/**
 * Resolve a list-picker query to folder All Items rows.
 * Explicit `folder: all` / `all folder` returns every close folder.
 * Any other query offers All only when one folder is unambiguous.
 */
export function folderAllSearchTargets(query: string, folders: Folder[]): FolderAllSearch {
  const eligible = eligibleFolders(folders)
  const folderQuery = parseFolderAllQuery(query)
  if (folderQuery) {
    return { kind: "all", targets: targetsFor(folderQuery, eligible, true, 0) }
  }
  const q = query.trim()
  if (!q) return { kind: "none", targets: [] }
  const targets = targetsFor(q, eligible, false, FOLDER_CONTEXT_SCORE)
  if (targets.length === 0) return { kind: "none", targets: [] }
  return { kind: "context", targets }
}
