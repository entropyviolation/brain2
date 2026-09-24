/**
 * lib/task-store.ts — Tasks, lists & folders store
 *
 * The central Zustand store and source of truth for item records, their lists,
 * and folders. Powers the Inbox, Next Actions board, Scheduler funnel, and
 * the Home dashboard's To-Do/Plan panels. Persisted to localStorage under
 * `brain2-task-storage` (legacy `cogs-task-storage` is copied, never deleted)
 * with Date-aware (de)serialization and a versioned migration hook. Also
 * exposes the configurable priority formula.
 *
 * Ontology: rows are Items. The persisted field is still named `tasks` (v1);
 * `addItem` / `updateItem` / `deleteItem` / `getItems` alias `addTask` /
 * `updateTask` / `deleteTask` / `tasks`. The JSON array name stays `tasks`.
 * Hard deletes (and item/list merge discards) stamp `removedTaskIds` /
 * `removedListIds` so a hub merge that unions by id cannot resurrect a row
 * the user already removed.
 *
 * Connected lists (`List.linkedTargetListIds`) auto-join membership through
 * `addTask` / `updateTask` / `addListLink`; see `lib/list-links.ts`.
 *
 * Spec: §4 (Inbox), §5 (Item model), §6 (Next Actions), §7 (Scheduler). Storage
 * is localStorage today; spec §3 calls for migrating this to **MongoDB**
 * (flexible document model, text/vector search, aggregation-based routing) with
 * one-click JSON export/import (see docs/SPEC_MAPPING.md §3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { sanitizeEnabledDisplays, type Task, type ItemRecord, type List, type Folder, type PriorityWeights } from "@/lib/types"
import { DEFAULT_PRIORITY_WEIGHTS } from "@/lib/priority"
import { migratePersistedAttributes } from "@/lib/attribute-utils"
import {
  migrateTasksToItems,
  migrateModulePlatform,
  migrateTitleAsFieldOfRecord,
  migrateHonestItemTypes,
} from "@/lib/migrations"
import { dispatchItemMutation } from "@/lib/workflow-hooks"
import { usePointsStore } from "@/lib/points-store"
import {
  resolveCompletionPoints,
  applyItemRules,
  itemTitleOrUntitled,
  syncTitleFromDescription,
} from "@/lib/item-utils"
import { emitTaskCompleted, shouldEmitCompletionPopup } from "@/lib/completion-events"
import { useItemTypeStore } from "@/lib/item-type-store"
import { normalizeTag } from "@/lib/links"
import { createCogsJSONStorage, registerPersistRehydrator } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { migrateTaskFileValues, migrateTaskImageAttributes } from "@/lib/attachments"
import {
  moveList as moveListPure,
  getChildren as getChildListsPure,
  getDescendants as getDescendantListsPure,
  getAncestors as getListAncestorsPure,
} from "@/lib/list-tree"
import {
  addListLinkToLists,
  applyListLinksToTask,
  applyListLinksToTasks,
  preserveLinkedTargetIds,
  removeListLinkFromLists,
  stripListLinksForDeletedList,
} from "@/lib/list-links"
import { withArchiveListMembership } from "@/lib/archive-lists"

// Date-typed fields on persisted Task / List objects. The persist reviver
// only resurrects Dates for these keys so it never converts unrelated strings
// (e.g. `scheduledTime`, `scheduledWeek`, `timeLogs[].date`).
// `estimates[].generatedAt` / `confirmedAt` are deliberately named apart from
// these keys: they stay ISO strings so the provenance array survives a round
// trip through JSON without needing Date handling everywhere it is read.
const DATE_KEYS = new Set([
  "createdAt",
  "deadline",
  "scheduledDate",
  "completedDate",
  "missedAt",
  "startedAt",
  "completedAt",
  "mustBeDoneAfter",
  "mustBeDoneBefore",
  // `completedChunks[].date` is a real timestamp typed as `Date`. Safe to
  // revive despite `timeLogs[].date` sharing the key name: ISO_DATE_RE demands
  // a time component, which a "2026-06-20" day key does not have.
  "date",
])

// Matches ISO-8601 strings produced by `Date.prototype.toISOString()`
// (e.g. "2026-06-23T08:33:00.000Z"), including timezone offset variants.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

interface TaskState {
  /**
   * Persisted Item records (historical field name `tasks`). JSON blob key stays
   * `tasks`; persist name is `brain2-task-storage` (`cogs-task-storage` alias). Do not rename the array
   * until a versioned migration rewrites vaults.
   */
  tasks: Task[]
  lists: List[]
  folders: Folder[]
  /**
   * Tombstones for hard-deleted item ids. Hub / phone-hub merges union rows by
   * id so a Telegram Inbox capture cannot vanish under a stale desktop push;
   * without this list, that union would also resurrect a deliberate delete.
   * Item merge stamps discarded ids here the same way `deleteTask` does.
   */
  removedTaskIds: string[]
  /**
   * Tombstones for hard-deleted / merge-discarded list ids. Same union-by-id
   * rule as `removedTaskIds` — without this, discarded lists come back on hub
   * follow after a list merge.
   */
  removedListIds: string[]
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
  /** Same write as `addTask` — prefer when the caller means an item record. */
  addItem: (item: ItemRecord) => void
  /** Same write as `updateTask`. */
  updateItem: (item: ItemRecord) => void
  /** Same write as `deleteTask`. */
  deleteItem: (id: string) => void
  /** Snapshot of persisted item records (same array as `tasks`). */
  getItems: () => ItemRecord[]
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
  /**
   * Connect source→target so source items auto-join the target (membership,
   * not nesting). Syncs existing items; honors exclusions. See LIST_LINKS.md.
   */
  addListLink: (sourceListId: string, targetListId: string) => void
  /** Stop future auto-adds. Does not mass-delete items already on both lists. */
  removeListLink: (sourceListId: string, targetListId: string) => void
  /**
   * Replace the tasks array. Pass `tombstoneIds` when rows were intentionally
   * removed (item merge, inbox batch delete) so vault union cannot resurrect them.
   */
  setTasks: (tasks: Task[], opts?: { tombstoneIds?: readonly string[] }) => void
  /**
   * Replace the lists array. Pass `tombstoneIds` when lists were intentionally
   * removed (list merge) so vault union cannot resurrect them.
   */
  setLists: (lists: List[], opts?: { tombstoneIds?: readonly string[] }) => void
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
  getByTag: (tag: string) => ItemRecord[]
  getLinkedItems: (id: string, relation?: string) => ItemRecord[]
  getBacklinks: (id: string, relation?: string) => ItemRecord[]
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
const SEED_TASK_IDS = new Set(["1"])

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

