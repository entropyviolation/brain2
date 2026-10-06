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
 * `note`, catalog, …) are never overwritten. v13 rewrites a leftover lifecycle
 * word on `status` (`inbox` / `clarified` / `scheduled` / `list` drop off;
 * `completed` becomes `"done"`) so it matches `CompletionStatus`. v14 turns
 * folder Scheduleable defaults off so new lists are not in the Scheduler;
 * lists already marked schedulable stay. v15 turns Send to Scheduler off on
 * lists a module created (`createdByModuleId`), so a trip itinerary stays
 * scheduled on its own list. Other lists already sent stay sent. v16 records
 * an unresolved placement for each live assignment whose period has already
 * ended, and leaves those schedule fields in place. v17 moves a schedule date
 * that was stored as UTC midnight onto local midnight of that same UTC date
 * (`scheduledDate`, `deadline`, `mustBeDoneAfter`, `mustBeDoneBefore` only).
 * Every other field, including `createdAt`, stays. Pure functions so they're
 * unit-testable.
 *
 * No migration here removes a field. Everything is a backfill, because the data
 * is user-owned and a vault or a backup may be older than any assumption made
 * about it. Spec: §5 (unified Item model).
 */

import type { Folder, Task } from "@/lib/types"
import { localMidnightFromUtcDateOnly } from "@/lib/date-utils"
import { repairStoredTaskStatus } from "@/lib/completion-status"
import { FOLDER_ALL_PREFIX } from "@/lib/folder-all-items"
import { listIsNextActions } from "@/lib/item-utils"
import { recordUnresolvedPastPlacements } from "@/lib/scheduling"

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

/**
 * v13 — `status` is completion (active/done/…), not the lifecycle bucket.
 *
 * Rows written before that split still carry `inbox` / `clarified` /
 * `scheduled` / `list` on `status` (the live bucket is already `stage`).
 * `completed` is the old word for finished work. Leaving them in place makes
 * the next save throw (`Invalid task: Invalid input at status`), which is
 * what the midnight schedule roll-up hit. Stage is left untouched.
 */
export function migrateLegacyStageStatus<T extends { tasks?: unknown[] } & Record<string, unknown>>(
  state: T,
): T {
  if (!Array.isArray(state.tasks)) return state
  let changed = false
  const tasks = state.tasks.map((raw) => {
    if (!raw || typeof raw !== "object") return raw
    const next = repairStoredTaskStatus(raw as { status?: unknown; completed?: boolean })
    if (next !== raw) changed = true
    return next
  })
  return changed ? { ...state, tasks } : state
}

/**
 * v14 — Scheduleable is opt-in for new lists.
 *
 * v4 turned `scheduleable` on for every folder, and new lists inherited that,
 * so a list of tasks landed in the Scheduler without anyone asking. This step
 * turns folder defaults off. Lists that are already `true` stay in the
 * Scheduler. Backing All Items records are view prefs, not a scheduler feed,
 * so those are turned off too.
 */
export function migrateScheduleableOptIn<
  T extends { folders?: unknown[]; lists?: unknown[] } & Record<string, unknown>,
>(state: T): T {
  if (!state || typeof state !== "object") return state
  let changed = false
  const folders = Array.isArray(state.folders)
    ? state.folders.map((raw) => {
        if (!raw || typeof raw !== "object") return raw
        const folder = raw as { scheduleable?: boolean }
        if (folder.scheduleable === false) return raw
        changed = true
        return { ...folder, scheduleable: false }
      })
    : state.folders
  const lists = Array.isArray(state.lists)
    ? state.lists.map((raw) => {
        if (!raw || typeof raw !== "object") return raw
        const list = raw as { id?: string; scheduleable?: boolean }
        if (typeof list.id !== "string" || !list.id.startsWith(FOLDER_ALL_PREFIX)) return raw
        if (list.scheduleable === false) return raw
        changed = true
        return { ...list, scheduleable: false }
      })
    : state.lists
  if (!changed) return state
  return { ...state, folders, lists }
}

/**
 * A module-created list (a trip itinerary, an area list) is scheduled on its
 * own. It is not sent to the Scheduler. Lists a person already sent, with no
 * `createdByModuleId`, stay sent.
 */
