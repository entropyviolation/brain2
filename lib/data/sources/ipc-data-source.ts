/**
 * lib/data/sources/ipc-data-source.ts — Renderer→main DataSource (Phase 10)
 *
 * GROUNDWORK / SCAFFOLDING. A renderer-side `DataSource` skeleton that forwards
 * every operation to the Electron main process over a typed `window.cogs`
 * bridge. The main process hosts the *real* DataSource (LocalDataSource now,
 * MongoDataSource in Phase 11) and answers via `ipcMain.handle`. See
 * `electron/ipc/README.md` for the end-to-end wiring plan.
 *
 * Renderer-side contract (no Electron imports here — this runs in the web/Next
 * renderer): the preload's `contextBridge` exposes `window.cogs.invoke`. This
 * class validates inputs with the existing Zod schemas BEFORE sending them over
 * the wire (so bad data never crosses the process boundary), then calls
 * `invoke(channel, payload)` and trusts the typed result.
 *
 * STATUS: transport is intentionally inert. Where a real round-trip is needed
 * but the channel/handler isn't wired yet, methods throw
 * `DataSourceError("not wired")`. These are the drop-in points for Phase 10.
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
  taskSchema,
  taskCategorySchema,
  categoryFolderSchema,
} from "@/lib/data/schemas"
import {
  DataSourceError,
  type DataSource,
  type DataSourceTransaction,
  type PlanTextEntry,
  type PlanTextPeriod,
  type PointsLedgerEntry,
} from "@/lib/data/data-source"

/**
 * Channel names the renderer invokes. MUST stay in sync with the main-process
 * mirror in `electron/ipc/channels.js` (kept as plain strings on both sides so
 * the JS main process and the TS renderer agree without a shared import).
 */
export const COGS_IPC_CHANNELS = {
  getTasks: "cogs:tasks:getAll",
  getTaskById: "cogs:tasks:getById",
  addTask: "cogs:tasks:add",
  updateTask: "cogs:tasks:update",
  removeTask: "cogs:tasks:remove",
  tasksByTag: "cogs:tasks:byTag",
  addLink: "cogs:tasks:addLink",
  removeLink: "cogs:tasks:removeLink",
  getLists: "cogs:categories:getAll",
  addList: "cogs:categories:add",
  updateList: "cogs:categories:update",
  removeList: "cogs:categories:remove",
  getFolders: "cogs:folders:getAll",
  addFolder: "cogs:folders:add",
  updateFolder: "cogs:folders:update",
  removeFolder: "cogs:folders:remove",
  getReviews: "cogs:reviews:getAll",
  getReview: "cogs:reviews:get",
  saveReview: "cogs:reviews:save",
  getPoints: "cogs:points:getAll",
  addPoints: "cogs:points:add",
  getPlanText: "cogs:plans:get",
  savePlanText: "cogs:plans:save",
  transaction: "cogs:tx:run",
} as const

export type CogsIpcChannel = (typeof COGS_IPC_CHANNELS)[keyof typeof COGS_IPC_CHANNELS]

/**
 * The bridge contract exposed by the preload via `contextBridge`. The renderer
 * sees this as `window.cogs`. Keep it minimal and serializable — only JSON-safe
 * payloads cross the boundary.
 */
export interface CogsBridge {
  /** Invoke a typed channel on the main process and await its result. */
  invoke<T = unknown>(channel: CogsIpcChannel, payload?: unknown): Promise<T>
  /** True when the IPC DataSource backend is available (Electron + wired). */
  readonly available?: boolean
}

declare global {
  interface Window {
    cogs?: CogsBridge
  }
}

/** Resolve the bridge or throw a typed "not wired" error. */
function bridge(): CogsBridge {
  const b = (globalThis as { cogs?: CogsBridge }).cogs
  if (!b) {
    // TODO(phase-10): this means the preload `contextBridge.exposeInMainWorld
    // ("cogs", ...)` is not installed (or we're running outside Electron). Fall
    // back to LocalDataSource at the composition root rather than reaching here.
    throw new DataSourceError("not wired: window.cogs bridge is unavailable")
  }
  return b
}

export class IpcDataSource implements DataSource {
  // ---- Tasks --------------------------------------------------------------
  getTasks(): Promise<Task[]> {
    return bridge().invoke<Task[]>(COGS_IPC_CHANNELS.getTasks)
  }

  getTaskById(id: string): Promise<Task | undefined> {
    return bridge().invoke<Task | undefined>(COGS_IPC_CHANNELS.getTaskById, { id })
  }

  async findTasks(predicate: (task: Task) => boolean): Promise<Task[]> {
    // Predicates are functions and cannot cross the IPC boundary. Fetch the
    // snapshot and filter renderer-side. (Phase 11 may add a serializable query
    // DSL so filtering can push down to Mongo.)
    const all = await this.getTasks()
    return all.filter(predicate)
  }

  addTask(task: Task): Promise<Task> {
    parseOrThrow(taskSchema, task, "task")
    return bridge().invoke<Task>(COGS_IPC_CHANNELS.addTask, { task })
  }

