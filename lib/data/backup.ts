/**
 * lib/data/backup.ts — Full app backup & restore
 *
 * One-click export/import of the *entire* app: every persisted Zustand store
 * plus the free-text plan areas (day/week/month). Implemented as a snapshot of
 * the underlying localStorage entries so it round-trips each store's own
 * (de)serialization (including Date encoding) without coupling to internal store
 * shapes. Restoring writes the entries back and rehydrates the live stores.
 *
 * This is the app-wide layer the per-screen JSON exports should defer to
 * (docs/SPEC_MAPPING.md §3.2). Target backend: MongoDB export/import (§3).
 */
import { z } from "zod"
import type { Task, List } from "@/lib/types"
import { useTaskStore } from "@/lib/task-store"
import { getDescendants } from "@/lib/list-tree"
import { useEventStore } from "@/lib/event-store"
import { useGoalsStore } from "@/lib/goals-store"
import { useHabitsStore } from "@/lib/habits-store"
import { usePointsStore } from "@/lib/points-store"
import { useReviewsStore } from "@/lib/reviews-store"
import { useModulesStore } from "@/lib/modules-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { useThemeStore } from "@/lib/theme-store"
import { useItemTypeStore } from "@/lib/item-type-store"
import { useWorkflowsStore } from "@/lib/workflows-store"
import type { ModuleDefinition } from "@/lib/types"
import { parseModuleDefinition, useModuleDefinitionsStore } from "@/lib/module-definitions"

/** A persisted store: its localStorage key and a rehydrate trigger. */
interface StoreDescriptor {
  key: string
  rehydrate: () => void | Promise<void>
}

/** Registry of every persisted store included in a full backup. */
export const BACKUP_STORES: StoreDescriptor[] = [
  { key: "cogs-task-storage", rehydrate: () => useTaskStore.persist.rehydrate() },
  { key: "cogs-event-storage", rehydrate: () => useEventStore.persist.rehydrate() },
  { key: "cogs-goals-store", rehydrate: () => useGoalsStore.persist.rehydrate() },
  { key: "cogs-habits-store", rehydrate: () => useHabitsStore.persist.rehydrate() },
  { key: "points-store", rehydrate: () => usePointsStore.persist.rehydrate() },
  { key: "cogs-reviews-store", rehydrate: () => useReviewsStore.persist.rehydrate() },
  { key: "cogs-modules-store", rehydrate: () => useModulesStore.persist.rehydrate() },
  { key: "cogs-timegrid-store", rehydrate: () => useTimeTrackingStore.persist.rehydrate() },
  { key: "cogs-lists-ui", rehydrate: () => useListsUiStore.persist.rehydrate() },
  { key: "cogs-theme-store", rehydrate: () => useThemeStore.persist.rehydrate() },
  { key: "cogs-item-types-store", rehydrate: () => useItemTypeStore.persist.rehydrate() },
  { key: "cogs-workflows-store", rehydrate: () => useWorkflowsStore.persist.rehydrate() },
  { key: "cogs-module-definitions", rehydrate: () => useModuleDefinitionsStore.persist.rehydrate() },
]

/** localStorage key prefixes for free-text plans (lib/plan-text.ts). */
export const PLAN_TEXT_PREFIXES = ["dayPlan-", "weekPlan-", "monthPlan-"]

export const BACKUP_VERSION = 1 as const

export const backupSchema = z.object({
  app: z.literal("cogs"),
  version: z.number(),
  exportedAt: z.string(),
  /** Raw persisted store payloads keyed by localStorage key. */
  stores: z.record(z.string(), z.unknown()),
  /** Free-text plan entries keyed by localStorage key. */
  planText: z.record(z.string(), z.string()),
})

export type Backup = z.infer<typeof backupSchema>

function isPlanTextKey(key: string): boolean {
  return PLAN_TEXT_PREFIXES.some((prefix) => key.startsWith(prefix))
}

/** Enumerate localStorage keys robustly (works across browsers + jsdom). */
function allLocalStorageKeys(): string[] {
  const keys = new Set<string>()
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key != null) keys.add(key)
  }
  for (const key of Object.keys(localStorage)) keys.add(key)
  return [...keys]
}

/** Build a full backup object from the current localStorage state. */
export function createBackup(): Backup {
  const stores: Record<string, unknown> = {}
  for (const { key } of BACKUP_STORES) {
    const raw = localStorage.getItem(key)
    if (raw == null) continue
    try {
      stores[key] = JSON.parse(raw)
    } catch {
      stores[key] = raw
    }
  }

  const planText: Record<string, string> = {}
  for (const key of allLocalStorageKeys()) {
    if (isPlanTextKey(key)) {
      const value = localStorage.getItem(key)
      if (value != null) planText[key] = value
    }
  }

  return {
    app: "cogs",
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
    planText,
  }
}

