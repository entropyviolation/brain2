/**
 * lib/task-store.ts — Tasks, lists & folders store
 *
 * The central Zustand store and source of truth for tasks, their lists, and
 * category folders. Powers the Inbox, Next Actions board, Scheduler funnel, and
 * the Home dashboard's To-Do/Plan panels. Persisted to localStorage under
 * `cogs-task-storage` with Date-aware (de)serialization and a versioned
 * migration hook. Also exposes the configurable priority formula and
 * `calculatePriorityScore`.
 *
 * Spec: §4 (Inbox), §5 (Item model), §6 (Next Actions), §7 (Scheduler). Storage
 * is localStorage today; spec §3 calls for migrating this to **MongoDB**
 * (flexible document model, text/vector search, aggregation-based routing) with
 * one-click JSON export/import (see docs/SPEC_MAPPING.md §3).
 */
"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"
import type { Task, List, Folder, PriorityWeights } from "@/lib/types"
import { DEFAULT_PRIORITY_WEIGHTS } from "@/lib/priority"
import { migratePersistedAttributes } from "@/lib/attribute-utils"
import { migrateTaskToItem, migrateTasksToItems, migrateModulePlatform } from "@/lib/migrations"
import { dispatchItemMutation } from "@/lib/workflow-hooks"
import { usePointsStore } from "@/lib/points-store"
import { resolveCompletionPoints, applyItemRules } from "@/lib/item-utils"
import { emitTaskCompleted } from "@/lib/completion-events"
import { useItemTypeStore } from "@/lib/item-type-store"
import { normalizeTag } from "@/lib/links"
import {
  moveList as moveListPure,
  getChildren as getChildListsPure,
  getDescendants as getDescendantListsPure,
  getAncestors as getListAncestorsPure,
} from "@/lib/list-tree"

// Date-typed fields on persisted Task / List objects. The persist reviver
// only resurrects Dates for these keys so it never converts unrelated strings
// (e.g. `scheduledTime`, `scheduledWeek`, `timeLogs[].date`).
const DATE_KEYS = new Set([
  "createdAt",
  "deadline",
  "scheduledDate",
  "mustBeDoneAfter",
  "mustBeDoneBefore",
])

// Matches ISO-8601 strings produced by `Date.prototype.toISOString()`
// (e.g. "2026-06-23T08:33:00.000Z"), including timezone offset variants.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

interface TaskState {
  tasks: Task[]
  lists: List[]
  folders: Folder[]
  priorityFormula: {
    urgencyWeight: number
    importanceWeight: number
    effortWeight: number
    cognitiveLoadWeight: number
  }
  /** Tunable weights for the transparent To-Do priority formula (lib/priority.ts). */
  priorityWeights: PriorityWeights
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  deleteTask: (id: string) => void
  updatePriorityFormula: (formula: TaskState["priorityFormula"]) => void
  updatePriorityWeights: (weights: PriorityWeights) => void
  addList: (category: List) => void
  updateList: (category: List) => void
  deleteList: (id: string) => void
  /**
   * Re-parent a category (nested lists / sublists, Feature 8). Pass
   * `null` to detach to root. No-op when the move would create a cycle or the
   * ids are unknown (see lib/list-tree.ts:canMoveList).
   */
  moveList: (id: string, newParentId: string | null) => void
  /** Direct child lists of `id` (computed over `lists`). */
  getChildLists: (id: string) => List[]
  /** All transitive descendant lists of `id`. */
  getDescendantLists: (id: string) => List[]
  /** Ancestor lists of `id`, nearest parent → root. */
  getListAncestors: (id: string) => List[]
  setTasks: (tasks: Task[]) => void
  setLists: (lists: List[]) => void
  clearAllData: () => void
  addFolder: (folder: Folder) => void
  dedupeFolders: () => void
  dedupeLists: () => void
  updateFolder: (folder: Folder) => void
  deleteFolder: (id: string) => void
  addListToFolder: (folderId: string, categoryId: string) => void
  removeListFromFolder: (folderId: string, categoryId: string) => void
  setFolders: (folders: Folder[]) => void
  // Tag / link queries (computed over `tasks`; see lib/links.ts).
  getByTag: (tag: string) => Task[]
  getLinkedItems: (id: string, relation?: string) => Task[]
  getBacklinks: (id: string, relation?: string) => Task[]
}

// Initial lists with order
const initialLists: List[] = [
  {
    id: "example",
    name: "Example List",
    color: "#EF4444",
    description: "An example list for demonstration purposes",
    createdAt: new Date(),
    order: 0,
    scheduleable: true,
  },
]

