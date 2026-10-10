/**
 * lib/lists-navigator.ts — Order and filing for Lists settings
 *
 * The Lists settings library is a place you can walk: Library, a folder, or a
 * list (its sublists). Order inside a place is whatever you last arranged.
 * Until then, folders use the sidebar sort and lists follow `listIds` or
 * `List.order`.
 *
 * A list can still live in more than one folder. Dragging it from one folder
 * to another leaves the other memberships. Dragging it to Library takes it
 * out of every folder and detaches it from a parent list.
 */
import type { Folder, List } from "@/lib/types"
import { getFolderAncestors, getRootFolders, sortFolders } from "@/lib/folder-tree"
import { canFileListInFolder } from "@/lib/folder-membership"
import { wouldCreateFolderCycle } from "@/lib/folder-selection"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { canMoveList, getAncestors } from "@/lib/list-tree"

export type NavKind = "folder" | "list"

export interface NavRef {
  kind: NavKind
  id: string
}

export type NavPlace = { kind: "root" } | { kind: "folder"; id: string } | { kind: "list"; id: string }

export type NavKindFilter = "all" | "folders" | "lists"

export type NavDropZone = "before" | "into" | "after"

export interface NavHit {
  ref: NavRef
  name: string
  /** Container the row was found in. */
  place: NavPlace
  /** Path of that container, not including the row name. */
  path: string
}

export function navRefKey(ref: NavRef): string {
  return `${ref.kind}:${ref.id}`
}

export function navPlaceKey(place: NavPlace): string {
  return place.kind === "root" ? "root" : `${place.kind}:${place.id}`
}

export function sameNavPlace(a: NavPlace, b: NavPlace): boolean {
  return navPlaceKey(a) === navPlaceKey(b)
}

/** `folder:<id>` / `list:<id>` tokens stored on `Folder.contentsOrder`. */
export function navToken(ref: NavRef): string {
  return navRefKey(ref)
}

export function parseNavToken(token: string): NavRef | null {
  const split = token.indexOf(":")
  if (split <= 0) return null
  const kind = token.slice(0, split)
  const id = token.slice(split + 1)
  if ((kind !== "folder" && kind !== "list") || !id) return null
  return { kind, id }
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
}

function byListOrder(a: List, b: List): number {
  const delta = (a.order ?? 0) - (b.order ?? 0)
  if (delta !== 0) return delta
  return byName(a, b)
}

function filedListIds(folders: Folder[]): Set<string> {
  const ids = new Set<string>()
  for (const folder of folders) {
    for (const id of folder.listIds) {
      if (!isFolderAllItemsCategoryId(id)) ids.add(id)
    }
  }
  return ids
}

function unfiledRootLists(lists: List[], folders: Folder[]): List[] {
  const filed = filedListIds(folders)
  const byId = new Map(lists.map((list) => [list.id, list]))
  return lists.filter((list) => {
    if (isFolderAllItemsCategoryId(list.id)) return false
    if (filed.has(list.id)) return false
    if (list.parentListId && byId.has(list.parentListId)) return false
    return true
  })
}

function folderContainer(folder: Folder, folders: Folder[], lists: List[]): NavRef[] {
  const childFolders = sortFolders(folders.filter((child) => child.parentFolderId === folder.id))
  const listIds = folder.listIds.filter(
    (id) => !isFolderAllItemsCategoryId(id) && lists.some((list) => list.id === id),
  )
  const byToken = new Map<string, NavRef>()
  for (const child of childFolders) byToken.set(navToken({ kind: "folder", id: child.id }), { kind: "folder", id: child.id })
  for (const id of listIds) byToken.set(navToken({ kind: "list", id }), { kind: "list", id })

  if (!folder.contentsOrder?.length) {
    return [
      ...childFolders.map((child) => ({ kind: "folder" as const, id: child.id })),
      ...listIds.map((id) => ({ kind: "list" as const, id })),
    ]
  }

  const out: NavRef[] = []
  const seen = new Set<string>()
  for (const token of folder.contentsOrder) {
    const ref = byToken.get(token)
    if (!ref || seen.has(token)) continue
    seen.add(token)
    out.push(ref)
  }
  for (const [token, ref] of byToken) {
    if (!seen.has(token)) out.push(ref)
  }
  return out
}