/** Serialize a backup to a pretty JSON string. */
export function serializeBackup(backup: Backup = createBackup()): string {
  return JSON.stringify(backup, null, 2)
}

/** Parse + validate a backup JSON string (throws on invalid shape). */
export function parseBackup(json: string): Backup {
  const data = JSON.parse(json)
  return backupSchema.parse(data)
}

/**
 * Restore a backup: overwrite the relevant localStorage entries and rehydrate
 * the live stores. This is a full replace (the only correct semantics for a
 * whole-app backup). Returns the count of stores/plan entries written.
 */
export async function restoreBackup(backup: Backup): Promise<{ stores: number; planText: number }> {
  const validKeys = new Set(BACKUP_STORES.map((s) => s.key))

  // Clear any existing plan-text so a restore is a clean replace.
  allLocalStorageKeys()
    .filter(isPlanTextKey)
    .forEach((key) => localStorage.removeItem(key))

  let storeCount = 0
  for (const [key, payload] of Object.entries(backup.stores)) {
    if (!validKeys.has(key)) continue
    localStorage.setItem(key, typeof payload === "string" ? payload : JSON.stringify(payload))
    storeCount++
  }

  let planCount = 0
  for (const [key, value] of Object.entries(backup.planText)) {
    if (!isPlanTextKey(key)) continue
    localStorage.setItem(key, value)
    planCount++
  }

  await Promise.all(BACKUP_STORES.map((s) => s.rehydrate()))

  return { stores: storeCount, planText: planCount }
}

// ---------------------------------------------------------------------------
// Per-category export / import (Feature 8 + HM4, Worker H)
//
// A focused serializer for a single list *and its sublists* (nested via
// `parentListId`) plus every task filed into any of those lists. Unlike the
// whole-app backup above, this is a portable subtree you can hand to another
// list/vault. Tasks are matched by membership in `Task.lists`.
// ---------------------------------------------------------------------------

export const CATEGORY_EXPORT_VERSION = 1 as const

export const categoryExportSchema = z.object({
  app: z.literal("cogs"),
  kind: z.literal("category"),
  version: z.number(),
  exportedAt: z.string(),
  /** The root list followed by its descendant sublists. */
  lists: z.array(z.record(z.string(), z.unknown())).optional(),
  /** Legacy key (pre category→list migration). */
  categories: z.array(z.record(z.string(), z.unknown())).optional(),
  /** Tasks belonging to any exported list. */
  tasks: z.array(z.record(z.string(), z.unknown())),
})

export interface CategoryExport {
  app: "cogs"
  kind: "category"
  version: number
  exportedAt: string
  lists: List[]
  tasks: Task[]
}

/** Build a per-list export object (list subtree + member tasks). */
export function buildCategoryExport(categoryId: string): CategoryExport | null {
  const { lists, tasks } = useTaskStore.getState()
  const root = lists.find((c) => c.id === categoryId)
  if (!root) return null

  const subtree = [root, ...getDescendants(lists, categoryId)]
  const exportedIds = new Set(subtree.map((c) => c.id))
  const memberTasks = tasks.filter((t) => (t.lists ?? []).some((id) => exportedIds.has(id)))

  return {
    app: "cogs",
    kind: "category",
    version: CATEGORY_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    lists: subtree,
    tasks: memberTasks,
  }
}

/** Serialize a single category subtree to a pretty JSON string. */
export function exportCategory(categoryId: string): string | null {
  const data = buildCategoryExport(categoryId)
  return data ? JSON.stringify(data, null, 2) : null
}

function reviveDate(value: unknown): Date | undefined {
  if (value == null) return undefined
  const d = new Date(value as string)
  return Number.isNaN(d.getTime()) ? undefined : d
}

function reviveCategory(raw: any): List {
  // Tolerate legacy exports that still key the parent as `parentCategoryId`.
  const { parentCategoryId, ...rest } = raw
  return {
    ...rest,
    ...(parentCategoryId !== undefined ? { parentListId: parentCategoryId } : {}),
    createdAt: reviveDate(raw.createdAt) ?? new Date(),
  } as List
}

function reviveTask(raw: any): Task {
  // Tolerate legacy exports that still key lifecycle/membership as
  // `category`/`categories` (renamed to `stage`/`lists`).
  const { category, categories, ...rest } = raw
  return {
    ...rest,
    stage: raw.stage ?? category,
    lists: raw.lists ?? categories ?? [],
    createdAt: reviveDate(raw.createdAt) ?? new Date(),
    deadline: reviveDate(raw.deadline),
    scheduledDate: reviveDate(raw.scheduledDate),
  } as Task
}

