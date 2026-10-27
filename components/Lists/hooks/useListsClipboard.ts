/**
 * components/Lists/hooks/useListsClipboard.ts
 *
 * Lists copy and paste. The window listener stays on `window`. The surface
 * ref stays on the file-manager root and is passed in. Copy is a no-op
 * unless select mode is on and the Lists desk is the one in front.
 */
import { useCallback, useEffect, useState } from "react"
import type { RefObject } from "react"
import { useTaskStore } from "@/lib/task-store"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import {
  applyListsClipboardPaste,
  buildListsClipboardPayload,
  isListsClipboardKeyboardBlocked,
  isListsClipboardSurfaceActive,
  listsClipboardIsEmpty,
  type ListsClipboardPayload,
  type PasteMode,
} from "@/lib/lists-clipboard"
import type { Folder, List, Task } from "@/lib/types"

export function useListsClipboard({
  listsSurfaceRef,
  selectMode,
  selectedCategories,
  selectedFolderIds,
  currentFolder,
  addFolder,
  addList,
  addListToFolder,
  addTask,
}: {
  listsSurfaceRef: RefObject<HTMLDivElement | null>
  selectMode: boolean
  selectedCategories: string[]
  selectedFolderIds: string[]
  currentFolder: Folder | null
  addFolder: (folder: Folder) => void
  addList: (list: List) => void
  addListToFolder: (folderId: string, listId: string) => void
  addTask: (task: Task) => void
}) {
  const [listsClipboard, setListsClipboard] = useState<ListsClipboardPayload | null>(null)
  const [pasteOpen, setPasteOpen] = useState(false)

  const handleConfirmPaste = useCallback(
    (mode: PasteMode) => {
      if (listsClipboardIsEmpty(listsClipboard)) return
      applyListsClipboardPaste(
        listsClipboard!,
        mode,
        {
          destinationFolderId: currentFolder?.id ?? null,
          getSnapshot: () => {
            const s = useTaskStore.getState()
            return { folders: s.folders, lists: s.lists, tasks: s.tasks }
          },
        },
        { addFolder, addList, addListToFolder, addTask },
      )
    },
    [listsClipboard, currentFolder?.id, addFolder, addList, addListToFolder, addTask],
  )

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key !== "c" && key !== "v") return
      // Warm-mounted Lists tab must not steal copy/paste from Home / other desks.
      if (!isListsClipboardSurfaceActive(listsSurfaceRef.current)) return
      if (isListsClipboardKeyboardBlocked(e.target)) return
      if (key === "c") {
        if (!selectMode) return
        const payload = buildListsClipboardPayload({
          listIds: selectedCategories,
          folderIds: selectedFolderIds,
        })
        if (listsClipboardIsEmpty(payload)) return
        e.preventDefault()
        setListsClipboard(payload)
        return
      }
      if (listsClipboardIsEmpty(listsClipboard)) return
      e.preventDefault()
      setPasteOpen(true)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [selectMode, selectedCategories, selectedFolderIds, listsClipboard])

  const pasteSameEnabled =
    !!currentFolder &&
    !isScheduledFolderId(currentFolder.id) &&
    (listsClipboard?.listIds.length ?? 0) > 0
  const pasteSameDisabledReason = !currentFolder
    ? "Open a folder to add the same lists into it. Folders keep one parent and cannot be multi-filed."
    : isScheduledFolderId(currentFolder.id)
      ? "Scheduled folders cannot receive Same-identity paste."
      : "Same identity applies to lists (multi-folder membership). Folders keep one parent."

  return {
    listsClipboard,
    pasteOpen,
    setPasteOpen,
    handleConfirmPaste,
    pasteSameEnabled,
    pasteSameDisabledReason,
  }
}