export function migrateModuleListsOutOfScheduler<
  T extends { lists?: unknown[] } & Record<string, unknown>,
>(state: T): T {
  if (!state || typeof state !== "object" || !Array.isArray(state.lists)) return state
  let changed = false
  const lists = state.lists.map((raw) => {
    if (!raw || typeof raw !== "object") return raw
    const list = raw as { createdByModuleId?: unknown; scheduleable?: boolean }
    if (typeof list.createdByModuleId !== "string" || list.createdByModuleId === "") return raw
    if (list.scheduleable === false) return raw
    changed = true
    return { ...list, scheduleable: false }
  })
  if (!changed) return state
  return { ...state, lists }
}

/**
 * A period that already ended still has unfinished work sitting on its live
 * schedule fields. Record that placement so Undone can see it. The fields stay.
 */
export function migratePastAssignmentsToUndone<
  T extends { tasks?: unknown[] } & Record<string, unknown>,
>(state: T, now: Date = new Date()): T {
  if (!state || typeof state !== "object" || !Array.isArray(state.tasks)) return state
  let changed = false
  const tasks = state.tasks.map((raw) => {
    if (!raw || typeof raw !== "object") return raw
    const next = recordUnresolvedPastPlacements(raw as Task, now)
    if (next !== raw) changed = true
    return next
  })
  if (!changed) return state
  return { ...state, tasks }
}

const UTC_MIDNIGHT_ISO = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?Z$/

/**
 * Repair one schedule value. A Date or ISO string at exactly UTC midnight
 * becomes local midnight of that UTC calendar day. Anything else — including
 * null, a bare day key, and a timestamp with a time — is returned as-is.
 */
function repairUtcMidnightScheduleValue(value: unknown): unknown {
  if (value instanceof Date) {
    const next = localMidnightFromUtcDateOnly(value)
    return next.getTime() === value.getTime() ? value : next
  }
  if (typeof value !== "string" || !UTC_MIDNIGHT_ISO.test(value)) return value
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return localMidnightFromUtcDateOnly(parsed)
}

/**
 * v17. `<input type="date">` used to store `new Date("YYYY-MM-DD")` (UTC
 * midnight), which is the previous local evening west of UTC. Move only
 * `scheduledDate`, `deadline`, `mustBeDoneAfter`, and `mustBeDoneBefore` onto
 * local midnight of that UTC date. Every other field on the item stays,
 * including `createdAt` and constraint lists such as `canOnlyBeDoneOnDates`.
 * Unchanged items keep their original object.
 */
export function migrateUtcMidnightScheduleDates<
  T extends { tasks?: unknown[] } & Record<string, unknown>,
>(state: T): T {
  if (!state || typeof state !== "object" || !Array.isArray(state.tasks)) return state
  let changed = false
  const tasks = state.tasks.map((raw) => {
    if (!raw || typeof raw !== "object") return raw
    const task = raw as Record<string, unknown>
    let next: Record<string, unknown> | null = null
    const repairField = (key: "scheduledDate" | "deadline") => {
      if (!(key in task)) return
      const repaired = repairUtcMidnightScheduleValue(task[key])
      if (repaired === task[key]) return
      if (!next) next = { ...task }
      next[key] = repaired
      changed = true
    }
    repairField("scheduledDate")
    repairField("deadline")

    const constraints = task.schedulingConstraints
    if (constraints && typeof constraints === "object") {
      const current = constraints as Record<string, unknown>
      let nextConstraints: Record<string, unknown> | null = null
      for (const key of ["mustBeDoneAfter", "mustBeDoneBefore"] as const) {
        if (!(key in current)) continue
        const repaired = repairUtcMidnightScheduleValue(current[key])
        if (repaired === current[key]) continue
        if (!nextConstraints) nextConstraints = { ...current }
        nextConstraints[key] = repaired
        changed = true
      }
      if (nextConstraints) {
        if (!next) next = { ...task }
        next.schedulingConstraints = nextConstraints
      }
    }
    return next ?? raw
  })
  if (!changed) return state
  return { ...state, tasks }
}
