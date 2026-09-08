import { useCallback } from "react"
import type { Task, List, Folder, ItemTypeDefinition } from "@/lib/types"
import { getWeekString } from "@/lib/date-utils"
import {
  createListItem,
  createNextActionItem,
  withListMembership,
  listIsNextActions,
} from "@/lib/item-utils"
import {
  isNaSmartCategoryId,
  naSmartIdToPeriod,
} from "@/lib/scheduled-lists-sync"
import {
  assignTaskToFolderUncategorized,
} from "@/lib/folder-all-items"
import { toggleCompletion } from "@/lib/services/completion-service"
import { parseListBulkAddText } from "@/lib/smart-parse"
import { addTag } from "@/lib/links"
import { ROOT_ALL_FOLDER_ID } from "@/components/Lists/constants"
import type { OpenTarget } from "@/components/Lists/types"

export function useListsTaskActions(
  lists: List[],
  folders: Folder[],
  addTask: (task: Task) => void,
  types: ItemTypeDefinition[] = [],
) {
  const buildBaseTask = useCallback(
    (description: string, categoryId?: string): Task => {
      const nextAction = categoryId ? listIsNextActions(categoryId, folders) : false
      const base = nextAction
        ? createNextActionItem(description, categoryId ? [categoryId] : [])
        : createListItem(description, categoryId ? [categoryId] : [])
      if (categoryId) {
        const cat = lists.find((c) => c.id === categoryId)
        return withListMembership(base, cat, types)
      }
      return base
    },
    [lists, folders, types],
  )

  const handleCompleteTask = useCallback((taskId: string) => {
    toggleCompletion(taskId)
  }, [])

  const handleAddTaskToOpen = useCallback(
    (
      newTaskDescription: string,
      openTarget: OpenTarget,
      currentFolder: Folder | null,
      onDone: () => void,
    ) => {
      if (!newTaskDescription.trim() || !openTarget) return
      const base = buildBaseTask(newTaskDescription, openTarget.type === "category" ? openTarget.id : undefined)
      if (openTarget.type === "category") {
        base.lists = [openTarget.id]
      } else if (openTarget.type === "folder-all" && openTarget.folderId === ROOT_ALL_FOLDER_ID) {
        base.stage = "list"
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
      currentFolder: Folder | null,
      onDone: () => void,
    ) => {
      if (!openTarget || !bulkAddText.trim()) return
      const rows = parseListBulkAddText(bulkAddText)
      if (rows.length === 0) return
      const now = new Date()
      for (const row of rows) {
        let categoryId: string | undefined
        if (openTarget.type === "category" && !isNaSmartCategoryId(openTarget.id)) categoryId = openTarget.id
        const base = buildBaseTask(row.description, categoryId)
        const tagged: Task = {
          ...base,
          tags: row.tags.reduce((acc, tag) => addTag(acc, tag), [...(base.tags ?? [])]),
        }
        if (openTarget.type === "category") {
          if (isNaSmartCategoryId(openTarget.id)) {
            const p = naSmartIdToPeriod(openTarget.id)
            if (p === "daily") tagged.scheduledDate = now
            else if (p === "weekly") tagged.scheduledWeek = getWeekString(now)
            else tagged.scheduledMonth = now.toISOString().slice(0, 7)
          } else {
            tagged.lists = [openTarget.id]
          }
        } else if (openTarget.type === "smart") {
          if (openTarget.id === "daily") tagged.scheduledDate = now
          else if (openTarget.id === "weekly") tagged.scheduledWeek = getWeekString(now)
          else tagged.scheduledMonth = now.toISOString().slice(0, 7)
        } else if (openTarget.type === "folder-all" && openTarget.folderId === ROOT_ALL_FOLDER_ID) {
          tagged.stage = "list"
        } else if (openTarget.type === "folder-all" && currentFolder) {
          Object.assign(tagged, assignTaskToFolderUncategorized(tagged, currentFolder))
        }
        addTask(tagged)
      }
      onDone()
    },
    [buildBaseTask, addTask],
  )

  const handleAddTaskToCategory = useCallback(
    (categoryId: string, newTaskDescription: string, onDone: () => void) => {
      if (!newTaskDescription.trim()) return
      const base = buildBaseTask(newTaskDescription, categoryId)
      base.lists = [categoryId]
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
