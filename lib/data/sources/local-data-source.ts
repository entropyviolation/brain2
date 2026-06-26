/**
 * lib/data/sources/local-data-source.ts — Offline/default DataSource (Phase 10)
 *
 * GROUNDWORK / SCAFFOLDING. A `DataSource` implementation backed by today's
 * synchronous Zustand stores + `taskRepository`. It proves the async
 * `DataSource` interface is satisfiable with the current architecture and is the
 * intended default/offline implementation (no Electron, no Mongo required).
 *
 * Design rules:
 *   - ADDITIVE. It must NOT replace or modify `taskRepository` or any store; it
 *     delegates to them. Existing call sites are untouched.
 *   - Sync → async bridge: every method wraps the synchronous result in a
 *     resolved Promise (`Promise.resolve(...)`). Validation already happens
 *     inside `taskRepository` (Zod via `parseOrThrow`); category/folder/review
 *     writes are validated here at the boundary before delegating.
 *   - `transaction(fn)` simply runs `fn` inline with a non-atomic handle. There
 *     is no real rollback in the localStorage world; atomicity arrives with
 *     `MongoDataSource` (Phase 11).
 */
import type {
  Task,
  List,
  Folder,
  PeriodReview,
  ReviewPeriod,
} from "@/lib/types"
import {
  parseOrThrow,
  taskCategorySchema,
  categoryFolderSchema,
} from "@/lib/data/schemas"
import { taskRepository } from "@/lib/data/task-repository"
import { useTaskStore } from "@/lib/task-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { usePointsStore } from "@/lib/points-store"
import { getStoredPlanText, saveStoredPlanText } from "@/lib/plan-text"
import {
  DataSourceError,
  type DataSource,
  type DataSourceTransaction,
  type PlanTextEntry,
  type PlanTextPeriod,
  type PointsLedgerEntry,
} from "@/lib/data/data-source"

/** Run a synchronous thunk and surface failures as `DataSourceError`. */
async function run<T>(thunk: () => T): Promise<T> {
  try {
    return thunk()
  } catch (err) {
    // Preserve ValidationError (and other typed errors) as the cause so callers
    // can still distinguish bad input from transport failures.
    throw err instanceof Error && err.name === "ValidationError"
      ? err
      : new DataSourceError("LocalDataSource operation failed", err)
  }
}

export class LocalDataSource implements DataSource {
  // ---- Tasks --------------------------------------------------------------
  getTasks(): Promise<Task[]> {
    return run(() => taskRepository.getAll())
  }

  getTaskById(id: string): Promise<Task | undefined> {
    return run(() => taskRepository.getById(id))
  }

  findTasks(predicate: (task: Task) => boolean): Promise<Task[]> {
    return run(() => taskRepository.find(predicate))
  }

  addTask(task: Task): Promise<Task> {
    return run(() => taskRepository.add(task))
  }

  updateTask(task: Task): Promise<Task> {
    return run(() => taskRepository.update(task))
  }

  removeTask(id: string): Promise<void> {
    return run(() => taskRepository.remove(id))
  }

  tasksByTag(tag: string): Promise<Task[]> {
    return run(() => taskRepository.byTag(tag))
  }

  addLink(sourceId: string, relation: string, targetId: string): Promise<Task | undefined> {
    return run(() => taskRepository.addLink(sourceId, relation, targetId))
  }

  removeLink(sourceId: string, linkId: string): Promise<Task | undefined> {
    return run(() => taskRepository.removeLink(sourceId, linkId))
  }

  // ---- Categories ---------------------------------------------------------
  getLists(): Promise<List[]> {
    return run(() => taskRepository.getLists())
  }

  addList(category: List): Promise<List> {
    return run(() => {
      parseOrThrow(taskCategorySchema, category, "category")
      useTaskStore.getState().addList(category)
      return category
    })
  }

  updateList(category: List): Promise<List> {
    return run(() => {
      parseOrThrow(taskCategorySchema, category, "category")
      useTaskStore.getState().updateList(category)
      return category
    })
  }

  removeList(id: string): Promise<void> {
    return run(() => useTaskStore.getState().deleteList(id))
  }

  // ---- Folders ------------------------------------------------------------
  getFolders(): Promise<Folder[]> {
    return run(() => taskRepository.getFolders())
  }

  addFolder(folder: Folder): Promise<Folder> {
    return run(() => {
      parseOrThrow(categoryFolderSchema, folder, "folder")
      useTaskStore.getState().addFolder(folder)
      return folder
    })
  }

  updateFolder(folder: Folder): Promise<Folder> {
    return run(() => {
      parseOrThrow(categoryFolderSchema, folder, "folder")
      useTaskStore.getState().updateFolder(folder)
      return folder
    })
  }

  removeFolder(id: string): Promise<void> {
    return run(() => useTaskStore.getState().deleteFolder(id))
  }

  // ---- Period reviews -----------------------------------------------------
  getReviews(): Promise<PeriodReview[]> {
    return run(() => useReviewsStore.getState().reviews)
  }

  getReview(period: ReviewPeriod, periodKey: string): Promise<PeriodReview | undefined> {
    return run(() => useReviewsStore.getState().getReview(period, periodKey))
  }

  saveReview(review: PeriodReview): Promise<PeriodReview> {
    return run(() => {
      useReviewsStore.getState().saveReview(review)
      return review
    })
  }

  // ---- Points ledger ------------------------------------------------------
  getPoints(): Promise<PointsLedgerEntry[]> {
    return run(() => usePointsStore.getState().pointsHistory)
  }

  addPoints(entry: PointsLedgerEntry): Promise<PointsLedgerEntry> {
    return run(() => {
      // Append directly so the caller-provided (already-formatted) date string
      // is preserved verbatim, rather than re-deriving it via the store action.
      usePointsStore.setState((state) => ({
        pointsHistory: [...state.pointsHistory, entry],
      }))
      return entry
    })
  }

  // ---- Free-text plans ----------------------------------------------------
  getPlanText(period: PlanTextPeriod, periodKey: string): Promise<string | null> {
    return run(() => getStoredPlanText(period, periodKey))
  }

  savePlanText(entry: PlanTextEntry): Promise<PlanTextEntry> {
    return run(() => {
      saveStoredPlanText(entry.period, entry.periodKey, entry.text)
      return entry
    })
  }

  // ---- Transaction --------------------------------------------------------
  /**
   * No real atomicity in the localStorage world: run `fn` inline with a
   * non-atomic handle. If `fn` throws, partial writes already applied to the
   * stores are NOT rolled back (documented limitation; Phase 11 fixes this).
   */
  async transaction<T>(fn: (tx: DataSourceTransaction) => Promise<T>): Promise<T> {
    return fn({ atomic: false })
  }
}

/** Shared default instance (offline). */
export const localDataSource = new LocalDataSource()
