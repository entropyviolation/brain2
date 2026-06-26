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

import { useState, useEffect, useCallback } from "react"
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
  setTask: (task: Task) => void
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

  const [task, setTask] = useState<Task | null>(null)
  const [originalTask, setOriginalTask] = useState<Task | null>(null)

  useEffect(() => {
    if (taskId) {
      const foundTask = allTasks.find((t) => t.id === taskId)
      if (foundTask) {
        setTask(foundTask)
        setOriginalTask(foundTask)
      }
    }
  }, [taskId, allTasks])

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
    setTask: setTask as (task: Task) => void,
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
