import { useCallback, useState } from "react"
import type React from "react"
import type { Task, CategoryFolder } from "@/lib/types"
import { getWeekString } from "@/lib/date-utils"
import {
  assignTaskToFolderList,
  assignTaskToFolderUncategorized,
  isFolderAllItemsCategoryId,
} from "@/lib/folder-all-items"
import { isScheduledFolderId } from "@/lib/scheduled-lists-sync"
import type { GridEntry, SmartId } from "@/components/Lists/types"

export interface UseListsDragDropOptions {
  folders: CategoryFolder[]
  updateTask: (task: Task) => void
  addCategoryToFolder: (folderId: string, categoryId: string) => void
  removeCategoryFromFolder: (folderId: string, categoryId: string) => void
}

export function useListsDragDrop({
  folders,
  updateTask,
  addCategoryToFolder,
  removeCategoryFromFolder,
}: UseListsDragDropOptions) {
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [draggedCategoryId, setDraggedCategoryId] = useState<string | null>(null)
  const [dropTargetId, setDropTargetId] = useState<string | null>(null)

  const handleTaskDragStart = useCallback((e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    setDraggedCategoryId(null)
    e.dataTransfer.effectAllowed = "copyMove"
    try {
      e.dataTransfer.setData("text/plain", `task:${task.id}`)
    } catch {
      /* noop */
    }
  }, [])

  const handleCategoryDragStart = useCallback((e: React.DragEvent, categoryId: string) => {
    setDraggedCategoryId(categoryId)
    setDraggedTask(null)
    e.dataTransfer.effectAllowed = "move"
    try {
      e.dataTransfer.setData("text/plain", `list:${categoryId}`)
    } catch {
      /* noop */
    }
  }, [])

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.dataTransfer.dropEffect = draggedCategoryId ? "move" : "copy"
    },
    [draggedCategoryId],
  )

  const clearDrag = useCallback(() => {
    setDraggedTask(null)
    setDraggedCategoryId(null)
    setDropTargetId(null)
  }, [])

  const fileCategoryIntoFolder = useCallback(
    (categoryId: string, folderId: string | null) => {
      folders.forEach((f) => {
        if (f.categoryIds.includes(categoryId)) removeCategoryFromFolder(f.id, categoryId)
      })
      if (folderId) addCategoryToFolder(folderId, categoryId)
    },
    [folders, addCategoryToFolder, removeCategoryFromFolder],
  )

  const applySmartScheduleToTask = useCallback(
    (task: Task, smart: SmartId) => {
      const now = new Date()
      const patch: Partial<Task> = {}
      if (smart === "daily") patch.scheduledDate = now
      else if (smart === "weekly") patch.scheduledWeek = getWeekString(now)
      else patch.scheduledMonth = now.toISOString().slice(0, 7)
      updateTask({ ...task, ...patch })
    },
    [updateTask],
  )

  const handleDropOnEntry = useCallback(
    (e: React.DragEvent, entry: GridEntry) => {
      e.preventDefault()
      e.stopPropagation()
      if (draggedTask) {
        if (entry.kind === "list" && !draggedTask.categories?.includes(entry.id)) {
          const folder = folders.find((f) => f.categoryIds.includes(entry.id))
          if (folder && !isFolderAllItemsCategoryId(entry.id)) {
            updateTask(assignTaskToFolderList(draggedTask, folder, entry.id))
          } else {
            updateTask({ ...draggedTask, categories: [...(draggedTask.categories || []), entry.id] })
          }
        } else if (entry.kind === "smart") {
          applySmartScheduleToTask(draggedTask, entry.id as SmartId)
        } else if (entry.kind === "folder" && !isScheduledFolderId(entry.id)) {
          const folder = folders.find((f) => f.id === entry.id)
          if (folder) updateTask(assignTaskToFolderUncategorized(draggedTask, folder))
        }
      } else if (draggedCategoryId) {
        if (entry.kind === "folder") {
          fileCategoryIntoFolder(draggedCategoryId, entry.id)
        } else if (entry.kind === "folder-all") {
          fileCategoryIntoFolder(draggedCategoryId, null)
        }
      }
      clearDrag()
    },
    [draggedTask, draggedCategoryId, updateTask, applySmartScheduleToTask, fileCategoryIntoFolder, clearDrag, folders],
  )

  const handleIconCanvasDrop = useCallback(
    (e: React.DragEvent, isAll: boolean, currentFolder: CategoryFolder | null) => {
      e.preventDefault()
      e.stopPropagation()
      if (draggedCategoryId && (isAll || currentFolder)) {
        fileCategoryIntoFolder(draggedCategoryId, null)
      }
      clearDrag()
    },
    [draggedCategoryId, fileCategoryIntoFolder, clearDrag],
  )

  const handleFolderTreeDrop = useCallback(
    (e: React.DragEvent, folder: CategoryFolder | null) => {
      e.preventDefault()
      if (draggedTask && folder && !isScheduledFolderId(folder.id)) {
        updateTask(assignTaskToFolderUncategorized(draggedTask, folder))
      } else if (draggedCategoryId && folder) {
        fileCategoryIntoFolder(draggedCategoryId, folder.id)
      } else if (draggedCategoryId && !folder) {
        fileCategoryIntoFolder(draggedCategoryId, null)
      }
      clearDrag()
    },
    [draggedTask, draggedCategoryId, updateTask, fileCategoryIntoFolder, clearDrag],
  )

  return {
    draggedTask,
    draggedCategoryId,
    dropTargetId,
    setDropTargetId,
    handleTaskDragStart,
    handleCategoryDragStart,
    handleDragOver,
    clearDrag,
    handleDropOnEntry,
    handleIconCanvasDrop,
    handleFolderTreeDrop,
    fileCategoryIntoFolder,
  }
}
