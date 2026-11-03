/**
 * components/Lists/hooks/useListsCreate.ts
 *
 * New list and new folder dialogs, including bulk create. The toolbar search
 * seeds a new list name only when no list already has that exact name.
 * Filing the current selection uses the placement mode passed in.
 */
import { useCallback, useMemo, useState } from "react"
import { useTaskStore } from "@/lib/task-store"
import { isFolderAllItemsCategoryId } from "@/lib/folder-all-items"
import { originFolderIdToUnlink, wouldCreateFolderCycle, type ListPlacementMode } from "@/lib/folder-selection"
import {
  canMoveItemsFromOpenList,
  placeTaskInList,
  type ItemPlacementMode,
} from "@/lib/item-selection"
import { LIST_TEMPLATES } from "@/components/Lists/constants"
import type { NewListFields } from "@/components/Lists/dialogs/NewListDialog"
import type { NewFolderFields } from "@/components/Lists/dialogs/NewFolderDialog"
import type { OpenTarget } from "@/components/Lists/types"
import type { Folder, ItemTypeDefinition, List, Task } from "@/lib/types"

export function useListsCreate({
  categories,
  folders,
  itemTypes,
  searchTerm,
  currentFolder,
  isHome,
  isAll,
  openTarget,
  selectedTaskIds,
  selectedCategories,
  selectedFolderIds,
  itemPlacementMode,
  placementMode,
  addList,
  addFolder,
  addListToFolder,
  removeListFromFolder,
  updateFolder,
  updateTask,
  toggleHomePin,
  cancelSelectMode,
}: {
  categories: List[]
  folders: Folder[]
  itemTypes: ItemTypeDefinition[]
  searchTerm: string
  currentFolder: Folder | null
  isHome: boolean
  isAll: boolean
  openTarget: OpenTarget
  selectedTaskIds: string[]
  selectedCategories: string[]
  selectedFolderIds: string[]
  itemPlacementMode: ItemPlacementMode
  placementMode: ListPlacementMode
  addList: (list: List) => void
  addFolder: (folder: Folder) => void
  addListToFolder: (folderId: string, listId: string) => void
  removeListFromFolder: (folderId: string, listId: string) => void
  updateFolder: (folder: Folder) => void
  updateTask: (task: Task) => void
  toggleHomePin: (id: string) => void
  cancelSelectMode: () => void
}) {
  const [newCategoryOpen, setNewCategoryOpen] = useState(false)
  const [showNewFolderDialog, setShowNewFolderDialog] = useState(false)

  const newListSeed = useMemo(() => {
    const typed = searchTerm.trim()
    if (!typed) return ""
    const exact = categories.some(
      (list) => !isFolderAllItemsCategoryId(list.id) && list.name.trim().toLowerCase() === typed.toLowerCase(),
    )
    return exact ? "" : typed
  }, [searchTerm, categories])

  const openNewCategoryDialog = useCallback(() => {
    setNewCategoryOpen(true)
  }, [])

  const handleCreateCategory = useCallback((fields: NewListFields) => {
    if (!fields.name.trim()) return
    const id = Date.now().toString()
    const template = LIST_TEMPLATES[fields.template]
    addList({
      id,
      name: fields.name,
      color: fields.color,
      description: fields.description,
      createdAt: new Date(),
      order: categories.length,
      scheduleable: fields.scheduleable,
      itemAttributes: template?.attributes.length ? template.attributes.map((a) => ({ ...a })) : undefined,
    })
    if (currentFolder) addListToFolder(currentFolder.id, id)
    if (isHome) toggleHomePin(id)
    if (selectedTaskIds.length > 0) {
      const state = useTaskStore.getState()
      const originListId = openTarget?.type === "category" ? openTarget.id : null
      const canMove = canMoveItemsFromOpenList(originListId)
      const mode: ItemPlacementMode = canMove ? itemPlacementMode : "keep"
      selectedTaskIds.forEach((taskId) => {
        const t = state.tasks.find((x) => x.id === taskId)
        if (!t) return
        updateTask(
          placeTaskInList(t, id, {
            mode,
            originListId,
            canMove,
            lists: state.lists,
            folders: state.folders,
            types: itemTypes,
          }),
        )
      })
      cancelSelectMode()
    }
    setNewCategoryOpen(false)
  }, [addList, categories.length, currentFolder, addListToFolder, isHome, toggleHomePin, selectedTaskIds, openTarget, itemPlacementMode, updateTask, itemTypes, cancelSelectMode])

  const handleCreateFolder = useCallback((fields: NewFolderFields) => {
    if (!fields.name.trim()) return
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 5)
    addFolder({
      id,
      name: fields.name,
      createdAt: new Date(),
      listIds: selectedCategories,
      color: fields.color,
      scheduleable: fields.scheduleable,
      parentFolderId: currentFolder?.id,
    })
    const mode: ListPlacementMode = isAll ? "keep" : placementMode
    const unlink = originFolderIdToUnlink({ mode, originFolderId: currentFolder?.id, isAll })
    if (unlink) selectedCategories.forEach((catId) => removeListFromFolder(unlink, catId))
    if (mode === "move") {
      selectedFolderIds.forEach((fid) => {
        if (wouldCreateFolderCycle(folders, fid, id)) return
        const child = folders.find((f) => f.id === fid)
        if (child) updateFolder({ ...child, parentFolderId: id })
      })
    }
    setShowNewFolderDialog(false)
    cancelSelectMode()
  }, [
    addFolder,
    selectedCategories,
    currentFolder,
    placementMode,
    isAll,
    removeListFromFolder,
    selectedFolderIds,
    folders,
    updateFolder,
    cancelSelectMode,
  ])

  const handleBulkCreateFolders = useCallback(
    (fields: Omit<NewFolderFields, "name"> & { names: string[] }) => {
      for (const name of fields.names) {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5)
        addFolder({
          id,
          name,
          createdAt: new Date(),
          listIds: [],
          color: fields.color,
          scheduleable: fields.scheduleable,
          parentFolderId: currentFolder?.id,
        })
      }
      setShowNewFolderDialog(false)
    },
    [addFolder, currentFolder],
  )

  const handleBulkCreateLists = useCallback(
    (fields: Omit<NewListFields, "name"> & { names: string[] }) => {
      let order = categories.length
      for (const name of fields.names) {
        const id = Date.now().toString() + Math.random().toString(36).substr(2, 5)
        addList({
          id,
          name,
          color: fields.color,
          description: fields.description,
          createdAt: new Date(),
          order: order++,
          scheduleable: fields.scheduleable,
        })
        if (currentFolder) addListToFolder(currentFolder.id, id)
        if (isHome) toggleHomePin(id)
      }
      setNewCategoryOpen(false)
    },
    [addList, addListToFolder, categories.length, currentFolder, isHome, toggleHomePin],
  )

  return {
    newCategoryOpen,
    setNewCategoryOpen,
    showNewFolderDialog,
    setShowNewFolderDialog,
    newListSeed,
    openNewCategoryDialog,
    handleCreateCategory,
    handleCreateFolder,
    handleBulkCreateFolders,
    handleBulkCreateLists,
  }
}
