/**
 * lib/data/task-repository.ts — Task data-access layer
 *
 * A thin repository over the Zustand task store. It is the *canonical*
 * data-access surface for domain services and new code: instead of reaching into
 * `useTaskStore.getState()` everywhere, callers go through this interface. That
 * decouples business logic from the storage mechanism and gives us one seam to
 * swap localStorage/Zustand for **MongoDB** later (docs/SPEC_MAPPING.md §3)
 * without touching services or UI.
 *
 * Writes are validated at the boundary with Zod (`lib/data/schemas.ts`); invalid
 * records throw a `ValidationError` rather than corrupting a store.
 */
import type { Task, List, Folder } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { parseOrThrow, taskSchema } from "@/lib/data/schemas"
import { addLink as addLinkTo, removeLink as removeLinkFrom } from "@/lib/links"

export interface TaskRepository {
  getAll(): Task[]
  getById(id: string): Task | undefined
  find(predicate: (task: Task) => boolean): Task[]
  add(task: Task): Task
  update(task: Task): Task
  remove(id: string): void
  getLists(): List[]
  getFolders(): Folder[]
  /** Tasks carrying `tag` (case/whitespace-insensitive). */
  byTag(tag: string): Task[]
  /** Add a typed link from `sourceId` → `targetId`; returns the updated source. */
  addLink(sourceId: string, relation: string, targetId: string): Task | undefined
  /** Remove a link (by link id) from `sourceId`; returns the updated source. */
  removeLink(sourceId: string, linkId: string): Task | undefined
}

/**
 * Repository backed by the live Zustand task store. Reads are snapshots of the
 * current state; writes validate then delegate to the store actions (which keep
 * Date coercion and points-awarding behavior intact).
 */
export const taskRepository: TaskRepository = {
  getAll() {
    return useTaskStore.getState().tasks
  },

  getById(id) {
    return useTaskStore.getState().tasks.find((t) => t.id === id)
  },

  find(predicate) {
    return useTaskStore.getState().tasks.filter(predicate)
  },

  add(task) {
    parseOrThrow(taskSchema, task, "task")
    useTaskStore.getState().addTask(task)
    return task
  },

  update(task) {
    parseOrThrow(taskSchema, task, "task")
    useTaskStore.getState().updateTask(task)
    return task
  },

  remove(id) {
    useTaskStore.getState().deleteTask(id)
  },

  getLists() {
    return useTaskStore.getState().lists
  },

  getFolders() {
    return useTaskStore.getState().folders
  },

  byTag(tag) {
    return useTaskStore.getState().getByTag(tag)
  },

  addLink(sourceId, relation, targetId) {
    const source = this.getById(sourceId)
    if (!source) return undefined
    const links = addLinkTo(source.links, relation, targetId, sourceId)
    if (links === source.links) return source // self-link or duplicate: no change
    return this.update({ ...source, links })
  },

  removeLink(sourceId, linkId) {
    const source = this.getById(sourceId)
    if (!source) return undefined
    const links = removeLinkFrom(source.links, linkId)
    if (links === source.links) return source
    return this.update({ ...source, links })
  },
}
