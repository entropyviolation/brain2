/**
 * lib/migrations.ts — Versioned data migrations for the unified Item model
 *
 * Backfills the spec §5 base-Item fields (`type`, `title`, `tags`, `links`) onto
 * persisted item records, and settles `title` as the field of record. It
 * deliberately does NOT introduce a `status` field or touch the `stage`
 * lifecycle bucket / `lists` membership — those are two real axes and stay as-is
 * (`docs/CANONICAL_FIELDS.md`). Persist key `brain2-task-storage` and JSON array
 * `tasks` are unchanged. v7 backfills `title`/`tags`/`links` and does **not**
 * invent `type`. v12 fills a missing `type` only: Next Actions membership or
 * inbox lifecycle → `"task"`, else `"item"`. Explicit types (`operation`,
 * `note`, catalog, …) are never overwritten. Pure functions so they're unit-testable.
 *
 * No migration here removes a field. Everything is a backfill, because the data
 * is user-owned and a vault or a backup may be older than any assumption made
 * about it. Spec: §5 (unified Item model).
 */

import type { Folder } from "@/lib/types"
import { listIsNextActions } from "@/lib/item-utils"

function isSetType(type: unknown): type is string {
  return typeof type === "string" && type.trim() !== ""
}

/** Backfill unified base-Item fields onto a single persisted task record. */
export function migrateTaskToItem(task: Record<string, unknown>): Record<string, unknown> {
  const type = isSetType(task.type) ? task.type : undefined
  return {
    ...task,
    ...(type ? { type } : {}),
    title: (task.title as string | undefined) ?? (task.description as string | undefined) ?? "",
    tags: Array.isArray(task.tags) ? task.tags : [],
    links: Array.isArray(task.links) ? task.links : [],
  }
}

/** Backfill unified base-Item fields across a persisted task-store state blob. */
export function migrateTasksToItems(state: { tasks?: unknown[] } & Record<string, unknown>): typeof state {
  if (!Array.isArray(state.tasks)) return state
  return {
    ...state,
    tasks: state.tasks.map((t) => migrateTaskToItem(t as Record<string, unknown>)),
  }
}

/**
 * v8 — Module platform foundation (Phase 0). The new attribute types
 * (`file`/`multifile` + `FileValue`) and the module/workflow type contract are
 * fully additive and optional, so existing persisted tasks need no
 * transformation. This is an intentional no-op that exists so the store version
 * can advance with a named, testable step (and a future hook has a home).
 */
export function migrateModulePlatform<T extends Record<string, unknown>>(state: T): T {
  return state
}

/**
 * v11 — give every record a `title`, so the field of record is never empty.
 *
 * v7 backfilled `title` once, but records created since by writers that only
 * set `description` have none (144 of 2437 in a real vault). This fills those
 * in and **does nothing else**.
 *
 * In particular it does *not* reconcile records where the two have drifted
 * apart, tempting as that is. `description` turns out to have a second job:
 * `noteToParkedItem` (`lib/apple-notes.ts`) deliberately stores a short `title`
 * and the note's full text in `description`, because `lib/search.ts` indexes
 * `description` and does not index `body`. Overwriting either side there would
 * silently make parked notes unfindable or give them a multi-line name. Until
 * search reads `body`, "`description` is only a mirror of `title`" is not true
 * of every record, and a migration must not pretend otherwise.
 *
 * Nothing here is ever cleared or overwritten — only absent values are filled.
 */
export function migrateTitleAsFieldOfRecord<T extends { tasks?: unknown[] } & Record<string, unknown>>(
  state: T,
): T {
  if (!Array.isArray(state.tasks)) return state
  return {
    ...state,
    tasks: state.tasks.map((raw) => {
      const task = raw as Record<string, unknown>
      const title = typeof task.title === "string" ? task.title.trim() : ""
      if (title) return task
      const description = typeof task.description === "string" ? task.description.trim() : ""
      if (!description) return task
      return { ...task, title: description }
    }),
  }
}

function membershipIds(record: Record<string, unknown>): string[] {
  const raw = Array.isArray(record.lists)
    ? record.lists
    : Array.isArray(record.categories)
      ? record.categories
      : []
  return raw.filter((id): id is string => typeof id === "string")
}

function lifecycleStage(record: Record<string, unknown>): string | undefined {
  if (typeof record.stage === "string") return record.stage
  if (typeof record.category === "string") return record.category
  return undefined
}

function foldersFromState(state: { folders?: unknown[] }): Folder[] {
  const raw = Array.isArray(state.folders) ? state.folders : []
  return raw.map((value) => {
    const f = value as Record<string, unknown>
    const listIds = Array.isArray(f.listIds)
      ? f.listIds.filter((id): id is string => typeof id === "string")
      : Array.isArray(f.categoryIds)
        ? f.categoryIds.filter((id): id is string => typeof id === "string")
        : []
    return {
      id: typeof f.id === "string" ? f.id : "",
      name: typeof f.name === "string" ? f.name : "",
      createdAt: new Date(0),
      listIds,
      parentFolderId: typeof f.parentFolderId === "string" ? f.parentFolderId : undefined,
    }
  })
}

/**
 * Infer a missing `type`. Never overwrites an explicit type.
 *
 * Next Actions membership (any list in that folder tree) or inbox lifecycle →
 * `"task"`. Everything else with no type → `"item"`.
 */
export function inferMissingItemType(
  record: Record<string, unknown>,
  folders: Folder[],
): string {
  if (isSetType(record.type)) return record.type
  if (membershipIds(record).some((id) => listIsNextActions(id, folders))) return "task"
  if (lifecycleStage(record) === "inbox") return "task"
  return "item"
}

/**
 * v12 — give every record an honest `type` when it has none.
 *
 * v7 used to default missing type to `"task"`, which made rugs and books look
 * like Next Actions in data. This step only fills a blank; it never changes
 * `operation` / `note` / catalog / already-written `"task"` / `"item"`, and it
 * never deletes `description`.
 */
export function migrateHonestItemTypes<T extends { tasks?: unknown[] } & Record<string, unknown>>(
  state: T,
): T {
  if (!Array.isArray(state.tasks)) return state
  const folders = foldersFromState(state)
  let changed = false
  const tasks = state.tasks.map((raw) => {
    const record = raw as Record<string, unknown>
    if (isSetType(record.type)) return record
    changed = true
    return { ...record, type: inferMissingItemType(record, folders) }
  })
  return changed ? { ...state, tasks } : state
}