  updateTask(task: Task): Promise<Task> {
    parseOrThrow(taskSchema, task, "task")
    return bridge().invoke<Task>(COGS_IPC_CHANNELS.updateTask, { task })
  }

  removeTask(id: string): Promise<void> {
    return bridge().invoke<void>(COGS_IPC_CHANNELS.removeTask, { id })
  }

  tasksByTag(tag: string): Promise<Task[]> {
    return bridge().invoke<Task[]>(COGS_IPC_CHANNELS.tasksByTag, { tag })
  }

  addLink(sourceId: string, relation: string, targetId: string): Promise<Task | undefined> {
    return bridge().invoke<Task | undefined>(COGS_IPC_CHANNELS.addLink, {
      sourceId,
      relation,
      targetId,
    })
  }

  removeLink(sourceId: string, linkId: string): Promise<Task | undefined> {
    return bridge().invoke<Task | undefined>(COGS_IPC_CHANNELS.removeLink, { sourceId, linkId })
  }

  // ---- Categories ---------------------------------------------------------
  getLists(): Promise<List[]> {
    return bridge().invoke<List[]>(COGS_IPC_CHANNELS.getLists)
  }

  addList(category: List): Promise<List> {
    parseOrThrow(taskCategorySchema, category, "category")
    return bridge().invoke<List>(COGS_IPC_CHANNELS.addList, { category })
  }

  updateList(category: List): Promise<List> {
    parseOrThrow(taskCategorySchema, category, "category")
    return bridge().invoke<List>(COGS_IPC_CHANNELS.updateList, { category })
  }

  removeList(id: string): Promise<void> {
    return bridge().invoke<void>(COGS_IPC_CHANNELS.removeList, { id })
  }

  // ---- Folders ------------------------------------------------------------
  getFolders(): Promise<Folder[]> {
    return bridge().invoke<Folder[]>(COGS_IPC_CHANNELS.getFolders)
  }

  addFolder(folder: Folder): Promise<Folder> {
    parseOrThrow(categoryFolderSchema, folder, "folder")
    return bridge().invoke<Folder>(COGS_IPC_CHANNELS.addFolder, { folder })
  }

  updateFolder(folder: Folder): Promise<Folder> {
    parseOrThrow(categoryFolderSchema, folder, "folder")
    return bridge().invoke<Folder>(COGS_IPC_CHANNELS.updateFolder, { folder })
  }

  removeFolder(id: string): Promise<void> {
    return bridge().invoke<void>(COGS_IPC_CHANNELS.removeFolder, { id })
  }

  // ---- Period reviews -----------------------------------------------------
  getReviews(): Promise<PeriodReview[]> {
    return bridge().invoke<PeriodReview[]>(COGS_IPC_CHANNELS.getReviews)
  }

  getReview(period: ReviewPeriod, periodKey: string): Promise<PeriodReview | undefined> {
    return bridge().invoke<PeriodReview | undefined>(COGS_IPC_CHANNELS.getReview, {
      period,
      periodKey,
    })
  }

  saveReview(review: PeriodReview): Promise<PeriodReview> {
    return bridge().invoke<PeriodReview>(COGS_IPC_CHANNELS.saveReview, { review })
  }

  // ---- Points ledger ------------------------------------------------------
  getPoints(): Promise<PointsLedgerEntry[]> {
    return bridge().invoke<PointsLedgerEntry[]>(COGS_IPC_CHANNELS.getPoints)
  }

  addPoints(entry: PointsLedgerEntry): Promise<PointsLedgerEntry> {
    return bridge().invoke<PointsLedgerEntry>(COGS_IPC_CHANNELS.addPoints, { entry })
  }

  // ---- Free-text plans ----------------------------------------------------
  getPlanText(period: PlanTextPeriod, periodKey: string): Promise<string | null> {
    return bridge().invoke<string | null>(COGS_IPC_CHANNELS.getPlanText, { period, periodKey })
  }

  savePlanText(entry: PlanTextEntry): Promise<PlanTextEntry> {
    return bridge().invoke<PlanTextEntry>(COGS_IPC_CHANNELS.savePlanText, { entry })
  }

  // ---- Transaction --------------------------------------------------------
  /**
   * A transaction is inherently main-process state: the renderer cannot hold an
   * open Mongo session across IPC calls. The intended model is that callers run
   * a *named, server-side* atomic workflow exposed as its own channel, rather
   * than streaming individual ops inside a renderer-held `transaction()`.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async transaction<T>(_fn: (tx: DataSourceTransaction) => Promise<T>): Promise<T> {
    // TODO(phase-10/11): expose discrete atomic workflows as dedicated channels
    // (e.g. cogs:tx:renameTag, cogs:tx:carryOverReview) that run inside a Mongo
    // session in the main process, and call them here. A generic renderer-driven
    // transaction is not supported because the session lifetime cannot span IPC.
    throw new DataSourceError("not wired: renderer-side transactions are unsupported over IPC")
  }
}

/** Whether the IPC backend looks available in the current runtime. */
export function isIpcDataSourceAvailable(): boolean {
  const b = (globalThis as { cogs?: CogsBridge }).cogs
  return Boolean(b && (b.available ?? true))
}