function rootContainer(lists: List[], folders: Folder[]): NavRef[] {
  const rootFolders = getRootFolders(folders)
  const unfiled = unfiledRootLists(lists, folders)
  const arranged = rootFolders.some((folder) => typeof folder.order === "number")
  if (!arranged) {
    return [
      ...rootFolders.map((folder) => ({ kind: "folder" as const, id: folder.id })),
      ...[...unfiled].sort(byListOrder).map((list) => ({ kind: "list" as const, id: list.id })),
    ]
  }
  const rows = [
    ...rootFolders.map((folder) => ({
      ref: { kind: "folder" as const, id: folder.id },
      order: folder.order ?? Number.MAX_SAFE_INTEGER,
      tie: folder.name,
    })),
    ...unfiled.map((list) => ({
      ref: { kind: "list" as const, id: list.id },
      order: list.order ?? Number.MAX_SAFE_INTEGER,
      tie: list.name,
    })),
  ]
  rows.sort((a, b) => a.order - b.order || byName(a, b))
  return rows.map((row) => row.ref)
}

function listContainer(lists: List[], parentId: string): NavRef[] {
  return lists
    .filter((list) => list.parentListId === parentId && !isFolderAllItemsCategoryId(list.id))
    .sort(byListOrder)
    .map((list) => ({ kind: "list" as const, id: list.id }))
}

/** Rows in one place, in the order the person arranged (or the built-in order). */
export function navContainer(lists: List[], folders: Folder[], place: NavPlace): NavRef[] {
  if (place.kind === "root") return rootContainer(lists, folders)
  if (place.kind === "folder") {
    const folder = folders.find((item) => item.id === place.id)
    return folder ? folderContainer(folder, folders, lists) : []
  }
  if (!lists.some((list) => list.id === place.id)) return []
  return listContainer(lists, place.id)
}

export function navName(lists: List[], folders: Folder[], ref: NavRef): string {
  if (ref.kind === "folder") return folders.find((folder) => folder.id === ref.id)?.name ?? "Folder"
  return lists.find((list) => list.id === ref.id)?.name ?? "List"
}

/** Breadcrumb label for a place, including Library. */
export function navPlacePath(lists: List[], folders: Folder[], place: NavPlace): string {
  if (place.kind === "root") return "Library"
  if (place.kind === "folder") {
    const self = folders.find((folder) => folder.id === place.id)
    const chain = getFolderAncestors(folders, place.id).reverse()
    return ["Library", ...chain.map((folder) => folder.name), self?.name ?? "Folder"].join(" / ")
  }
  const self = lists.find((list) => list.id === place.id)
  const chain = getAncestors(lists, place.id).reverse()
  return ["Library", ...chain.map((list) => list.name), self?.name ?? "List"].join(" / ")
}

export function filterNavRefs(refs: NavRef[], filter: NavKindFilter): NavRef[] {
  if (filter === "folders") return refs.filter((ref) => ref.kind === "folder")
  if (filter === "lists") return refs.filter((ref) => ref.kind === "list")
  return refs
}

/** Library-wide name search. A list filed in two folders can appear twice. */
export function searchNav(lists: List[], folders: Folder[], query: string, filter: NavKindFilter): NavHit[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const places: NavPlace[] = [
    { kind: "root" },
    ...folders.map((folder) => ({ kind: "folder" as const, id: folder.id })),
    ...lists
      .filter((list) => !isFolderAllItemsCategoryId(list.id))
      .map((list) => ({ kind: "list" as const, id: list.id })),
  ]
  const hits: NavHit[] = []
  for (const place of places) {
    const path = navPlacePath(lists, folders, place)
    for (const ref of filterNavRefs(navContainer(lists, folders, place), filter)) {
      const name = navName(lists, folders, ref)
      if (!name.toLowerCase().includes(needle)) continue
      hits.push({ ref, name, place, path })
    }
  }
  return hits
}

/**
 * Where a pointer is inside a row.
 * The middle band of a folder or list means "drop inside".
 */
export function rowDropZone(clientY: number, top: number, height: number, canInto: boolean): NavDropZone {
  if (!(height > 0)) return "before"
  const ratio = (clientY - top) / height
  if (canInto && ratio >= 0.28 && ratio <= 0.72) return "into"
  return ratio < 0.5 ? "before" : "after"
}

