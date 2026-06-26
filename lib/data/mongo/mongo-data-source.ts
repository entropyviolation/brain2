/**
 * lib/data/mongo/mongo-data-source.ts — MongoDB DataSource (Phase 11 groundwork)
 *
 * GROUNDWORK / SCAFFOLDING — DRIVER-AGNOSTIC. A `DataSource` skeleton that will
 * run in the Electron main process and talk to MongoDB. Every method currently
 * throws `DataSourceError("not implemented")`; the `// TODO(phase-11):` comments
 * describe the intended driver calls and which workflows require `transaction()`.
 *
 * There is intentionally NO `mongodb`/`mongoose` import (the driver isn't
 * installed). The class is shaped so adding the driver later is *localized*: the
 * only new dependency is a connection/`Db` handle injected via the constructor;
 * each method body becomes a single collection call. Document shapes, `_id`
 * strategy, and indexes are defined in `./collections.ts`; validation at the
 * boundary reuses the Zod schemas in `lib/data/schemas.ts`.
 */
import type {
  Task,
  List,
  Folder,
  PeriodReview,
  ReviewPeriod,
} from "@/lib/types"
import {
  DataSourceError,
  type DataSource,
  type DataSourceTransaction,
  type PlanTextEntry,
  type PlanTextPeriod,
  type PointsLedgerEntry,
} from "@/lib/data/data-source"
// Document shapes + indexes (types only; no driver). Imported to anchor the
// intended mapping even though the stubs don't use them yet.
import { COLLECTIONS } from "@/lib/data/mongo/collections"

/**
 * Minimal connection handle the real implementation will receive. Typed as
 * `unknown` for now so this file needs no `mongodb` types; Phase 11 narrows it
 * to the driver's `Db` (or a thin wrapper) without changing call sites.
 *
 * TODO(phase-11): replace `unknown` with `import type { Db } from "mongodb"`.
 */
export type MongoDbHandle = unknown

const NOT_IMPLEMENTED = "MongoDataSource: not implemented (Phase 11 — driver not wired)"

export class MongoDataSource implements DataSource {
  /**
   * @param db Injected Mongo `Db` handle. Optional today so the class
   *   type-checks and can be referenced before the driver is installed.
   */
  constructor(private readonly db?: MongoDbHandle) {}