/** Parse + validate a per-category export JSON string (throws on bad shape). */
export function parseCategoryExport(json: string): CategoryExport {
  const data = categoryExportSchema.parse(JSON.parse(json))
  // Tolerate legacy exports that key the list subtree as `categories`.
  const rawLists = (data.lists ?? data.categories ?? []) as unknown as List[]
  return {
    ...data,
    app: "cogs",
    kind: "category",
    lists: rawLists.map(reviveCategory),
    tasks: (data.tasks as unknown as Task[]).map(reviveTask),
  }
}

/**
 * Import a per-category export into the live task store.
 * - `"merge"` (default): add categories/tasks whose ids are new; existing ids
 *   are left untouched.
 * - `"replace"`: overwrite categories/tasks that share an id with the import.
 * Dates are revived from ISO strings. Returns the counts written.
 */
export function importCategory(
  data: CategoryExport,
  mode: "merge" | "replace" = "merge",
): { lists: number; tasks: number } {
  const store = useTaskStore.getState()
  const categories = data.lists.map(reviveCategory)
  const tasks = data.tasks.map(reviveTask)

  const existingCategoryIds = new Set(store.lists.map((c) => c.id))
  const existingTaskIds = new Set(store.tasks.map((t) => t.id))

  for (const category of categories) {
    if (existingCategoryIds.has(category.id)) {
      if (mode === "replace") store.updateList(category)
    } else {
      store.addList(category)
    }
  }
  for (const task of tasks) {
    if (existingTaskIds.has(task.id)) {
      if (mode === "replace") store.updateTask(task)
    } else {
      store.addTask(task)
    }
  }

  return { lists: categories.length, tasks: tasks.length }
}

/** Trigger a browser download of a single category subtree as JSON. */
export function downloadCategoryExport(categoryId: string, filename?: string): void {
  const json = exportCategory(categoryId)
  if (json == null) return
  const name = filename ?? `cogs-category-${categoryId}-${new Date().toISOString().split("T")[0]}.json`
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

// ---------------------------------------------------------------------------
// Per-module-definition export / import (Module platform, Workstream C)
//
// A focused, portable serializer for a single `ModuleDefinition` — the design-
// time blueprint of a module (bound lists, views, workflows, plan-sync). Wrapped
// in a small envelope so importers can sniff the kind. Round-trippable and free
// of functions (the underlying type is fully serializable). See
// `lib/module-definitions.ts` for the store + pure (de)serialize helpers.
// ---------------------------------------------------------------------------

export const MODULE_DEFINITION_EXPORT_VERSION = 1 as const

export interface ModuleDefinitionExport {
  app: "cogs"
  kind: "module-definition"
  version: number
  exportedAt: string
  definition: ModuleDefinition
}

/** Serialize a stored module definition (by id) to a portable JSON envelope. */
export function exportModuleDefinition(definitionId: string): string | null {
  const def = useModuleDefinitionsStore.getState().getDefinition(definitionId)
  if (!def) return null
  const payload: ModuleDefinitionExport = {
    app: "cogs",
    kind: "module-definition",
    version: MODULE_DEFINITION_EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    definition: def,
  }
  return JSON.stringify(payload, null, 2)
}

/**
 * Import a module-definition JSON string into the definitions store. Accepts the
 * envelope from `exportModuleDefinition` or a bare definition (both handled by
 * `parseModuleDefinition`). When `regenerateId` is true (default) a fresh id is
 * minted so an import never clobbers an existing definition. Returns the stored
 * definition.
 */
export function importModuleDefinition(
  json: string,
  { regenerateId = true }: { regenerateId?: boolean } = {},
): ModuleDefinition {
  const parsed = parseModuleDefinition(json)
  const store = useModuleDefinitionsStore.getState()
  if (regenerateId || store.getDefinition(parsed.id)) {
    const id = store.addDefinition({ ...parsed, id: undefined })
    return store.getDefinition(id)!
  }
  store.addModuleDefinition(parsed)
  return parsed
}

/** Trigger a browser download of a single module definition as JSON. */
export function downloadModuleDefinition(definitionId: string, filename?: string): void {
  const json = exportModuleDefinition(definitionId)
  if (json == null) return
  const name = filename ?? `cogs-module-${definitionId}-${new Date().toISOString().split("T")[0]}.json`
  const blob = new Blob([json], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/** Trigger a browser download of the current backup as a JSON file. */
export function downloadBackup(filename?: string): void {
  const name = filename ?? `cogs-backup-${new Date().toISOString().split("T")[0]}.json`
  const blob = new Blob([serializeBackup()], { type: "application/json" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = name
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
