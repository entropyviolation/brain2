/**
 * lib/task-store.ts — Tasks, categories & folders store
 *
 * The central Zustand store and source of truth for tasks, their categories, and
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
import type { Task, TaskCategory, CategoryFolder } from "@/lib/types"
import { migratePersistedAttributes } from "@/lib/attribute-utils"
import { usePointsStore } from "@/lib/points-store"
import { resolveCompletionPoints } from "@/lib/item-utils"

interface TaskState {
  tasks: Task[]
  categories: TaskCategory[]
  folders: CategoryFolder[]
  priorityFormula: {
    urgencyWeight: number
    importanceWeight: number
    effortWeight: number
    cognitiveLoadWeight: number
  }
  addTask: (task: Task) => void
  updateTask: (task: Task) => void
  deleteTask: (id: string) => void
  updatePriorityFormula: (formula: TaskState["priorityFormula"]) => void
  addCategory: (category: TaskCategory) => void
  updateCategory: (category: TaskCategory) => void
  deleteCategory: (id: string) => void
  setTasks: (tasks: Task[]) => void
  setCategories: (categories: TaskCategory[]) => void
  clearAllData: () => void
  addFolder: (folder: CategoryFolder) => void
  dedupeFolders: () => void
  dedupeCategories: () => void
  updateFolder: (folder: CategoryFolder) => void
  deleteFolder: (id: string) => void
  addCategoryToFolder: (folderId: string, categoryId: string) => void
  removeCategoryFromFolder: (folderId: string, categoryId: string) => void
  setFolders: (folders: CategoryFolder[]) => void
}

// Initial categories with order
const initialCategories: TaskCategory[] = [
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
    category: "inbox",
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
    categories: ["example"],
    allowPartialCompletion: false,
    minimumChunkSize: 15,
  },
]

// Create the store with persistence
export const useTaskStore = create<TaskState>()(
  persist(
    (set, get) => ({
      tasks: initialTasks,
      categories: initialCategories,
      folders: [],
      priorityFormula: {
        urgencyWeight: 1,
        importanceWeight: 1,
        effortWeight: 1,
        cognitiveLoadWeight: 1,
      },

      addTask: (task) =>
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
            }
            return { tasks: [...state.tasks, taskWithDates] }
          }
          return state
        }),

      updateTask: (updatedTask) =>
        set((state) => {
          const index = state.tasks.findIndex((t) => t.id === updatedTask.id)
          if (index !== -1) {
            // Award points when a task transitions to completed (regardless of
            // which screen completed it). Guarded so re-saving a completed task
            // doesn't double-award.
            const prev = state.tasks[index]
            if (!prev.completed && updatedTask.completed) {
              const points = resolveCompletionPoints(updatedTask, state.categories, state.folders)
              if (points > 0) {
                usePointsStore
                  .getState()
                  .addPoints(updatedTask.id, points, updatedTask.description || "Task", new Date())
              }
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
            }
            const newTasks = [...state.tasks]
            newTasks[index] = taskWithDates
            return { tasks: newTasks }
          }
          return state
        }),

      deleteTask: (id) =>
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== id),
        })),

      updatePriorityFormula: (formula) =>
        set(() => ({
          priorityFormula: formula,
        })),

      addCategory: (category) =>
        set((state) => {
          if (state.categories.some((c) => c.id === category.id)) return state
          return { categories: [...state.categories, category] }
        }),

      updateCategory: (updatedCategory) =>
        set((state) => {
          const index = state.categories.findIndex((c) => c.id === updatedCategory.id)
          if (index !== -1) {
            const newCategories = [...state.categories]
            newCategories[index] = updatedCategory
            return { categories: newCategories }
          }
          return state
        }),

      deleteCategory: (id) =>
        set((state) => ({
          categories: state.categories.filter((category) => category.id !== id),
        })),

      setTasks: (tasks) => set(() => ({ tasks })),
      setCategories: (categories) => set(() => ({ categories })),
      clearAllData: () => set(() => ({ tasks: [], categories: [], folders: [] })),
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
      dedupeCategories: () =>
        set((state) => {
          const seen = new Set<string>()
          const dedupedCategories = state.categories.filter((c) => {
            if (seen.has(c.id)) return false
            seen.add(c.id)
            return true
          })
          const dedupedFolders = state.folders.map((f) => ({
            ...f,
            categoryIds: [...new Set(f.categoryIds)],
          }))
          const categoriesChanged = dedupedCategories.length !== state.categories.length
          const foldersChanged = dedupedFolders.some(
            (f, i) => f.categoryIds.length !== state.folders[i]?.categoryIds.length,
          )
          return categoriesChanged || foldersChanged
            ? { categories: dedupedCategories, folders: dedupedFolders }
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
      addCategoryToFolder: (folderId, categoryId) => set((state) => {
        const folders = state.folders.map((folder) =>
          folder.id === folderId && !folder.categoryIds.includes(categoryId)
            ? { ...folder, categoryIds: [...folder.categoryIds, categoryId] }
            : folder
        )
        return { folders }
      }),
      removeCategoryFromFolder: (folderId, categoryId) => set((state) => {
        const folders = state.folders.map((folder) =>
          folder.id === folderId
            ? { ...folder, categoryIds: folder.categoryIds.filter((id) => id !== categoryId) }
            : folder
        )
        return { folders }
      }),
      setFolders: (folders) => set(() => ({ folders })),
    }),
    {
      name: "cogs-task-storage", // unique name for localStorage key
      storage: createJSONStorage(() => localStorage, {
        replacer: (_key, value) => {
          if (value instanceof Date) {
            return { __type: "Date", value: value.toISOString() }
          }
          return value
        },
        reviver: (_key, value) => {
          if (value && typeof value === "object" && (value as { __type?: string }).__type === "Date") {
            return new Date((value as { value: string }).value)
          }
          return value
        },
      }),
      // Add version to handle schema changes
      version: 6,
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
          // Lists (categories) default to scheduleable so existing items keep
          // appearing in the Scheduler.
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
            persistedState.categories = persistedState.categories.filter((c: TaskCategory) => {
              if (seen.has(c.id)) return false
              seen.add(c.id)
              return true
            })
          }
          if (persistedState.folders) {
            persistedState.folders = persistedState.folders.map((f: CategoryFolder) => ({
              ...f,
              categoryIds: [...new Set(f.categoryIds)],
            }))
          }
        }
        return persistedState
      },
    },
  ),
)

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
