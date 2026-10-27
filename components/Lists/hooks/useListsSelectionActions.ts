/**
 * components/Lists/hooks/useListsSelectionActions.ts
 *
 * Select-mode placement, select-all, delete, and merge. List placement and
 * item placement are each computed once here. Search-result select and
 * in-list select share the same merge handlers.
 */
import { useCallback, useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import { isRemindersList } from "@/lib/reminders"
import { isPeopleIKnowList } from "@/lib/people-i-know"
import { isInstagramPeopleList } from "@/lib/instagram-lists"
import { originFolderIdToUnlink, otherFolderIdsHoldingList, wouldCreateFolderCycle, type ListPlacementMode } from "@/lib/folder-selection"
import {
  canMoveItemsFromOpenList,
  placeTaskIntoDestinationLists,
  type ItemPlacementMode,
} from "@/lib/item-selection"
import { applyListMerge, type ListMergePlan } from "@/lib/list-merge"
import { applyItemMerge, type ItemMergePlan } from "@/lib/item-merge"
import { selectableEntryIds } from "@/lib/lists-folder-search"
import type { Folder, ItemTypeDefinition, List, Task } from "@/lib/types"
import type { GridEntry, OpenTarget } from "@/components/Lists/types"
import type { useListsSelection } from "@/components/Lists/hooks/useListsSelection"

export function useListsSelectionActions({
  searchActive,
  searchResults,
  entries,
  listedTasks,
  folders,
  categories,
  allTasks,
  openTarget,
  currentFolder,
  isAll,
  itemTypes,
  selectedTaskId,
  setSelectedTaskId,
  selection,
  addListToFolder,
  removeListFromFolder,
  updateFolder,
  updateTask,
  deleteTask,
  deleteList,
  deleteFolder,
  setLists,
  setFolders,
  setTasks,
  closeTarget,
  handleNavTo,
}: {
  searchActive: boolean
  searchResults: { lists: List[]; folders: Folder[]; tasks: Task[] }
  entries: GridEntry[]
  listedTasks: Task[]
  folders: Folder[]
  categories: List[]
  allTasks: Task[]
  openTarget: OpenTarget
  currentFolder: Folder | null
  isAll: boolean
  itemTypes: ItemTypeDefinition[]
  selectedTaskId: string | null
  setSelectedTaskId: (id: string | null) => void
  selection: ReturnType<typeof useListsSelection>
  addListToFolder: (folderId: string, listId: string) => void
  removeListFromFolder: (folderId: string, listId: string) => void
  updateFolder: (folder: Folder) => void
  updateTask: (task: Task) => void
  deleteTask: (id: string) => void
  deleteList: (id: string) => void
  deleteFolder: (id: string) => void
  setLists: (lists: List[], opts?: { tombstoneIds?: string[] }) => void
  setFolders: (folders: Folder[]) => void
  setTasks: (tasks: Task[], opts?: { tombstoneIds?: string[] }) => void
  closeTarget: () => void
  handleNavTo: (loc: string) => void
}) {
  const {
    selectMode,
    selectedCategories,
    selectedFolderIds,
    selectedTaskIds,
    selectAll,
    selectAllTasks,
    clearSelection,
    clearTaskSelection,
  } = selection

  const [placementMode, setPlacementMode] = useState<ListPlacementMode>("keep")
  const [itemPlacementMode, setItemPlacementMode] = useState<ItemPlacementMode>("keep")
  const [mergeConfirmOpen, setMergeConfirmOpen] = useState(false)
  const [mergeOpen, setMergeOpen] = useState(false)
  const [itemMergeConfirmOpen, setItemMergeConfirmOpen] = useState(false)
  const [itemMergeOpen, setItemMergeOpen] = useState(false)

  const effectivePlacement: ListPlacementMode =
    searchActive || !isAll ? placementMode : "keep"

  const placeListsIntoFolder = useCallback(
    (destFolderId: string) => {
      selectedCategories.forEach((catId) => {
        addListToFolder(destFolderId, catId)
        if (effectivePlacement === "move") {
          if (searchActive) {
            otherFolderIdsHoldingList(folders, catId, destFolderId).forEach((fid) =>
              removeListFromFolder(fid, catId),
            )
          } else {
            const unlink = originFolderIdToUnlink({
              mode: effectivePlacement,
              originFolderId: currentFolder?.id,
              isAll,
            })
            if (unlink && unlink !== destFolderId) removeListFromFolder(unlink, catId)
          }
        }
      })
      if (effectivePlacement === "move") {
        selectedFolderIds.forEach((fid) => {
          if (wouldCreateFolderCycle(folders, fid, destFolderId)) return
          const child = folders.find((f) => f.id === fid)
          if (child) updateFolder({ ...child, parentFolderId: destFolderId })
        })
      }
      selection.cancelSelectMode()
    },
    [
      selectedCategories,
      selectedFolderIds,
      addListToFolder,
      removeListFromFolder,
      effectivePlacement,
      searchActive,
      currentFolder?.id,
      isAll,
      folders,
      updateFolder,
      selection,
    ],
  )

  const originListId = searchActive ? null : openTarget?.type === "category" ? openTarget.id : null
  /** Search has no single origin list; Move still relocates off other real lists. */
  const itemCanMove = searchActive || canMoveItemsFromOpenList(originListId)
  const effectiveItemPlacement: ItemPlacementMode = itemCanMove ? itemPlacementMode : "keep"
  const selectingOpenListItems = !!(
    selectMode &&
    !searchActive &&
    openTarget &&
    openTarget.type !== "habits" &&
    openTarget.type !== "objectives"
  )
  const selectingSearchResults = !!(selectMode && searchActive)
  const searchHasListsOrFolders =
    searchResults.lists.length + searchResults.folders.length > 0 ||
    selectedCategories.length + selectedFolderIds.length > 0
  const searchHasItems = searchResults.tasks.length > 0 || selectedTaskIds.length > 0
  const itemSelectActive = selectingOpenListItems || (selectingSearchResults && searchHasItems)
  const listSelectActive = !!(selectMode && !selectingOpenListItems && (!searchActive || searchHasListsOrFolders))
  const selectStripOpen = itemSelectActive || listSelectActive

  const placeItemsIntoLists = useCallback(
    (destListIds: string[]) => {
      const unique = [...new Set(destListIds.filter(Boolean))]
      if (unique.length === 0) return
      const state = useTaskStore.getState()
      selectedTaskIds.forEach((taskId) => {
        const t = state.tasks.find((x) => x.id === taskId)
        if (!t) return
        const next = placeTaskIntoDestinationLists(t, unique, {
          mode: effectiveItemPlacement,
          originListId,
          canMove: itemCanMove,
          lists: state.lists,
          folders: state.folders,
          types: itemTypes,
        })
        updateTask(next)
      })
      selection.cancelSelectMode()
    },
    [selectedTaskIds, effectiveItemPlacement, originListId, itemCanMove, updateTask, itemTypes, selection],
  )

  const handleSelectAllVisible = useCallback(() => {
    if (searchActive) {
      selectAll(
        searchResults.lists.map((l) => l.id),
        searchResults.folders.map((f) => f.id),
      )
      return
    }
    const ids = selectableEntryIds(entries)
    selectAll(ids.listIds, ids.folderIds)
  }, [searchActive, searchResults.lists, searchResults.folders, entries, selectAll])

  const handleSelectAllItems = useCallback(() => {
    if (searchActive) {
      selectAllTasks(searchResults.tasks.map((t) => t.id))
      return
    }
    selectAllTasks(listedTasks.map((t) => t.id))
  }, [searchActive, searchResults.tasks, listedTasks, selectAllTasks])

  const handleSelectAllSearchResults = useCallback(() => {
    selectAll(
      searchResults.lists.map((l) => l.id),
      searchResults.folders.map((f) => f.id),
    )
    selectAllTasks(searchResults.tasks.map((t) => t.id))
  }, [searchResults, selectAll, selectAllTasks])

  const handleDeleteSelectedItems = useCallback(() => {
    const n = selectedTaskIds.length
    if (n === 0) return
    if (!confirm(`Delete ${n} item${n === 1 ? "" : "s"}? This cannot be undone.`)) return
    selectedTaskIds.forEach((id) => deleteTask(id))
    selection.cancelSelectMode()
  }, [selectedTaskIds, deleteTask, selection])

  const handleDeleteSelected = useCallback(() => {
    const listCount = selectedCategories.length
    const folderCount = selectedFolderIds.length
    if (listCount + folderCount === 0) return
    const parts = [
      listCount ? `${listCount} list${listCount === 1 ? "" : "s"}` : "",
      folderCount ? `${folderCount} folder${folderCount === 1 ? "" : "s"}` : "",
    ].filter(Boolean)
    if (
      !confirm(
        `Delete ${parts.join(" and ")}? Items are kept. Folders are removed without deleting lists that are not also selected.`,
      )
    ) {
      return
    }
    selectedCategories.forEach((id) => {
      const live = useTaskStore.getState().lists.find((list) => list.id === id)
      if (live && (isRemindersList(live) || isPeopleIKnowList(live) || isInstagramPeopleList(live))) return
      folders.forEach((f) => {
        if (f.listIds.includes(id)) removeListFromFolder(f.id, id)
      })
      deleteList(id)
    })
    selectedFolderIds.forEach((id) => {
      if (!isScheduledFolderId(id)) deleteFolder(id)
    })
    if (openTarget?.type === "category" && selectedCategories.includes(openTarget.id)) closeTarget()
    if (currentFolder && selectedFolderIds.includes(currentFolder.id)) handleNavTo("all")
    selection.cancelSelectMode()
  }, [
    selectedCategories,
    selectedFolderIds,
    deleteList,
    deleteFolder,
    folders,
    removeListFromFolder,
    openTarget,
    closeTarget,
    currentFolder,
    handleNavTo,
    selection,
  ])

  const selectedMergeLists = useMemo(
    () => selectedCategories.map((id) => categories.find((c) => c.id === id)).filter((c): c is List => !!c),
    [selectedCategories, categories],
  )

  const selectedMergeItems = useMemo(
    () => selectedTaskIds.map((id) => allTasks.find((t) => t.id === id)).filter((t): t is Task => !!t),
    [selectedTaskIds, allTasks],
  )

  const handleApplyMerge = useCallback(
    (plan: ListMergePlan) => {
      // Search-result and folder select both land here — one replace path.
      const state = useTaskStore.getState()
      const next = applyListMerge({ lists: state.lists, folders: state.folders, tasks: state.tasks }, plan)
      setLists(next.lists, { tombstoneIds: plan.discardedIds })
      setFolders(next.folders)
      setTasks(next.tasks)
      setMergeOpen(false)
      selection.cancelSelectMode()
    },
    [setLists, setFolders, setTasks, selection],
  )

  const handleApplyItemMerge = useCallback(
    (plan: ItemMergePlan) => {
      // Search-result Select and open-list Select both call this — one replace
      // path. Read the live vault so we never merge a stale snapshot, then stamp
      // discarded ids so hub/persist union cannot resurrect originals.
      const live = useTaskStore.getState().tasks
      setTasks(applyItemMerge(live, plan), { tombstoneIds: plan.discardedIds })
      if (selectedTaskId && plan.discardedIds.includes(selectedTaskId)) setSelectedTaskId(null)
      setItemMergeOpen(false)
      selection.cancelSelectMode()
    },
    [setTasks, selectedTaskId, selection, setSelectedTaskId],
  )

  return {
    placementMode,
    setPlacementMode,
    itemPlacementMode,
    setItemPlacementMode,
    mergeConfirmOpen,
    setMergeConfirmOpen,
    mergeOpen,
    setMergeOpen,
    itemMergeConfirmOpen,
    setItemMergeConfirmOpen,
    itemMergeOpen,
    setItemMergeOpen,
    effectivePlacement,
    placeListsIntoFolder,
    originListId,
    itemCanMove,
    effectiveItemPlacement,
    selectingSearchResults,
    itemSelectActive,
    listSelectActive,
    selectStripOpen,
    placeItemsIntoLists,
    handleSelectAllVisible,
    handleSelectAllItems,
    handleSelectAllSearchResults,
    handleDeleteSelectedItems,
    handleDeleteSelected,
    selectedMergeLists,
    selectedMergeItems,
    handleApplyMerge,
    handleApplyItemMerge,
    clearSelection,
    clearTaskSelection,
  }
}
