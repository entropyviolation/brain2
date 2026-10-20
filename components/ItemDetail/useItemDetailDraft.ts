/**
 * components/ItemDetail/useItemDetailDraft.ts — Shared item-detail draft state
 *
 * The logic both detail variants (popup + page) share: subscribe to the task
 * store, load the selected task into local draft state, and the
 * category/dependency mutators that are byte-identical across both.
 * `subscribeDraft` fires when the draft ref changes so the save lamp can
 * follow keystrokes without re-rendering the detail tree. `setTask` applies
 * functional updates to that ref, so a later field write keeps uncommitted
 * keystrokes.
 * `addDependency` refuses a graph loop (`findCyclePath`) and returns the cycle
 * label for a Win95 confirm — it does not write `Task.dependencies` on refuse.
 * `undo` / `redo` walk the draft's own edit history (hierarchy moves,
 * deletes, tags, links…): `setTask` pushes the draft it replaces, bursts inside
 * `UNDO_COALESCE_MS` count as one step, and loading or saving starts a fresh
 * history. Steps the page already wrote to the store are written back too.
 * Variant-
 * specific behavior (scheduling UX, completion flow, subtasks) stays in each
 * component. This is the de-duplication seam for the consolidated ItemDetail.
 *
 * Spec: §5.5 (Item detail view).
 */
"use client"

import { useState, useEffect, useCallback, useRef, type Dispatch, type SetStateAction } from "react"
import { commitItemDraft } from "@/lib/commit-item-edit"
import { snapshotsEqual } from "@/lib/unsaved-changes"
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
import { findCyclePath } from "@/lib/critical-path"
import { itemTitle } from "@/lib/item-utils"

/** Edits closer together than this undo as one step. */
const UNDO_COALESCE_MS = 500
const MAX_DRAFT_HISTORY = 50

export type AddDependencyResult =
  | { ok: true }
  | { ok: false; cycleIds: string[]; cycleLabel: string }

export interface ItemDetailDraft {
  task: Task | null
  setTask: Dispatch<SetStateAction<Task | null>>
  /** Latest draft including isolated-field keystrokes that have not re-rendered yet. */
  getDraft: () => Task | null
  /** Step the draft back one edit. False when there is nothing to undo. */
  undo: () => boolean
  redo: () => boolean
  /** Fires when `touchDraft` writes the ref. The save lamp listens; the detail tree does not. */
  subscribeDraft: (listener: () => void) => () => void
  /** Write fields onto the draft ref without re-rendering the detail tree. */
  touchDraft: (patch: Partial<Task>) => void
  originalTask: Task | null
  setOriginalTask: (task: Task | null) => void
  /** Live dirty check: the draft ref (with unrendered keystrokes) against the saved baseline. */
  isDraftDirty: () => boolean
  allTasks: Task[]
  lists: ReturnType<typeof useTaskStore.getState>["lists"]
  folders: ReturnType<typeof useTaskStore.getState>["folders"]
  updateTask: (task: Task) => void
  /**
   * Persist a draft through `commitItemEdit` (patch + activity line).
   * Prefer this over `recordItemWrite` + `updateTask` for detail saves.
   */
  commitDraft: (next: Task, source?: string) => Task
  addTask: (task: Task) => void
  deleteTask: (id: string) => void
  addToCategory: (categoryId: string) => void
  removeFromCategory: (categoryId: string) => void
  setLists: (listIds: string[]) => void
  removeDependency: (dependencyId: string) => void
  addDependency: (dependencyId: string) => AddDependencyResult
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
  const [originalTask, setOriginalTaskState] = useState<Task | null>(null)
  const originalRef = useRef<Task | null>(null)
  const taskRef = useRef<Task | null>(null)
  const draftListenersRef = useRef(new Set<() => void>())

  const pastRef = useRef<Task[]>([])
  const futureRef = useRef<Task[]>([])
  const lastEditAtRef = useRef(0)

  /** Write the draft without recording history (load, save, undo, redo). */
  const applyTask = useCallback((resolved: Task | null) => {
    taskRef.current = resolved
    setTaskState(resolved)
    for (const listener of draftListenersRef.current) listener()
  }, [])

  const resetHistory = useCallback(() => {
    pastRef.current = []
    futureRef.current = []
    lastEditAtRef.current = 0
  }, [])

