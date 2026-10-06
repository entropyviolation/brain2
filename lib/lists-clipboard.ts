/**
 * lib/lists-clipboard.ts — In-app Lists selection clipboard (Cmd/Ctrl+C / V)
 *
 * Session-only payload of selected list/folder ids. Paste offers Copies (new
 * records via lists-duplicate) vs Same identity (lists: multi-folder membership).
 * Folders stay single-parent (`parentFolderId`); Same paste does not reparent.
 *
 * Keyboard guard allows select-mode checkboxes / Keep·Move radios; only text
 * fields, contenteditable, and dialogs keep native copy/paste. Shortcuts run
 * only while the Lists file-manager root is the visible desk surface.
 */
import type { Folder, List, Task } from "@/lib/types"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import {
  applyDuplicateFolderPlan,
  applyDuplicateListPlan,
  planDuplicateFolder,
  planDuplicateList,
} from "@/lib/lists-duplicate"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"

export type ListsClipboardPayload = {
  listIds: string[]
  folderIds: string[]
}

export type PasteMode = "copies" | "same"

export function listsClipboardIsEmpty(payload: ListsClipboardPayload | null | undefined): boolean {
  if (!payload) return true
  return payload.listIds.length === 0 && payload.folderIds.length === 0
}

/** Snapshot a select-mode selection into a clipboard payload (deduped, filtered). */
export function buildListsClipboardPayload(opts: {
  listIds: string[]
  folderIds: string[]
}): ListsClipboardPayload {
  const listIds = [...new Set(opts.listIds)].filter((id) => !isFolderAllItemsCategoryId(id))
  const folderIds = [...new Set(opts.folderIds)].filter((id) => !isScheduledFolderId(id))
  return { listIds, folderIds }
}

/** Input types that do not take typed text — select-mode checkboxes/radios must not steal Cmd/Ctrl+C/V. */
const NON_TEXT_INPUT_TYPES = new Set([
  "checkbox",
  "radio",
  "button",
  "submit",
  "reset",
  "file",
  "hidden",
  "image",
  "range",
])

function isTextEntryField(el: Element): boolean {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  const tag = el.tagName
  if (tag === "TEXTAREA" || tag === "SELECT") return true
  if (tag !== "INPUT") return false
  const type = ((el as HTMLInputElement).type || "text").toLowerCase()
  return !NON_TEXT_INPUT_TYPES.has(type)
}

/**
 * True when focus is in a field or dialog that should keep native copy/paste.
 * Select-mode checkboxes, Keep/Move radios, and toolbar buttons are not blocked —
 * that was the bug that made Cmd/Ctrl+C/V appear broken after ticking lists.
 */
export function isListsClipboardKeyboardBlocked(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (isTextEntryField(target)) return true
  if (target.closest("[role='dialog'], [contenteditable='true']")) return true
  const field = target.closest("input, textarea, select")
  if (field && isTextEntryField(field)) return true
  return false
}

/** True when the Lists file-manager root is the visible desk surface (not a warm hidden tab). */
export function isListsClipboardSurfaceActive(root: HTMLElement | null | undefined): boolean {
  if (!root || !root.isConnected) return false
  let el: HTMLElement | null = root
  while (el) {
    if (el.hasAttribute("hidden")) return false
    if (el.getAttribute("aria-hidden") === "true") return false
    const style = typeof window !== "undefined" ? window.getComputedStyle(el) : null
    if (style && (style.display === "none" || style.visibility === "hidden")) return false
    el = el.parentElement
  }
  return true
}

export type ListsPasteMutators = {
  addFolder: (folder: Folder) => void
  addList: (list: List) => void
  addListToFolder: (folderId: string, listId: string) => void
  addTask: (task: Task) => void
}

export type ListsPasteSnapshot = {
  folders: Folder[]
  lists: List[]
  tasks: Task[]
}

/**
 * Apply a paste into `destinationFolderId` (null = root / All / Home — no list filing).
 *
 * - **copies**: settings+contents duplicates; lists filed into dest when set; folders
 *   parented under dest (or root when null). `getSnapshot` is re-read after each
 *   write so name disambiguation sees prior copies in the same paste.
 * - **same**: lists gain membership in dest (idempotent). Folders are skipped —
 *   a folder has one `parentFolderId` and Same must not silently reparent.
 */
export function applyListsClipboardPaste(
  payload: ListsClipboardPayload,
  mode: PasteMode,
  opts: {
    destinationFolderId: string | null
    getSnapshot: () => ListsPasteSnapshot
  },
  mut: ListsPasteMutators,
): void {
  if (listsClipboardIsEmpty(payload)) return

  if (mode === "same") {
    const dest = opts.destinationFolderId
    if (!dest || isScheduledFolderId(dest)) return
    const { lists } = opts.getSnapshot()
    for (const listId of payload.listIds) {
      if (isFolderAllItemsCategoryId(listId)) continue
      if (!lists.some((l) => l.id === listId)) continue
      mut.addListToFolder(dest, listId)
    }
    return
  }

  const selectedFolderSet = new Set(payload.folderIds)
  const snap0 = opts.getSnapshot()
  const folderIdsToCopy = payload.folderIds.filter((id) => {
    const f = snap0.folders.find((x) => x.id === id)
    if (!f || isScheduledFolderId(f.id)) return false
    let walk = f.parentFolderId
    while (walk) {
      if (selectedFolderSet.has(walk)) return false
      walk = snap0.folders.find((x) => x.id === walk)?.parentFolderId
    }
    return true
  })
  const listIdsToCopy = payload.listIds.filter((id) => {
    if (isFolderAllItemsCategoryId(id)) return false
    for (const fid of folderIdsToCopy) {
      const f = snap0.folders.find((x) => x.id === fid)
      if (f?.listIds.includes(id)) return false
    }
    return true
  })

  const destParent = opts.destinationFolderId ?? undefined
  for (const fid of folderIdsToCopy) {
    const snap = opts.getSnapshot()
    const source = snap.folders.find((f) => f.id === fid)
    if (!source) continue
    applyDuplicateFolderPlan(
      planDuplicateFolder(source, {
        scope: "settings_and_contents",
        folders: snap.folders,
        lists: snap.lists,
        tasks: snap.tasks,
        parentFolderId: destParent,
      }),
      mut,
    )
  }
  for (const lid of listIdsToCopy) {
    const snap = opts.getSnapshot()
    const source = snap.lists.find((l) => l.id === lid)
    if (!source) continue
    applyDuplicateListPlan(
      planDuplicateList(source, {
        scope: "settings_and_contents",
        lists: snap.lists,
        folders: snap.folders,
        tasks: snap.tasks,
        folderIds: destParent ? [destParent] : [],
      }),
      mut,
    )
  }
}
