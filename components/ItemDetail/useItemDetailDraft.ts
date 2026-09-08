/**
 * components/ItemDetail/useItemDetailDraft.ts — Shared item-detail draft state
 *
 * The logic both detail variants (popup + page) share: subscribe to the task
 * store, load the selected task into local draft state, and the
 * category/dependency mutators that are byte-identical across both. Variant-
 * specific behavior (scheduling UX, completion flow, subtasks) stays in each
 * component. This is the de-duplication seam for the consolidated ItemDetail.
 *
 * Spec: §5.5 (Item detail view).
 */
"use client"

import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from "react"
import { useTaskStore } from "@/lib/task-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { withListMembership } from "@/lib/item-utils"
import {
  addTag as addTagToList,
  removeTag as removeTagFromList,
  addLink as addLinkToList,
  removeLink as removeLinkFromList,
} from "@/lib/links"
import type { Task } from "@/lib/types"

export interface ItemDetailDraft {
  task: Task | null
  setTask: Dispatch<SetStateAction<Task | null>>
  /** Latest draft including isolated-field keystrokes that have not re-rendered yet. */
  getDraft: () => Task | null
  /** Write fields onto the draft ref without re-rendering the detail tree. */
  touchDraft: (patch: Partial<Task>) => void
  originalTask: Task | null
  setOriginalTask: (task: Task | null) => void
  allTasks: Task[]
  lists: ReturnType<typeof useTaskStore.getState>["lists"]
  folders: ReturnType<typeof useTaskStore.getState>["folders"]
  updateTask: (task: Task) => void
  addTask: (task: Task) => void
  deleteTask: (id: string) => void
  addToCategory: (categoryId: string) => void
  removeFromCategory: (categoryId: string) => void
  setLists: (listIds: string[]) => void
  removeDependency: (dependencyId: string) => void
  addTag: (tag: string) => void
  removeTag: (tag: string) => void
  addLink: (relation: string, targetId: string) => void
  removeLink: (linkId: string) => void
}

/** Load + draft state and the mutators common to every item-detail variant. */
export function useItemDetailDraft(taskId: string | null): ItemDetailDraft {
  const allTasks = useTaskStore((state) => state.tasks)
  const lists = useTaskStore((state) => state.lists)
  const folders = useTaskStore((state) => state.folders)
  const updateTask = useTaskStore((state) => state.updateTask)
  const addTask = useTaskStore((state) => state.addTask)
  const deleteTask = useTaskStore((state) => state.deleteTask)
  const types = useItemTypeStore((state) => state.types)

  const [task, setTaskState] = useState<Task | null>(null)
  const [originalTask, setOriginalTask] = useState<Task | null>(null)
  const taskRef = useRef<Task | null>(null)

  const setTask = useCallback<Dispatch<SetStateAction<Task | null>>>((next) => {
    setTaskState((prev) => {
      const resolved = typeof next === "function" ? next(prev) : next
      taskRef.current = resolved
      return resolved
    })
  }, [])

  const getDraft = useCallback(() => taskRef.current, [])

  const touchDraft = useCallback((patch: Partial<Task>) => {
    if (!taskRef.current) return
    taskRef.current = { ...taskRef.current, ...patch }
  }, [])

  useEffect(() => {
    if (!taskId) {
      setTask(null)
      setOriginalTask(null)
      return
    }
    const foundTask = useTaskStore.getState().tasks.find((t) => t.id === taskId)
    if (foundTask) {
      setTask(foundTask)
      setOriginalTask(foundTask)
    }
  }, [taskId, setTask])

  const addToCategory = useCallback(
    (categoryId: string) => {
      setTask((prev) => {
        if (!prev || prev.lists?.includes(categoryId)) return prev
        const withCat = { ...prev, lists: [...(prev.lists || []), categoryId] }
        // Adopt the list's item type + seed its default attributes (parity with drag).
        const cat = lists.find((c) => c.id === categoryId)
        return withListMembership(withCat, cat, types)
      })
    },
    [lists, types],
  )

  const removeFromCategory = useCallback((categoryId: string) => {
    setTask((prev) =>
      prev ? { ...prev, lists: prev.lists?.filter((id) => id !== categoryId) || [] } : prev,
    )
  }, [])

  const setLists = useCallback(
    (listIds: string[]) => {
      setTask((prev) => {
        if (!prev) return prev
        const added = listIds.filter((id) => !(prev.lists || []).includes(id))
        let next: Task = { ...prev, lists: listIds }
        for (const id of added) {
          next = withListMembership(next, lists.find((c) => c.id === id), types)
        }
        return next
      })
    },
    [lists, types],
  )

  const removeDependency = useCallback((dependencyId: string) => {
    setTask((prev) =>
      prev ? { ...prev, dependencies: (prev.dependencies ?? []).filter((id) => id !== dependencyId) } : prev,
    )
  }, [])

  const addTag = useCallback((tag: string) => {
    setTask((prev) => (prev ? { ...prev, tags: addTagToList(prev.tags, tag) } : prev))
  }, [])

  const removeTag = useCallback((tag: string) => {
    setTask((prev) => (prev ? { ...prev, tags: removeTagFromList(prev.tags, tag) } : prev))
  }, [])

  const addLink = useCallback((relation: string, targetId: string) => {
    setTask((prev) => (prev ? { ...prev, links: addLinkToList(prev.links, relation, targetId, prev.id) } : prev))
  }, [])

  const removeLink = useCallback((linkId: string) => {
    setTask((prev) => (prev ? { ...prev, links: removeLinkFromList(prev.links, linkId) } : prev))
  }, [])

  return {
    task,
    setTask,
    getDraft,
    touchDraft,
    originalTask,
    setOriginalTask,
    allTasks,
    lists,
    folders,
    updateTask,
    addTask,
    deleteTask,
    addToCategory,
    removeFromCategory,
    setLists,
    removeDependency,
    addTag,
    removeTag,
    addLink,
    removeLink,
  }
}