const taskPersistStorage = createCogsJSONStorage({
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
  // ("2026-06-20"). Nested `completedAt` (completion reviews) is revived too.
  reviver: (key, value) => {
    if (value && typeof value === "object" && (value as { __type?: string }).__type === "Date") {
      return new Date((value as { value: string }).value)
    }
    if (typeof value === "string" && DATE_KEYS.has(key) && ISO_DATE_RE.test(value)) {
      return new Date(value)
    }
    return value
  },
})

/** Cap how many tombstone ids we keep so the persist blob stays bounded. */
const TOMBSTONE_CAP = 4000

/** Append unique ids onto a tombstone list (deleteTask / merge discards). */
export function appendTombstoneIds(
  prev: string[] | undefined,
  ids: readonly string[],
  cap = TOMBSTONE_CAP,
): string[] {
  if (ids.length === 0) return prev ?? []
  const next = [...(prev ?? [])]
  const seen = new Set(next)
  for (const id of ids) {
    if (!id || seen.has(id)) continue
    seen.add(id)
    next.push(id)
  }
  return next.slice(-cap)
}

/** Persist blob version. v12 backfills missing `type` only (honest Item vs Task). */
export const TASK_STORE_PERSIST_VERSION = 12

/** False until persist finishes reading disk so mount-time list sync cannot persist seed tasks over the vault. Tests persist immediately. */
let taskPersistHydrated = typeof process !== "undefined" && !!process.env.VITEST

