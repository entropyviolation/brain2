// Page-only save, delete, complete, reopen, missed, and item-type commands. Not for ItemDetailPopup, the To do drawer, or the task card.
"use client"

import { useCallback, type Dispatch, type MutableRefObject, type SetStateAction } from "react"
import { withCompleted } from "@/lib/completion-status"
import type { ItemTypeDefinition, Task } from "@/lib/types"

export function useItemDetailPageCommands({
  task,
  getDraft,
  commitDraft,
  deleteTask,
  onBack,
  setIsEditing,
  actualDurationRef,
  setMissAsk,
  itemTypes,
  updateItemType,
  addItemType,
  deleteItemType,
  editingItemType,
  setEditingItemType,
}: {
  task: Task | null
  getDraft: () => Task | null
  commitDraft: (next: Task) => Task
  deleteTask: (id: string) => void
  onBack: () => void
  setIsEditing: Dispatch<SetStateAction<boolean>>
  actualDurationRef: MutableRefObject<string>
  setMissAsk: Dispatch<SetStateAction<boolean>>
  itemTypes: ItemTypeDefinition[]
  updateItemType: (def: ItemTypeDefinition) => void
  addItemType: (def: ItemTypeDefinition) => void
  deleteItemType: (id: string) => void
  editingItemType: ItemTypeDefinition | null
  setEditingItemType: Dispatch<SetStateAction<ItemTypeDefinition | null>>
}) {
  const handleSave = useCallback(() => {
    const draft = getDraft()
    if (draft) {
      commitDraft(draft)
      setIsEditing(false)
    }
  }, [getDraft, commitDraft, setIsEditing])

  const handleDelete = useCallback(() => {
    if (!task) return
    if (confirm(`Delete "${task.description}"? This cannot be undone.`)) {
      deleteTask(task.id)
      onBack()
    }
  }, [task, deleteTask, onBack])

  const handleComplete = useCallback(() => {
    const draft = getDraft()
    if (draft) {
      const raw = actualDurationRef.current
      const actualDuration = raw ? Number.parseInt(raw) : undefined
      commitDraft({
        ...draft,
        completed: true,
        actualDuration: actualDuration,
      })
    }
  }, [getDraft, commitDraft, actualDurationRef])

  const handleReopen = useCallback(() => {
    const draft = getDraft()
    if (draft) commitDraft(withCompleted(draft, false))
  }, [getDraft, commitDraft])

  const handleMissed = useCallback(() => {
    if (!task) return
    setMissAsk(true)
  }, [task, setMissAsk])

  const handleSaveItemType = useCallback(
    (def: ItemTypeDefinition) => {
      if (itemTypes.some((t) => t.id === def.id)) updateItemType(def)
      else addItemType(def)
      setEditingItemType(null)
    },
    [itemTypes, updateItemType, addItemType, setEditingItemType],
  )

  const deleteEditingItemType =
    editingItemType && !editingItemType.builtin
      ? () => {
          if (
            typeof window !== "undefined" &&
            !window.confirm(`Delete the "${editingItemType.name}" item type? Items keep their data.`)
          ) {
            return
          }
          deleteItemType(editingItemType.id as string)
          setEditingItemType(null)
        }
      : undefined

  return {
    handleSave,
    handleDelete,
    handleComplete,
    handleReopen,
    handleMissed,
    handleSaveItemType,
    deleteEditingItemType,
  }
}
