import { useCallback } from "react"
import type { Task, TaskCategory, CategoryFolder } from "@/lib/types"
import { getWeekString } from "@/lib/date-utils"
import {
  createListItem,
  createNextActionItem,
  withCategoryDefaults,
  categoryIsNextActions,
} from "@/lib/item-utils"
import {
  isNaSmartCategoryId,
  naSmartIdToPeriod,
} from "@/lib/scheduled-lists-sync"
import {
  assignTaskToFolderUncategorized,
} from "@/lib/folder-all-items"
import { ROOT_ALL_FOLDER_ID } from "@/components/Lists/constants"
import type { OpenTarget } from "@/components/Lists/types"

export function useListsTaskActions(
  allTasks: Task[],
  categories: TaskCategory[],
  folders: CategoryFolder[],
  addTask: (task: Task) => void,
  updateTask: (task: Task) => void,
) {
  const buildBaseTask = useCallback(
    (description: string, categoryId?: string): Task => {
      const nextAction = categoryId ? categoryIsNextActions(categoryId, folders) : false
      const base = nextAction
        ? createNextActionItem(description, categoryId ? [categoryId] : [])
        : createListItem(description, categoryId ? [categoryId] : [])
      if (categoryId) {
        const cat = categories.find((c) => c.id === categoryId)
        return withCategoryDefaults(base, cat)
      }
      return base
    },
    [categories, folders],
  )

  const handleCompleteTask = useCallback(
    (taskId: string) => {
      const task = allTasks.find((t) => t.id === taskId)
      if (task) updateTask({ ...task, completed: !task.completed })
    },
    [allTasks, updateTask],
  )

  const handleAddTaskToOpen = useCallback(
    (
      newTaskDescription: string,
      openTarget: OpenTarget,
      currentFolder: CategoryFolder | null,
      onDone: () => void,
    ) => {
      if (!newTaskDescription.trim() || !openTarget) return
      const base = buildBaseTask(newTaskDescription, openTarget.type === "category" ? openTarget.id : undefined)
      if (openTarget.type === "category") {
        base.categories = [openTarget.id]
      } else if (openTarget.type === "folder-all" && openTarget.folderId === ROOT_ALL_FOLDER_ID) {
        base.category = "list"
      } else if (openTarget.type === "folder-all" && currentFolder) {
        Object.assign(base, assignTaskToFolderUncategorized(base, currentFolder))
      } else if (openTarget.type === "smart") {
        const now = new Date()
        if (openTarget.id === "daily") base.scheduledDate = now
        else if (openTarget.id === "weekly") base.scheduledWeek = getWeekString(now)
        else base.scheduledMonth = now.toISOString().slice(0, 7)
      }
      addTask(base)
      onDone()
    },
    [buildBaseTask, addTask],
  )

  const handleBulkAddToOpen = useCallback(
    (
      bulkAddText: string,
      openTarget: OpenTarget,
      currentFolder: CategoryFolder | null,
      onDone: () => void,
    ) => {
      if (!openTarget || !bulkAddText.trim()) return
      const lines = bulkAddText.split("\n").map((l) => l.trim()).filter(Boolean)
      const now = new Date()
      for (const line of lines) {
        let categoryId: string | undefined
        if (openTarget.type === "category" && !isNaSmartCategoryId(openTarget.id)) categoryId = openTarget.id
        const base = buildBaseTask(line, categoryId)
        if (openTarget.type === "category") {
          if (isNaSmartCategoryId(openTarget.id)) {
            const p = naSmartIdToPeriod(openTarget.id)
            if (p === "daily") base.scheduledDate = now
            else if (p === "weekly") base.scheduledWeek = getWeekString(now)
            else base.scheduledMonth = now.toISOString().slice(0, 7)
          } else {
            base.categories = [openTarget.id]
          }
        } else if (openTarget.type === "smart") {
          if (openTarget.id === "daily") base.scheduledDate = now
          else if (openTarget.id === "weekly") base.scheduledWeek = getWeekString(now)
          else base.scheduledMonth = now.toISOString().slice(0, 7)
        } else if (openTarget.type === "folder-all" && openTarget.folderId === ROOT_ALL_FOLDER_ID) {
          base.category = "list"
        } else if (openTarget.type === "folder-all" && currentFolder) {
          Object.assign(base, assignTaskToFolderUncategorized(base, currentFolder))
        }
        addTask(base)
      }
      onDone()
    },
    [buildBaseTask, addTask],
  )

  const handleAddTaskToCategory = useCallback(
    (categoryId: string, newTaskDescription: string, onDone: () => void) => {
      if (!newTaskDescription.trim()) return
      const base = buildBaseTask(newTaskDescription, categoryId)
      base.categories = [categoryId]
      addTask(base)
      onDone()
    },
    [buildBaseTask, addTask],
  )

  return {
    buildBaseTask,
    handleCompleteTask,
    handleAddTaskToOpen,
    handleBulkAddToOpen,
    handleAddTaskToCategory,
  }
}
