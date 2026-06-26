/**
 * lib/data/mongo/collections.ts — Mongo collection model (Phase 11 groundwork)
 *
 * GROUNDWORK / SCAFFOLDING — DRIVER-AGNOSTIC. Declares the planned MongoDB
 * collection names, document shapes (derived from `lib/types.ts` + the Zod
 * schemas in `lib/data/schemas.ts`), `_id` strategy, and the indexes to create.
 * There is intentionally NO `mongodb`/`mongoose` import here (the driver isn't
 * installed); these are plain TypeScript types + constants so the model can be
 * reviewed and reused before any driver lands.
 *
 * Mapping principle: COGS entities are already document-shaped (flexible
 * `attributes`, embedded `links`/`subtasks`, optional fields). The Mongo
 * document is the domain object with the app's string `id` promoted to `_id`,
 * so we avoid a second identifier and keep round-trips lossless.
 */
import type {
  Task,
  List,
  Folder,
  PeriodReview,
} from "@/lib/types"
import type { PlanTextPeriod, PointsLedgerEntry } from "@/lib/data/data-source"

/** Collection names (single COGS database; one collection per entity family). */
export const COLLECTIONS = {
  tasks: "tasks",
  categories: "categories",
  folders: "folders",
  reviews: "reviews",
  points: "points",
  plans: "plans",
} as const

export type CollectionName = (typeof COLLECTIONS)[keyof typeof COLLECTIONS]

/**
 * `_id` strategy: reuse the app's existing string ids as Mongo `_id`. They are
 * already unique, stable, and embedded in `links.targetId`, `dependencies`,
 * `parentTaskId`, etc., so promoting `id → _id` keeps every cross-reference
 * valid without a translation table. (We do NOT use `ObjectId`.)
 *
 * Helper type: take a domain entity keyed by `id` and express it as a Mongo doc
 * keyed by `_id` (the `id` field is dropped; it lives in `_id`).
 */
export type WithStringId<T extends { id: string }> = Omit<T, "id"> & { _id: string }

// ---- Document shapes -------------------------------------------------------

/** `tasks` — the unified Item/Task document (spec §5). */
export type TaskDoc = WithStringId<Task>

/** `categories` — lists, with their attribute schema embedded. */
export type CategoryDoc = WithStringId<List>

/** `folders` — category folders (self-referential via `parentFolderId`). */
export type FolderDoc = WithStringId<Folder>

/** `reviews` — period reviews. `PeriodReview.id` is `${period}:${periodKey}`. */
export type ReviewDoc = WithStringId<PeriodReview>

/**
 * `points` — append-only ledger. Source entries have no id; Mongo assigns one.
 * Kept as one document per entry to preserve the append-only audit trail.
 */
export type PointsDoc = PointsLedgerEntry & { _id?: string }

/**
 * `plans` — free-text day/week/month plans, unified from the discrete
 * localStorage keys (`dayPlan-*` etc., see `lib/plan-text.ts`). `_id` is the
 * composite `${period}:${periodKey}` so a plan is upserted in place.
 */
export interface PlanDoc {
  _id: string
  period: PlanTextPeriod
  periodKey: string
  text: string
  updatedAt: Date
}

/** Build the composite `_id` for a plan document. */
export function planDocId(period: PlanTextPeriod, periodKey: string): string {
  return `${period}:${periodKey}`
}

// ---- Index plan ------------------------------------------------------------

/** A single index spec (driver-agnostic; maps to `createIndex(keys, options)`). */
export interface IndexSpec {
  /** Field → direction (1 asc / -1 desc) or special ("text"). */
  keys: Record<string, 1 | -1 | "text">
  options?: {
    name?: string
    unique?: boolean
    sparse?: boolean
    /** Multikey indexes over array fields (tags, links) are implicit in Mongo. */
    note?: string
  }
}

/**
 * Indexes to create per collection. Covers the hot query paths in COGS today:
 * tag lookup (`tasksByTag`), link traversal (`getLinkedItems`/`getBacklinks`),
 * scheduler queries (by scheduledDate/week/month), and lifecycle filters.
 */
export const INDEXES: Record<CollectionName, IndexSpec[]> = {
  tasks: [
    { keys: { tags: 1 }, options: { name: "tags_multikey", note: "byTag()" } },
    {
      keys: { "links.targetId": 1, "links.relation": 1 },
      options: { name: "links_target_relation", note: "backlinks / linked items" },
    },
    { keys: { category: 1, completed: 1 }, options: { name: "lifecycle" } },
    { keys: { categories: 1 }, options: { name: "categories_multikey", note: "list membership" } },
    { keys: { scheduledDate: 1 }, options: { name: "scheduled_date", sparse: true } },
    {
      keys: { scheduledWeek: 1, scheduledMonth: 1, scheduledYear: 1 },
      options: { name: "scheduled_coarse", sparse: true },
    },
    { keys: { deadline: 1 }, options: { name: "deadline", sparse: true } },
    { keys: { dependencies: 1 }, options: { name: "dependencies_multikey", sparse: true } },
    {
      keys: { description: "text", title: "text", notes: "text" },
      options: { name: "task_text_search", note: "global search (spec §3 fuzzy)" },
    },
  ],
  categories: [{ keys: { order: 1 }, options: { name: "order" } }],
  folders: [
    { keys: { parentFolderId: 1 }, options: { name: "parent", sparse: true } },
    { keys: { listIds: 1 }, options: { name: "categoryIds_multikey" } },
  ],
  reviews: [
    { keys: { period: 1, periodKey: 1 }, options: { name: "period_key", unique: true } },
  ],
  points: [
    { keys: { date: 1 }, options: { name: "date" } },
    { keys: { taskId: 1 }, options: { name: "taskId" } },
  ],
  plans: [{ keys: { period: 1, periodKey: 1 }, options: { name: "period_key", unique: true } }],
}