/** Map a visible-row gap back onto the full container, so a filter can stay on. */
export function insertionIndex(
  full: NavRef[],
  visible: NavRef[],
  visibleIndex: number,
  zone: "before" | "after",
): number {
  if (visible.length === 0) return full.length
  const index = Math.max(0, Math.min(visibleIndex, visible.length - 1))
  const target = visible[index]
  const at = full.findIndex((ref) => ref.kind === target.kind && ref.id === target.id)
  if (at < 0) return full.length
  return zone === "before" ? at : at + 1
}

function canPlace(lists: List[], folders: Folder[], ref: NavRef, source: NavPlace, dest: NavPlace): boolean {
  if (ref.kind === "folder") {
    if (isScheduledFolderId(ref.id)) return false
    if (dest.kind === "list") return false
    if (dest.kind === "root") return true
    if (sameNavPlace(source, dest)) return true
    if (isScheduledFolderId(dest.id)) return false
    return !wouldCreateFolderCycle(folders, ref.id, dest.id)
  }
  if (isFolderAllItemsCategoryId(ref.id)) return false
  if (dest.kind === "list") {
    if (ref.id === dest.id) return false
    return canMoveList(lists, ref.id, dest.id)
  }
  if (dest.kind === "folder") {
    if (sameNavPlace(source, dest)) return true
    return canFileListInFolder(folders, ref.id, dest.id)
  }
  return true
}

function sameRefs(a: NavRef[], b: NavRef[]): boolean {
  return a.length === b.length && a.every((ref, index) => ref.kind === b[index]?.kind && ref.id === b[index]?.id)
}

function insertRefs(order: NavRef[], moving: NavRef[], index: number): NavRef[] {
  const keys = new Set(moving.map(navRefKey))
  const removedBefore = order.slice(0, Math.max(0, index)).filter((ref) => keys.has(navRefKey(ref))).length
  const base = order.filter((ref) => !keys.has(navRefKey(ref)))
  const at = Math.max(0, Math.min(index - removedBefore, base.length))
  return [...base.slice(0, at), ...moving, ...base.slice(at)]
}

function cloneLists(lists: List[]): List[] {
  return lists.map((list) => ({ ...list }))
}

function cloneFolders(folders: Folder[]): Folder[] {
  return folders.map((folder) => ({
    ...folder,
    listIds: [...folder.listIds],
    contentsOrder: folder.contentsOrder ? [...folder.contentsOrder] : undefined,
  }))
}

function commitPlace(lists: List[], folders: Folder[], place: NavPlace, refs: NavRef[]): void {
  if (place.kind === "root") {
    refs.forEach((ref, index) => {
      if (ref.kind === "folder") {
        const folder = folders.find((item) => item.id === ref.id)
        if (folder) folder.order = index
        return
      }
      const list = lists.find((item) => item.id === ref.id)
      if (!list) return
      list.order = index
      delete list.parentListId
    })
    return
  }

  if (place.kind === "folder") {
    const folder = folders.find((item) => item.id === place.id)
    if (!folder) return
    folder.contentsOrder = refs.map(navToken)
    const virtual = folder.listIds.filter((id) => isFolderAllItemsCategoryId(id))
    const listIds = refs.filter((ref) => ref.kind === "list").map((ref) => ref.id)
    folder.listIds = [...listIds, ...virtual.filter((id) => !listIds.includes(id))]
    refs.forEach((ref, index) => {
      if (ref.kind !== "folder") return
      const child = folders.find((item) => item.id === ref.id)
      if (child) child.order = index
    })
    return
  }

  refs.forEach((ref, index) => {
    if (ref.kind !== "list") return
    const list = lists.find((item) => item.id === ref.id)
    if (!list) return
    list.parentListId = place.id
    list.order = index
  })
}

function stripFolderMembership(folders: Folder[], listIds: Set<string>): void {
  if (listIds.size === 0) return
  for (const folder of folders) {
    if (!folder.listIds.some((id) => listIds.has(id)) && !folder.contentsOrder?.some((token) => {
      const ref = parseNavToken(token)
      return ref?.kind === "list" && listIds.has(ref.id)
    })) {
      continue
    }
    folder.listIds = folder.listIds.filter((id) => !listIds.has(id))
    if (folder.contentsOrder) {
      folder.contentsOrder = folder.contentsOrder.filter((token) => {
        const ref = parseNavToken(token)
        return !(ref?.kind === "list" && listIds.has(ref.id))
      })
    }
  }
}