// Create the store with persistence
export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: initialTasks,
      lists: initialLists,
      folders: [],
      removedTaskIds: [],
      removedListIds: [],
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
              startedAt: task.startedAt
                ? task.startedAt instanceof Date
                  ? task.startedAt
                  : new Date(task.startedAt)
                : undefined,
            }
            // Apply item-type + list rules (e.g. "when purchased, set owned").
            const ruled = applyItemRules(
              syncTitleFromDescription(taskWithDates),
              state.lists,
              useItemTypeStore.getState().types,
              "create",
            )
            const linked = applyListLinksToTask(ruled, undefined, state.lists)
            const archived = withArchiveListMembership(linked, linked, state.lists, state.folders)
            added = archived
            return {
              tasks: [...state.tasks, archived],
              removedTaskIds: (state.removedTaskIds ?? []).filter((id) => id !== archived.id),
            }
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
                  .addPoints(updatedTask.id, points, itemTitleOrUntitled(updatedTask, "Task"), new Date())
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
              // The work window belongs to the completion, so re-opening drops it.
              startedAt:
                justReopened || !updatedTask.startedAt
                  ? undefined
                  : updatedTask.startedAt instanceof Date
                    ? updatedTask.startedAt
                    : new Date(updatedTask.startedAt),
            }
            didComplete = justCompleted
            // Apply item-type + list rules; rules that change attributes (e.g.
            // "when purchased, set owned") follow the item across all its lists.
            const ruled = applyItemRules(
              syncTitleFromDescription(taskWithDates, prev),
              state.lists,
              useItemTypeStore.getState().types,
              didComplete ? "complete" : "update",
              prev,
            )
            const linked = applyListLinksToTask(ruled, prev, state.lists)
            const archived = withArchiveListMembership(linked, prev, state.lists, state.folders)
            before = prev
            after = archived
            const newTasks = [...state.tasks]
            newTasks[index] = archived
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
          // Notify the global completion popup on every completion transition,
          // unless a batch path asked for quiet complete (no modal stack).
          if (didComplete && shouldEmitCompletionPopup()) {
            emitTaskCompleted({ taskId: after.id, basePoints, at: new Date() })
          }
        }
      },

      deleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
          removedTaskIds: appendTombstoneIds(state.removedTaskIds, [id]),
        })),

      addItem: (item) => get().addTask(item),
      updateItem: (item) => get().updateTask(item),
      deleteItem: (id) => get().deleteTask(id),
      getItems: () => get().tasks,

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
            newCategories[index] = preserveLinkedTargetIds(updatedCategory, state.lists[index])
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
          const lists = stripListLinksForDeletedList(
            state.lists
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
              ),
            id,
          )
          return {
            lists,
            removedListIds: appendTombstoneIds(state.removedListIds, [id]),
          }
        }),

      addListLink: (sourceListId, targetListId) =>
        set((state) => {
          const lists = addListLinkToLists(state.lists, sourceListId, targetListId)
          if (lists === state.lists) return state
          const tasks = applyListLinksToTasks(state.tasks, lists)
          return tasks === state.tasks ? { lists } : { lists, tasks }
        }),

      removeListLink: (sourceListId, targetListId) =>
        set((state) => {
          const lists = removeListLinkFromLists(state.lists, sourceListId, targetListId)
          return lists === state.lists ? state : { lists }
        }),

      moveList: (id, newParentId) =>
        set((state) => {
          const lists = moveListPure(state.lists, id, newParentId)
          return lists === state.lists ? state : { lists }
        }),

      getChildLists: (id) => getChildListsPure(get().lists, id),
      getDescendantLists: (id) => getDescendantListsPure(get().lists, id),
      getListAncestors: (id) => getListAncestorsPure(get().lists, id),

      setTasks: (tasks, opts) =>
        set((state) => {
          const tombstoneIds = opts?.tombstoneIds
          if (!tombstoneIds?.length) return { tasks }
          return {
            tasks,
            removedTaskIds: appendTombstoneIds(state.removedTaskIds, tombstoneIds),
          }
        }),
      setLists: (lists, opts) =>
        set((state) => {
          const tombstoneIds = opts?.tombstoneIds
          if (!tombstoneIds?.length) return { lists }
          return {
            lists,
            removedListIds: appendTombstoneIds(state.removedListIds, tombstoneIds),
          }
        }),
      clearAllData: () =>
        set(() => ({ tasks: [], lists: [], folders: [], removedTaskIds: [], removedListIds: [] })),
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
      name: persistKey("task-storage"),
      storage: {
        getItem: async (name) => {
          const value = await taskPersistStorage.getItem(name)
          // A capture that landed while this read was in flight has to be
          // allowed to write. The seed-overwrite guard only covers the wait.
          taskPersistHydrated = true
          return value
        },
        setItem: (name, value) => {
          if (!taskPersistHydrated) return
          return taskPersistStorage.setItem(name, value)
        },
        removeItem: (name) => taskPersistStorage.removeItem(name),
      },
      merge: (persisted, current) => {
        const disk = (persisted ?? {}) as {
          tasks?: Task[]
          lists?: List[]
          removedTaskIds?: string[]
          removedListIds?: string[]
        }
        const live = current.tasks ?? []
        const diskTasks = Array.isArray(disk.tasks) ? disk.tasks : []
        const removed = new Set([...(disk.removedTaskIds ?? []), ...(current.removedTaskIds ?? [])])
        const byId = new Map(diskTasks.filter((task) => task?.id && !removed.has(task.id)).map((task) => [task.id, task]))
        for (const task of live) {
          if (!task?.id || byId.has(task.id) || SEED_TASK_IDS.has(task.id) || removed.has(task.id)) continue
          byId.set(task.id, task)
        }
        const removedLists = new Set([...(disk.removedListIds ?? []), ...(current.removedListIds ?? [])])
        const diskLists = Array.isArray(disk.lists) ? disk.lists : current.lists
        const lists = (Array.isArray(diskLists) ? diskLists : []).filter(
          (list) => list?.id && !removedLists.has(list.id),
        )
        return {
          ...current,
          ...disk,
          tasks: [...byId.values()],
          lists,
          removedTaskIds: [...removed].slice(-TOMBSTONE_CAP),
          removedListIds: [...removedLists].slice(-TOMBSTONE_CAP),
        }
      },
      // Add version to handle schema changes
      version: TASK_STORE_PERSIST_VERSION,
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
        if (version < 10) {
          persistedState = migrateStripKanbanListDisplays(persistedState)
        }
        if (version < 11) {
          // `title` becomes the field of record. Heals records whose
          // `description` drifted ahead of their mirrored `title`; never
          // clears `description`. See lib/migrations.ts.
          persistedState = migrateTitleAsFieldOfRecord(persistedState)
        }
        if (version < 12) {
          // Honest type on old rows: fill missing `type` only. Next Actions
          // or inbox → "task"; else "item". Never overwrite an explicit type.
          persistedState = migrateHonestItemTypes(persistedState)
        }
        if (!Array.isArray(persistedState.removedTaskIds)) {
          persistedState.removedTaskIds = []
        }
        if (!Array.isArray(persistedState.removedListIds)) {
          persistedState.removedListIds = []
        }
        return persistedState
      },
      onRehydrateStorage: () => (state) => {
        taskPersistHydrated = true
        if (!state?.tasks?.length) return
        // Attachment bytes leave the blob: `FileValue` data URLs first, then
        // pictures pasted into `image` / `multiimage` attributes. One 592KB PNG
        // in a custom attribute was filling the origin for every other vault.
        void migrateTaskFileValues(state.tasks)
          .then(async (files) => {
            const images = await migrateTaskImageAttributes(files.tasks)
            return { tasks: images.tasks, migrated: files.migrated + images.migrated }
          })
          .then(({ tasks, migrated }) => {
            if (migrated > 0) useTaskStore.setState({ tasks })
          })
      },
    },
  ),
)

registerPersistRehydrator(persistKey("task-storage"), () => useTaskStore.persist.rehydrate())

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

/**
 * v10 — Kanban is no longer a Lists-tab display mode (Modules workspace only).
 * Strip `"kanban"` from persisted `List.enabledDisplays`.
 */
export function migrateStripKanbanListDisplays(state: any): any {
  if (!state || typeof state !== "object") return state
  const lists = state.lists
  if (!Array.isArray(lists)) return state
  return {
    ...state,
    lists: lists.map((list: any) => {
      if (!list || typeof list !== "object" || !Array.isArray(list.enabledDisplays)) return list
      const enabledDisplays = sanitizeEnabledDisplays(list.enabledDisplays)
      if (!enabledDisplays) {
        const { enabledDisplays: _dropped, ...rest } = list
        return rest
      }
      return { ...list, enabledDisplays }
    }),
  }
}

