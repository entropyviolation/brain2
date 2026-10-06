/**
 * lib/data/task-repository.ts — Item-record data-access layer
 *
 * A thin repository over the Zustand task store. It is the *canonical*
 * caller-facing seam for domain services: instead of reaching into
 * `useTaskStore.getState()` everywhere, callers go through this interface.
 * Implementation remains `lib/task-store.ts` (one write door). The rows are
 * item records; the TypeScript document is still named `Task` / persist array
 * `tasks`. This layer is also the seam to swap localStorage/Zustand for
 * **MongoDB** later (docs/SPEC_MAPPING.md §3) without touching services or UI.
 *
 * Writes are validated at the boundary with Zod (`lib/data/schemas.ts`); invalid
 * records throw a `ValidationError` rather than corrupting a store.
 */
import type { ItemRecord, List, Folder } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { parseOrThrow, taskSchema } from "@/lib/data/schemas"
import { repairStoredTaskStatus } from "@/lib/completion-status"
import { addLink as addLinkTo, removeLink as removeLinkFrom } from "@/lib/links"

export interface TaskRepository {
  getAll(): ItemRecord[]
  getById(id: string): ItemRecord | undefined
  find(predicate: (item: ItemRecord) => boolean): ItemRecord[]
  /** Persist an item record (delegates to `addTask`). */
  add(item: ItemRecord): ItemRecord
  /**
   * Update an item record (delegates to `updateTask`).
   * `patch`, when passed, rides on the store's existing mutation event.
   */
  update(item: ItemRecord, patch?: Record<string, unknown>): ItemRecord
  remove(id: string): void
  getLists(): List[]
  getFolders(): Folder[]
  /** Item records carrying `tag` (case/whitespace-insensitive). */
  byTag(tag: string): ItemRecord[]
  /** Add a typed link from `sourceId` → `targetId`; returns the updated source. */
  addLink(sourceId: string, relation: string, targetId: string): ItemRecord | undefined
  /** Remove a link (by link id) from `sourceId`; returns the updated source. */
  removeLink(sourceId: string, linkId: string): ItemRecord | undefined
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

  add(item) {
    const repaired = repairStoredTaskStatus(item)
    parseOrThrow(taskSchema, repaired, "task")
    useTaskStore.getState().addTask(repaired)
    return repaired
  },

  update(item, patch) {
    const repaired = repairStoredTaskStatus(item)
    parseOrThrow(taskSchema, repaired, "task")
    useTaskStore.getState().updateTask(repaired, patch)
    return repaired
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