// Initial tasks data with updated structure
const initialTasks: Task[] = [
  {
    id: "1",
    description: "Example task",
    stage: "inbox",
    createdAt: new Date(),
    estimatedDuration: 60,
    actualDuration: undefined,
    cognitiveLoad: 3,
    urgency: 4,
    importance: 5,
    dependencies: [],
    context: "@work",
    entropy: 0.3,
    rewardValue: 100,
    completed: false,
    lists: ["example"],
    allowPartialCompletion: false,
    minimumChunkSize: 15,
  },
]

// Create the store with persistence
export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: initialTasks,
      lists: initialLists,
      folders: [],
      priorityFormula: {
        urgencyWeight: 1,
        importanceWeight: 1,
        effortWeight: 1,
        cognitiveLoadWeight: 1,
      },
      priorityWeights: { ...DEFAULT_PRIORITY_WEIGHTS },

      addTask: (task) => {
        // Captured for the workflow-hooks dispatch after the state commit (only
        // set when the task was actually added — no-op when it already exists).
        let added: Task | undefined
        set((state) => {
          // Only add if the task doesn't already exist
          if (!state.tasks.some((t) => t.id === task.id)) {
            // Ensure dates are proper Date objects
            const taskWithDates = {
              ...task,
              createdAt: task.createdAt instanceof Date ? task.createdAt : new Date(task.createdAt),
              deadline: task.deadline
                ? task.deadline instanceof Date
                  ? task.deadline
                  : new Date(task.deadline)
                : undefined,
              scheduledDate: task.scheduledDate
                ? task.scheduledDate instanceof Date
                  ? task.scheduledDate
                  : new Date(task.scheduledDate)
                : undefined,
              completedDate: task.completed
                ? task.completedDate
                  ? task.completedDate instanceof Date
                    ? task.completedDate
                    : new Date(task.completedDate)
                  : new Date()
                : undefined,
            }
            // Apply item-type + list rules (e.g. "when purchased, set owned").
            const ruled = applyItemRules(
              taskWithDates,
              state.lists,
              useItemTypeStore.getState().types,
              "create",
            )
            added = ruled
            return { tasks: [...state.tasks, ruled] }
          }
          return state
        })
        if (added) {
          dispatchItemMutation({ trigger: "create", itemId: added.id, after: added })
        }
      },

      updateTask: (updatedTask) => {
        // Captured for the workflow-hooks dispatch after the state commit.
        let before: Task | undefined
        let after: Task | undefined
        let didComplete = false
        let basePoints = 0
        set((state) => {
          const index = state.tasks.findIndex((t) => t.id === updatedTask.id)
          if (index !== -1) {
            // Award points when a task transitions to completed (regardless of
            // which screen completed it). Guarded so re-saving a completed task
            // doesn't double-award.
            const prev = state.tasks[index]
            const justCompleted = !prev.completed && updatedTask.completed
            const justReopened = prev.completed && !updatedTask.completed
            if (justCompleted) {
              const points = resolveCompletionPoints(updatedTask, state.lists, state.folders)
              basePoints = points
              if (points > 0) {
                usePointsStore
                  .getState()
                  .addPoints(updatedTask.id, points, updatedTask.description || "Task", new Date())
              }
            }
            // Central completion-date stamp: every completion path goes through
            // updateTask, so bucketing "done today/this week/this month" by when
            // the work actually finished works regardless of which screen did it.
            // Respect an explicitly-provided completedDate (e.g. retroactive logs).
            const resolveCompletedDate = (): Date | undefined => {
              if (!updatedTask.completed) return undefined
              if (updatedTask.completedDate) {
                return updatedTask.completedDate instanceof Date
                  ? updatedTask.completedDate
                  : new Date(updatedTask.completedDate)
              }
              if (prev.completedDate) {
                return prev.completedDate instanceof Date ? prev.completedDate : new Date(prev.completedDate)
              }
              return new Date()
            }
            // Ensure dates are proper Date objects
            const taskWithDates = {
              ...updatedTask,
              createdAt:
                updatedTask.createdAt instanceof Date ? updatedTask.createdAt : new Date(updatedTask.createdAt),
              deadline: updatedTask.deadline
                ? updatedTask.deadline instanceof Date
                  ? updatedTask.deadline
                  : new Date(updatedTask.deadline)
                : undefined,
              scheduledDate: updatedTask.scheduledDate
                ? updatedTask.scheduledDate instanceof Date
                  ? updatedTask.scheduledDate
                  : new Date(updatedTask.scheduledDate)
                : undefined,
              completedDate: justReopened ? undefined : resolveCompletedDate(),
            }
            didComplete = justCompleted
            // Apply item-type + list rules; rules that change attributes (e.g.
            // "when purchased, set owned") follow the item across all its lists.
            const ruled = applyItemRules(
              taskWithDates,
              state.lists,
              useItemTypeStore.getState().types,
              didComplete ? "complete" : "update",
            )
            before = prev
            after = ruled
            const newTasks = [...state.tasks]
            newTasks[index] = ruled
            return { tasks: newTasks }
          }
          return state
        })
        if (after) {
          dispatchItemMutation({
            trigger: didComplete ? "complete" : "update",
            itemId: after.id,
            before,
            after,
            changedAttrs: diffChangedAttrs(before, after),
          })
          // Notify the global completion popup on every completion transition.
          if (didComplete) {
            emitTaskCompleted({ taskId: after.id, basePoints, at: new Date() })
          }
        }
      },

      deleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        })),

      updatePriorityFormula: (formula) =>
        set(() => ({
          priorityFormula: formula,
        })),

      updatePriorityWeights: (weights) =>
        set(() => ({
          priorityWeights: weights,
        })),

      addList: (category) =>
        set((state) => {
          if (state.lists.some((c) => c.id === category.id)) return state
          return { lists: [...state.lists, category] }
        }),

      updateList: (updatedCategory) =>
        set((state) => {
          const index = state.lists.findIndex((c) => c.id === updatedCategory.id)
          if (index !== -1) {
            const newCategories = [...state.lists]
            newCategories[index] = updatedCategory
            return { lists: newCategories }
          }
          return state
        }),

      deleteList: (id) =>
        set((state) => {
          const deleted = state.lists.find((c) => c.id === id)
          // Re-parent any sublists onto the deleted category's parent (or root)
          // so deleting a mid-tree category never orphans its descendants.
          const newParentId = deleted?.parentListId
          const lists = state.lists
            .filter((category) => category.id !== id)
            .map((category) =>
              category.parentListId === id
                ? newParentId
                  ? { ...category, parentListId: newParentId }
                  : (() => {
                      const next = { ...category }
                      delete next.parentListId
                      return next
                    })()
                : category,
            )
          return { lists }
        }),

      moveList: (id, newParentId) =>
        set((state) => {
          const lists = moveListPure(state.lists, id, newParentId)
          return lists === state.lists ? state : { lists }
        }),

      getChildLists: (id) => getChildListsPure(get().lists, id),
      getDescendantLists: (id) => getDescendantListsPure(get().lists, id),
      getListAncestors: (id) => getListAncestorsPure(get().lists, id),

      setTasks: (tasks) => set(() => ({ tasks })),
      setLists: (lists) => set(() => ({ lists })),
      clearAllData: () => set(() => ({ tasks: [], lists: [], folders: [] })),
      addFolder: (folder) =>
        set((state) => {
          if (state.folders.some((f) => f.id === folder.id)) return state
          return { folders: [...state.folders, folder] }
        }),
      dedupeFolders: () =>
        set((state) => {
          const seen = new Set<string>()
          const deduped = state.folders.filter((f) => {
            if (seen.has(f.id)) return false
            seen.add(f.id)
            return true
          })
          return deduped.length === state.folders.length ? state : { folders: deduped }
        }),
      dedupeLists: () =>
        set((state) => {
          const seen = new Set<string>()
          const dedupedCategories = state.lists.filter((c) => {
            if (seen.has(c.id)) return false
            seen.add(c.id)
            return true
          })
          const dedupedFolders = state.folders.map((f) => ({
            ...f,
            listIds: [...new Set(f.listIds)],
          }))
          const categoriesChanged = dedupedCategories.length !== state.lists.length
          const foldersChanged = dedupedFolders.some(
            (f, i) => f.listIds.length !== state.folders[i]?.listIds.length,
          )
          return categoriesChanged || foldersChanged
            ? { lists: dedupedCategories, folders: dedupedFolders }
            : state
        }),
      updateFolder: (folder) => set((state) => {
        const index = state.folders.findIndex((f) => f.id === folder.id)
        if (index !== -1) {
          const newFolders = [...state.folders]
          newFolders[index] = folder
          return { folders: newFolders }
        }
        return state
      }),
      deleteFolder: (id) => set((state) => ({ folders: state.folders.filter((f) => f.id !== id) })),
      addListToFolder: (folderId, categoryId) => set((state) => {
        const folders = state.folders.map((folder) =>
          folder.id === folderId && !folder.listIds.includes(categoryId)
            ? { ...folder, listIds: [...folder.listIds, categoryId] }
            : folder
        )
        return { folders }
      }),
      removeListFromFolder: (folderId, categoryId) => set((state) => {
        const folders = state.folders.map((folder) =>
          folder.id === folderId
            ? { ...folder, listIds: folder.listIds.filter((id) => id !== categoryId) }
            : folder
        )
        return { folders }
      }),
      setFolders: (folders) => set(() => ({ folders })),

      getByTag: (tag) => {
        const wanted = normalizeTag(tag)
        if (!wanted) return []
        return get().tasks.filter((t) => (t.tags ?? []).some((x) => normalizeTag(x) === wanted))
      },

      getLinkedItems: (id, relation) => {
        const { tasks } = get()
        const source = tasks.find((t) => t.id === id)
        if (!source) return []
        const targetIds = new Set(
          (source.links ?? [])
            .filter((l) => !relation || l.relation === relation)
            .map((l) => l.targetId),
        )
        return tasks.filter((t) => targetIds.has(t.id))
      },

      getBacklinks: (id, relation) =>
        get().tasks.filter((t) =>
          (t.links ?? []).some((l) => l.targetId === id && (!relation || l.relation === relation)),
        ),
    }),
    {
      name: "cogs-task-storage", // unique name for localStorage key
      storage: createJSONStorage(() => localStorage, {
        // NOTE: `JSON.stringify` invokes `Date.prototype.toJSON()` (→ ISO string)
        // BEFORE this replacer runs, so the `value instanceof Date` branch never
        // fires — Dates are already plain ISO strings here. The real rehydration
        // happens in the reviver below. We keep this branch only as defensive
        // back-compat in case a raw (non-toJSON'd) Date ever reaches the replacer.
        replacer: (_key, value) => {
          if (value instanceof Date) {
            return { __type: "Date", value: value.toISOString() }
          }
          return value
        },
        // `JSON.parse`'s reviver visits every key. We restore Date instances for
        // the known Date-typed fields whose values are ISO-8601 strings (what
        // `toJSON` produced). Restricting to DATE_KEYS avoids clobbering genuine
        // string fields like `scheduledTime` ("14:30") or `timeLogs[].date`
        // ("2026-06-20"). The tagged-envelope branch handles any legacy data that
        // somehow persisted via the replacer above (prevents double-conversion).
        reviver: (key, value) => {
          if (value && typeof value === "object" && (value as { __type?: string }).__type === "Date") {
            return new Date((value as { value: string }).value)
          }
          if (typeof value === "string" && DATE_KEYS.has(key) && ISO_DATE_RE.test(value)) {
            return new Date(value)
          }
          return value
        },
      }),
      // Add version to handle schema changes
      version: 9,
      // Migrate function to handle old data
      migrate: (persistedState: any, version: number) => {
        if (version < 2) {
          // Convert string dates to Date objects for old data
          if (persistedState.tasks) {
            persistedState.tasks = persistedState.tasks.map((task: any) => ({
              ...task,
              createdAt: typeof task.createdAt === "string" ? new Date(task.createdAt) : task.createdAt,
              deadline: task.deadline && typeof task.deadline === "string" ? new Date(task.deadline) : task.deadline,
              scheduledDate:
                task.scheduledDate && typeof task.scheduledDate === "string"
                  ? new Date(task.scheduledDate)
                  : task.scheduledDate,
              // Add new fields with defaults
              rewardValue: task.rewardValue || 50,
              allowPartialCompletion: task.allowPartialCompletion || false,
              minimumChunkSize: task.minimumChunkSize || 15,
            }))
          }
          if (persistedState.categories) {
            persistedState.categories = persistedState.categories.map((category: any, index: number) => ({
              ...category,
              createdAt: typeof category.createdAt === "string" ? new Date(category.createdAt) : category.createdAt,
              order: category.order !== undefined ? category.order : index,
            }))
          }
        }
        if (version < 3) {
          // Add folders if missing
          if (!persistedState.folders) {
            persistedState.folders = []
          }
        }
        if (version < 4) {
          // Lists default to scheduleable so existing items keep appearing in
          // the Scheduler. (Legacy data still keys these as `categories`.)
          if (persistedState.categories) {
            persistedState.categories = persistedState.categories.map((category: any) => ({
              ...category,
              scheduleable: category.scheduleable !== undefined ? category.scheduleable : true,
            }))
          }
          // Folders gain default settings inherited by lists created inside them.
          if (persistedState.folders) {
            persistedState.folders = persistedState.folders.map((folder: any) => ({
              ...folder,
              scheduleable: folder.scheduleable !== undefined ? folder.scheduleable : true,
            }))
          }
        }
        if (version < 5) {
          persistedState = migratePersistedAttributes(persistedState)
        }
        if (version < 6) {
          const seen = new Set<string>()
          if (persistedState.categories) {
            persistedState.categories = persistedState.categories.filter((c: any) => {
              if (seen.has(c.id)) return false
              seen.add(c.id)
              return true
            })
          }
          if (persistedState.folders) {
            // Legacy data still keys folder membership as `categoryIds`; the
            // rename to `listIds` happens in the v9 step below.
            persistedState.folders = persistedState.folders.map((f: any) => ({
              ...f,
              categoryIds: [...new Set(f.categoryIds ?? [])],
            }))
          }
        }
        if (version < 7) {
          // Unified Item model (spec §5): backfill type/title/tags/links.
          persistedState = migrateTasksToItems(persistedState)
        }
        if (version < 8) {
          // Module platform foundation (Phase 0): additive, no-op transform.
          persistedState = migrateModulePlatform(persistedState)
        }
        if (version < 9) {
          // category→list migration. Rename persisted field keys to the new
          // in-memory vocabulary so existing localStorage/backups keep loading:
          //   List.parentCategoryId → parentListId
          //   Folder.categoryIds    → listIds
          //   Task.category         → stage
          //   Task.categories       → lists
          //   state.categories      → state.lists
          persistedState = migrateCategoryToList(persistedState)
        }
        return persistedState
      },
    },
  ),
)