  const setTask = useCallback<Dispatch<SetStateAction<Task | null>>>(
    (next) => {
      const prev = taskRef.current
      const resolved = typeof next === "function" ? next(prev) : next
      if (prev && resolved && resolved !== prev && resolved.id === prev.id) {
        const now = Date.now()
        if (now - lastEditAtRef.current > UNDO_COALESCE_MS || pastRef.current.length === 0) {
          pastRef.current.push(prev)
          if (pastRef.current.length > MAX_DRAFT_HISTORY) pastRef.current.shift()
        }
        lastEditAtRef.current = now
        futureRef.current = []
      } else {
        resetHistory()
      }
      applyTask(resolved)
    },
    [applyTask, resetHistory],
  )

  const stepHistory = useCallback(
    (from: Task[], to: Task[]): boolean => {
      const current = taskRef.current
      const target = from.pop()
      if (!current || !target) return false
      to.push(current)
      lastEditAtRef.current = 0
      // The page writes subtask edits straight to the store; keep it in step.
      const stored = useTaskStore.getState().tasks.find((t) => t.id === current.id)
      if (stored && JSON.stringify(stored.subtasks ?? null) === JSON.stringify(current.subtasks ?? null)) {
        if (JSON.stringify(target.subtasks ?? null) !== JSON.stringify(stored.subtasks ?? null)) {
          useTaskStore.getState().updateTask({ ...stored, subtasks: target.subtasks })
        }
      }
      applyTask(target)
      return true
    },
    [applyTask],
  )
  const undo = useCallback(() => stepHistory(pastRef.current, futureRef.current), [stepHistory])
  const redo = useCallback(() => stepHistory(futureRef.current, pastRef.current), [stepHistory])

  const getDraft = useCallback(() => taskRef.current, [])

  const setOriginalTask = useCallback((next: Task | null) => {
    originalRef.current = next
    setOriginalTaskState(next)
  }, [])

  const isDraftDirty = useCallback(
    () =>
      !!taskRef.current &&
      !!originalRef.current &&
      !snapshotsEqual(taskRef.current, originalRef.current),
    [],
  )

  const touchDraft = useCallback((patch: Partial<Task>) => {
    if (!taskRef.current) return
    taskRef.current = { ...taskRef.current, ...patch }
    for (const listener of draftListenersRef.current) listener()
  }, [])

  const subscribeDraft = useCallback((listener: () => void) => {
    draftListenersRef.current.add(listener)
    return () => {
      draftListenersRef.current.delete(listener)
    }
  }, [])

  useEffect(() => {
    resetHistory()
    if (!taskId) {
      applyTask(null)
      setOriginalTask(null)
      return
    }
    const foundTask = useTaskStore.getState().tasks.find((t) => t.id === taskId)
    if (foundTask) {
      applyTask(foundTask)
      setOriginalTask(foundTask)
    }
  }, [taskId, applyTask, resetHistory, setOriginalTask])

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

  const addDependency = useCallback(
    (dependencyId: string): AddDependencyResult => {
      const current = taskRef.current
      if (!current || !dependencyId || dependencyId === "none") return { ok: true }
      if ((current.dependencies ?? []).includes(dependencyId)) return { ok: true }
      const graph = allTasks.some((t) => t.id === current.id)
        ? allTasks.map((t) => (t.id === current.id ? current : t))
        : [...allTasks, current]
      const cycleIds = findCyclePath(graph, current.id, dependencyId)
      if (cycleIds.length) {
        const cycleLabel = cycleIds
          .map((id) => itemTitle(graph.find((t) => t.id === id)) || id)
          .join(" → ")
        return { ok: false, cycleIds, cycleLabel }
      }
      setTask({
        ...current,
        dependencies: [...(current.dependencies ?? []), dependencyId],
      })
      return { ok: true }
    },
    [allTasks, setTask],
  )

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

  const commitDraft = useCallback(
    (next: Task, source = "item-detail") => {
      const before = originalRef.current ?? useTaskStore.getState().tasks.find((t) => t.id === next.id)
      resetHistory()
      if (!before) {
        updateTask(next)
        setOriginalTask(next)
        applyTask(next)
        return next
      }
      const saved = commitItemDraft(before, next, source)
      setOriginalTask(saved)
      applyTask(saved)
      return saved
    },
    [updateTask, applyTask, resetHistory, setOriginalTask],
  )

  return {
    task,
    setTask,
    undo,
    redo,
    getDraft,
    subscribeDraft,
    touchDraft,
    originalTask,
    setOriginalTask,
    isDraftDirty,
    allTasks,
    lists,
    folders,
    updateTask,
    commitDraft,
    addTask,
    deleteTask,
    addToCategory,
    removeFromCategory,
    setLists,
    removeDependency,
    addDependency,
    addTag,
    removeTag,
    addLink,
    removeLink,
  }
}