  // ---- Tasks --------------------------------------------------------------
  async getTasks(): Promise<Task[]> {
    // TODO(phase-11): return db.collection(COLLECTIONS.tasks).find().toArray()
    //   mapped from TaskDoc (_id → id).
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async getTaskById(_id: string): Promise<Task | undefined> {
    // TODO(phase-11): db.collection(COLLECTIONS.tasks).findOne({ _id })
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async findTasks(_predicate: (task: Task) => boolean): Promise<Task[]> {
    // TODO(phase-11): predicates don't translate to Mongo. Either (a) fetch all
    //   and filter in-process, or (b) add a serializable query DSL that compiles
    //   to a Mongo filter. Prefer (b) for large datasets.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async addTask(_task: Task): Promise<Task> {
    // TODO(phase-11): parseOrThrow(taskSchema, _task); insertOne({ _id: id, ... }).
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async updateTask(_task: Task): Promise<Task> {
    // TODO(phase-11): parseOrThrow(taskSchema, _task); replaceOne({ _id }, doc, { upsert:false }).
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async removeTask(_id: string): Promise<void> {
    // TODO(phase-11): deleteOne({ _id }). Consider cascading: strip inbound
    //   links/dependencies pointing at this id (do it inside transaction()).
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async tasksByTag(_tag: string): Promise<Task[]> {
    // TODO(phase-11): find({ tags: normalizeTag(_tag) }) using tags_multikey index.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async addLink(_sourceId: string, _relation: string, _targetId: string): Promise<Task | undefined> {
    // TODO(phase-11): REQUIRES transaction() — link symmetry. Push the forward
    //   link on source AND the inverse (lib/links.ts inverseRelation) on target
    //   atomically so the graph never has a half-link.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async removeLink(_sourceId: string, _linkId: string): Promise<Task | undefined> {
    // TODO(phase-11): REQUIRES transaction() — remove the link and its inverse
    //   backlink atomically.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  // ---- Categories ---------------------------------------------------------
  async getLists(): Promise<List[]> {
    // TODO(phase-11): find().sort({ order: 1 }) on COLLECTIONS.categories.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async addList(_category: List): Promise<List> {
    // TODO(phase-11): parseOrThrow(taskCategorySchema); insertOne.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async updateList(_category: List): Promise<List> {
    // TODO(phase-11): replaceOne({ _id }).
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async removeList(_id: string): Promise<void> {
    // TODO(phase-11): REQUIRES transaction() — delete the category, remove its id
    //   from every task's `categories[]` and from folders' `listIds[]`.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  // ---- Folders ------------------------------------------------------------
  async getFolders(): Promise<Folder[]> {
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async addFolder(_folder: Folder): Promise<Folder> {
    // TODO(phase-11): parseOrThrow(categoryFolderSchema); insertOne.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async updateFolder(_folder: Folder): Promise<Folder> {
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async removeFolder(_id: string): Promise<void> {
    // TODO(phase-11): delete folder; reparent/clear children via parentFolderId.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  // ---- Period reviews -----------------------------------------------------
  async getReviews(): Promise<PeriodReview[]> {
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async getReview(_period: ReviewPeriod, _periodKey: string): Promise<PeriodReview | undefined> {
    // TODO(phase-11): findOne({ period, periodKey }) via the unique period_key index.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async saveReview(_review: PeriodReview): Promise<PeriodReview> {
    // TODO(phase-11): REQUIRES transaction() for carry-over — persist the review
    //   AND apply resolvedTaskIds/pushedTaskIds to the affected tasks (mark done
    //   / re-schedule into the next period) in one atomic unit.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  // ---- Points ledger ------------------------------------------------------
  async getPoints(): Promise<PointsLedgerEntry[]> {
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async addPoints(_entry: PointsLedgerEntry): Promise<PointsLedgerEntry> {
    // TODO(phase-11): insertOne into COLLECTIONS.points (append-only).
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  // ---- Free-text plans ----------------------------------------------------
  async getPlanText(_period: PlanTextPeriod, _periodKey: string): Promise<string | null> {
    // TODO(phase-11): findOne({ _id: planDocId(period, periodKey) })?.text ?? null.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  async savePlanText(_entry: PlanTextEntry): Promise<PlanTextEntry> {
    // TODO(phase-11): updateOne({ _id: planDocId(...) }, { $set: {...} }, { upsert: true }).
    throw new DataSourceError(NOT_IMPLEMENTED)
  }

  // ---- Transaction --------------------------------------------------------
  /**
   * Phase 11 atomic unit of work. Workflows that MUST use this:
   *   - tag rename/merge   (update `tags[]` across many tasks)
   *   - link symmetry      (forward link + inverse backlink together)
   *   - review carry-over   (review doc + resolved/pushed task mutations)
   *   - module instantiation (create a module's items + their links together)
   */
  async transaction<T>(_fn: (tx: DataSourceTransaction) => Promise<T>): Promise<T> {
    // TODO(phase-11): const session = client.startSession();
    //   try { let out; await session.withTransaction(async () => {
    //     out = await _fn({ atomic: true /*, session */ }) }); return out }
    //   finally { await session.endSession() }
    // The DataSourceTransaction handle should carry the driver `session` so the
    // collection calls above can enlist in it.
    throw new DataSourceError(NOT_IMPLEMENTED)
  }
}

// Referenced so the COLLECTIONS import is retained as the canonical mapping
// anchor for the (future) implementation; no runtime effect.
void COLLECTIONS
