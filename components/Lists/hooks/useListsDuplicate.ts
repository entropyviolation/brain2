/**
 * components/Lists/hooks/useListsDuplicate.ts
 *
 * Duplicate a selection, a folder, or a list. Nested picks are not copied
 * twice. Settings-only still copies lists that live in a selected folder.
 * Confirm closes the edit dialog the orchestrator has open.
 */
import { useCallback, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import {
  applyDuplicateFolderPlan,
  applyDuplicateListPlan,
  planDuplicateFolder,
  planDuplicateList,
  type DuplicateScope,
} from "@/lib/lists-duplicate"
import type { Folder, List, Task } from "@/lib/types"

export function useListsDuplicate({
  selectedCategories,
  selectedFolderIds,
  currentFolder,
  addFolder,
  addList,
  addListToFolder,
  addTask,
  cancelSelectMode,
  setEditingFolder,
  setEditingCategory,
}: {
  selectedCategories: string[]
  selectedFolderIds: string[]
  currentFolder: Folder | null
  addFolder: (folder: Folder) => void
  addList: (list: List) => void
  addListToFolder: (folderId: string, listId: string) => void
  addTask: (task: Task) => void
  cancelSelectMode: () => void
  setEditingFolder: (folder: Folder | null) => void
  setEditingCategory: (list: List | null) => void
}) {
  const [duplicateOpen, setDuplicateOpen] = useState(false)
  const [duplicateSubject, setDuplicateSubject] = useState<
    null | { kind: "selection" } | { kind: "folder"; id: string } | { kind: "list"; id: string }
  >(null)

  const openDuplicateSelection = useCallback(() => {
    setDuplicateSubject({ kind: "selection" })
    setDuplicateOpen(true)
  }, [])

  const openDuplicateFolder = useCallback((folder: Folder) => {
    setDuplicateSubject({ kind: "folder", id: folder.id })
    setDuplicateOpen(true)
  }, [])

  const openDuplicateList = useCallback((list: List) => {
    setDuplicateSubject({ kind: "list", id: list.id })
    setDuplicateOpen(true)
  }, [])

  const handleConfirmDuplicate = useCallback(
    (scope: DuplicateScope) => {
      const state = useTaskStore.getState()
      const mut = {
        addFolder,
        addList,
        addListToFolder,
        addTask,
      }
      if (duplicateSubject?.kind === "folder") {
        const source = state.folders.find((f) => f.id === duplicateSubject.id)
        if (!source || isScheduledFolderId(source.id)) return
        const plan = planDuplicateFolder(source, {
          scope,
          folders: state.folders,
          lists: state.lists,
          tasks: state.tasks,
        })
        applyDuplicateFolderPlan(plan, mut)
        setEditingFolder(null)
        return
      }
      if (duplicateSubject?.kind === "list") {
        const source = state.lists.find((l) => l.id === duplicateSubject.id)
        if (!source || isFolderAllItemsCategoryId(source.id)) return
        const plan = planDuplicateList(source, {
          scope,
          lists: state.lists,
          folders: state.folders,
          tasks: state.tasks,
        })
        applyDuplicateListPlan(plan, mut)
        setEditingCategory(null)
        return
      }
      // Selection: folders first (so nested picks aren't double-copied as loose lists), then lists.
      const selectedFolderSet = new Set(selectedFolderIds)
      const folderIdsToCopy = selectedFolderIds.filter((id) => {
        const f = state.folders.find((x) => x.id === id)
        if (!f || isScheduledFolderId(f.id)) return false
        // Skip if an ancestor folder is also selected (contents mode would nest it).
        let walk = f.parentFolderId
        while (walk) {
          if (selectedFolderSet.has(walk)) return false
          walk = state.folders.find((x) => x.id === walk)?.parentFolderId
        }
        return true
      })
      const listIdsToCopy = selectedCategories.filter((id) => {
        if (isFolderAllItemsCategoryId(id)) return false
        // Skip lists that live only inside a selected folder tree when copying contents —
        // they'll be included by the folder plan. Settings-only still copies them as siblings.
        if (scope === "settings_and_contents") {
          for (const fid of folderIdsToCopy) {
            const f = state.folders.find((x) => x.id === fid)
            if (f?.listIds.includes(id)) return false
          }
        }
        return true
      })
      for (const fid of folderIdsToCopy) {
        const source = state.folders.find((f) => f.id === fid)
        if (!source) continue
        applyDuplicateFolderPlan(
          planDuplicateFolder(source, {
            scope,
            folders: useTaskStore.getState().folders,
            lists: useTaskStore.getState().lists,
            tasks: useTaskStore.getState().tasks,
          }),
          mut,
        )
      }
      for (const lid of listIdsToCopy) {
        const source = useTaskStore.getState().lists.find((l) => l.id === lid)
        if (!source) continue
        applyDuplicateListPlan(
          planDuplicateList(source, {
            scope,
            lists: useTaskStore.getState().lists,
            folders: useTaskStore.getState().folders,
            tasks: useTaskStore.getState().tasks,
            folderIds: currentFolder ? [currentFolder.id] : undefined,
          }),
          mut,
        )
      }
      cancelSelectMode()
    },
    [
      addFolder,
      addList,
      addListToFolder,
      addTask,
      currentFolder,
      duplicateSubject,
      selectedCategories,
      selectedFolderIds,
      cancelSelectMode,
      setEditingFolder,
      setEditingCategory,
    ],
  )

  return {
    duplicateOpen,
    setDuplicateOpen,
    duplicateSubject,
    setDuplicateSubject,
    openDuplicateSelection,
    openDuplicateFolder,
    openDuplicateList,
    handleConfirmDuplicate,
  }
}