/**
 * Best-effort diff of the flexible `attributes` record between two task
 * snapshots, returning the ids of attributes whose values changed. Used only to
 * annotate workflow-hook events; shallow value comparison is sufficient.
 */
function diffChangedAttrs(before?: Task, after?: Task): string[] {
  const prev = before?.attributes ?? {}
  const next = after?.attributes ?? {}
  const ids = new Set<string>([...Object.keys(prev), ...Object.keys(next)])
  const changed: string[] = []
  for (const id of ids) {
    if (!shallowAttrEqual(prev[id], next[id])) changed.push(id)
  }
  return changed
}

function shallowAttrEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  // Cheap structural compare for arrays/objects (FileValue, string[], GoalValue).
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * v9 — category→list rename. Maps legacy persisted field keys to the new
 * in-memory vocabulary so existing localStorage payloads and old backups keep
 * loading without data loss:
 *   List.parentCategoryId → parentListId
 *   Folder.categoryIds    → listIds
 *   Task.category         → stage
 *   Task.categories       → lists
 *   state.categories      → state.lists
 * Pure and defensive (operates on `any`); tolerates partial/legacy shapes.
 * Exported for migration unit tests.
 */
export function migrateCategoryToList(state: any): any {
  if (!state || typeof state !== "object") return state
  const renameList = (c: any) => {
    if (!c || typeof c !== "object") return c
    const { parentCategoryId, ...rest } = c
    return parentCategoryId !== undefined ? { ...rest, parentListId: parentCategoryId } : rest
  }
  const renameFolder = (f: any) => {
    if (!f || typeof f !== "object") return f
    const { categoryIds, ...rest } = f
    return categoryIds !== undefined ? { ...rest, listIds: categoryIds } : rest
  }
  const renameTask = (t: any) => {
    if (!t || typeof t !== "object") return t
    const { category, categories, ...rest } = t
    const out: any = { ...rest }
    if (category !== undefined) out.stage = category
    if (categories !== undefined) out.lists = categories
    return out
  }
  const next: any = { ...state }
  if (Array.isArray(state.categories)) next.lists = state.categories.map(renameList)
  delete next.categories
  if (Array.isArray(state.folders)) next.folders = state.folders.map(renameFolder)
  if (Array.isArray(state.tasks)) next.tasks = state.tasks.map(renameTask)
  return next
}

// Create a selector hook to avoid the getSnapshot error
export const useTaskSelector = <T,>(selector: (state: TaskState) => T): T => {
  return selector(useTaskStore.getState())
}

// Helper function to calculate priority score
export const calculatePriorityScore = (task: Task, formula = useTaskStore.getState().priorityFormula) => {
  const duration = task.estimatedDuration ?? 30
  const cognitive = task.cognitiveLoad ?? 2
  const urgency = task.urgency ?? 3
  const importance = task.importance ?? 3
  const numerator = urgency * formula.urgencyWeight + importance * formula.importanceWeight
  const denominator = duration * formula.effortWeight + cognitive * formula.cognitiveLoadWeight
  return numerator / Math.max(denominator, 0.1)
}