/** True when at least one of `moving` can land in `dest`. */
export function navDropAllowed(
  lists: List[],
  folders: Folder[],
  moving: NavRef[],
  source: NavPlace,
  dest: NavPlace,
): boolean {
  const wanted = new Set(moving.map(navRefKey))
  return navContainer(lists, folders, source).some(
    (ref) => wanted.has(navRefKey(ref)) && canPlace(lists, folders, ref, source, dest),
  )
}

/**
 * Move `moving` from `source` into `dest` at `index` (index in `dest` before
 * the removal, when the place does not change). Relative order is the source
 * order. Returns the same arrays when nothing moves.
 */
export function placeNavItems(
  lists: List[],
  folders: Folder[],
  moving: NavRef[],
  source: NavPlace,
  dest: NavPlace,
  index: number,
): { lists: List[]; folders: Folder[] } {
  const sourceOrder = navContainer(lists, folders, source)
  const wanted = new Set(moving.map(navRefKey))
  const present = sourceOrder.filter(
    (ref) => wanted.has(navRefKey(ref)) && canPlace(lists, folders, ref, source, dest),
  )
  if (present.length === 0) return { lists, folders }

  const same = sameNavPlace(source, dest)
  const destOrder = same ? sourceOrder : navContainer(lists, folders, dest)
  const nextDest = insertRefs(destOrder, present, index)
  const presentKeys = new Set(present.map(navRefKey))
  const nextSource = same ? nextDest : sourceOrder.filter((ref) => !presentKeys.has(navRefKey(ref)))
  if (same && sameRefs(nextDest, sourceOrder)) return { lists, folders }

  const nextLists = cloneLists(lists)
  const nextFolders = cloneFolders(folders)

  for (const ref of present) {
    if (ref.kind === "folder") {
      const folder = nextFolders.find((item) => item.id === ref.id)
      if (!folder) continue
      if (dest.kind === "root") delete folder.parentFolderId
      else if (dest.kind === "folder") folder.parentFolderId = dest.id
      continue
    }
    const list = nextLists.find((item) => item.id === ref.id)
    if (!list) continue
    if (dest.kind === "list") list.parentListId = dest.id
    else if (dest.kind === "root" || source.kind === "list") delete list.parentListId
  }

  commitPlace(nextLists, nextFolders, dest, nextDest)
  if (!same) commitPlace(nextLists, nextFolders, source, nextSource)

  if (dest.kind === "root") {
    const movedLists = new Set(present.filter((ref) => ref.kind === "list").map((ref) => ref.id))
    stripFolderMembership(nextFolders, movedLists)
  }

  return { lists: nextLists, folders: nextFolders }
}

export function removeNavList(
  lists: List[],
  folders: Folder[],
  id: string,
): { lists: List[]; folders: Folder[] } {
  const deleted = lists.find((list) => list.id === id)
  const newParent = deleted?.parentListId
  const nextLists = lists
    .filter((list) => list.id !== id)
    .map((list) => {
      if (list.parentListId !== id) return list
      if (newParent) return { ...list, parentListId: newParent }
      const next = { ...list }
      delete next.parentListId
      return next
    })
  const nextFolders = folders.map((folder) => ({
    ...folder,
    listIds: folder.listIds.filter((listId) => listId !== id),
    contentsOrder: folder.contentsOrder?.filter((token) => token !== navToken({ kind: "list", id })),
  }))
  return { lists: nextLists, folders: nextFolders }
}

export function removeNavFolder(folders: Folder[], id: string): Folder[] {
  return folders
    .filter((folder) => folder.id !== id)
    .map((folder) => {
      const next: Folder = {
        ...folder,
        listIds: [...folder.listIds],
        contentsOrder: folder.contentsOrder?.filter((token) => token !== navToken({ kind: "folder", id })),
      }
      if (next.parentFolderId === id) delete next.parentFolderId
      return next
    })
}

/** Stable fingerprint of arrangement fields. Store array order does not count. */
export function navSnapshot(lists: List[], folders: Folder[]): string {
  const listRows = lists
    .map((list) => `${list.id}\t${list.order ?? ""}\t${list.parentListId ?? ""}`)
    .sort()
  const folderRows = folders
    .map(
      (folder) =>
        `${folder.id}\t${folder.order ?? ""}\t${folder.parentFolderId ?? ""}\t${folder.listIds.join(",")}\t${(folder.contentsOrder ?? []).join(",")}`,
    )
    .sort()
  return `${listRows.join("\n")}\n--\n${folderRows.join("\n")}`
}
