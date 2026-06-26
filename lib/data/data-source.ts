/**
 * lib/data/data-source.ts — Transport-agnostic persistence seam (Phase 10/11)
 *
 * GROUNDWORK / SCAFFOLDING ONLY. This file defines the future *async* data
 * surface that COGS persistence will converge on. It is intentionally NOT wired
 * into any live code path yet — today's code still talks to the synchronous
 * Zustand stores and `lib/data/task-repository.ts` directly.
 *
 * Why a new seam (vs. extending `TaskRepository`)?
 *   - `TaskRepository` is *synchronous* because it reads/writes the in-memory
 *     Zustand snapshot. That is correct for the localStorage world but cannot
 *     model an out-of-process backend (Electron main hosting Mongo over IPC).
 *   - `DataSource` is the **Promise-returning** generalization that can be
 *     satisfied three ways without callers caring which:
 *       1. `LocalDataSource`  — delegates to today's stores/repository (offline,
 *          default; proves the interface is satisfiable now).
 *       2. `IpcDataSource`    — renderer-side; forwards to the Electron main
 *          process over a typed `window.cogs` bridge (Phase 10).
 *       3. `MongoDataSource`  — runs in the main process; talks to MongoDB and
 *          owns real `transaction()` semantics (Phase 11).
 *
 * The interface covers EVERY entity that must persist (see `lib/data/backup.ts`
 * for the canonical inventory): tasks, categories, folders, period reviews, the
 * points ledger, and free-text plans. Writes are validated at the boundary with
 * the existing Zod schemas (`lib/data/schemas.ts`) by each implementation.
 */
import type {
  Task,
  List,
  Folder,
  PeriodReview,
  ReviewPeriod,
} from "@/lib/types"

/**
 * A single entry in the append-only points ledger. Mirrors the (currently
 * un-exported) `PointsEntry` shape in `lib/points-store.ts`; redeclared here so
 * the persistence seam does not depend on store internals.
 */
export interface PointsLedgerEntry {
  /** YYYY-MM-DD */
  date: string
  taskId: string
  points: number
  taskDescription: string
}

/**
 * Free-text plan entry (day/week/month). Today persisted as discrete
 * localStorage keys (`dayPlan-*`, `weekPlan-*`, `monthPlan-*`, see
 * `lib/plan-text.ts`); Phase 11 unifies these into a single `plans` collection.
 * Only `day`/`week`/`month` carry plan text.
 */
export type PlanTextPeriod = Extract<ReviewPeriod, "day" | "week" | "month">

export interface PlanTextEntry {
  period: PlanTextPeriod
  periodKey: string
  text: string
}

/**
 * Error type for all DataSource implementations. Distinct from
 * `ValidationError` (Zod boundary failures) so callers can tell a transport /
 * not-implemented failure apart from a bad-input failure.
 */
export class DataSourceError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = "DataSourceError"
  }
}

/**
 * Transaction handle passed to `DataSource.transaction(fn)`. In Phase 11 this
 * wraps a Mongo session so a unit of work commits atomically (or rolls back).
 * For local/offline implementations it is a no-op marker — the work simply runs
 * inline. Implementations MAY expose richer per-backend handles; this base shape
 * is all transaction-agnostic callers should rely on.
 */
export interface DataSourceTransaction {
  /** Discriminator so callers can detect a real (atomic) transaction context. */
  readonly atomic: boolean
}

/**
 * The future async persistence surface. Every method returns a Promise so the
 * same interface can be backed by an in-process store, an IPC bridge, or a
 * remote database. Read methods return snapshots; write methods validate at the
 * boundary (Zod) and resolve with the persisted entity.
 *
 * NOTE: This is additive scaffolding. The synchronous `TaskRepository` remains
 * the live data-access layer until Phase 10/11 flips callers over to a
 * `DataSource` instance.
 */
export interface DataSource {
  // ---- Tasks --------------------------------------------------------------
  getTasks(): Promise<Task[]>
  getTaskById(id: string): Promise<Task | undefined>
  findTasks(predicate: (task: Task) => boolean): Promise<Task[]>
  addTask(task: Task): Promise<Task>
  updateTask(task: Task): Promise<Task>
  removeTask(id: string): Promise<void>
  /** Tasks carrying `tag` (case/whitespace-insensitive). */
  tasksByTag(tag: string): Promise<Task[]>
  /** Add a typed link `sourceId` → `targetId`; resolves with updated source. */
  addLink(sourceId: string, relation: string, targetId: string): Promise<Task | undefined>
  /** Remove a link (by link id) from `sourceId`; resolves with updated source. */
  removeLink(sourceId: string, linkId: string): Promise<Task | undefined>

  // ---- Categories (lists) -------------------------------------------------
  getLists(): Promise<List[]>
  addList(category: List): Promise<List>
  updateList(category: List): Promise<List>
  removeList(id: string): Promise<void>

  // ---- Folders ------------------------------------------------------------
  getFolders(): Promise<Folder[]>
  addFolder(folder: Folder): Promise<Folder>
  updateFolder(folder: Folder): Promise<Folder>
  removeFolder(id: string): Promise<void>

  // ---- Period reviews -----------------------------------------------------
  getReviews(): Promise<PeriodReview[]>
  getReview(period: ReviewPeriod, periodKey: string): Promise<PeriodReview | undefined>
  saveReview(review: PeriodReview): Promise<PeriodReview>

  // ---- Points ledger ------------------------------------------------------
  getPoints(): Promise<PointsLedgerEntry[]>
  addPoints(entry: PointsLedgerEntry): Promise<PointsLedgerEntry>

  // ---- Free-text plans ----------------------------------------------------
  getPlanText(period: PlanTextPeriod, periodKey: string): Promise<string | null>
  savePlanText(entry: PlanTextEntry): Promise<PlanTextEntry>

  /**
   * Run `fn` as a unit of work. Phase 11 backends make this atomic (Mongo
   * session: commit on success, abort on throw); local/offline backends run
   * `fn` inline with a non-atomic handle. Workflows that need atomicity:
   * tag rename/merge, link symmetry (A→B implies B→A), review carry-over, and
   * module instantiation (see lib/data/mongo/mongo-data-source.ts).
   */
  transaction<T>(fn: (tx: DataSourceTransaction) => Promise<T>): Promise<T>
}
