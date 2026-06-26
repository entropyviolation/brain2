/**
 * lib/migrations.ts — Versioned data migrations for the unified Item model
 *
 * Backfills the spec §5 base-Item fields (`type`, `title`, `tags`, `links`) onto
 * persisted tasks. It deliberately does NOT introduce a `status` field or touch
 * the existing `category` lifecycle bucket / `categories` membership — those are
 * built-in task behavior and stay as-is. Pure functions so they're unit-testable.
 *
 * Spec: §5 (unified Item model). Storage target: MongoDB (docs/SPEC_MAPPING.md §3).
 */

/** Backfill unified base-Item fields onto a single persisted task record. */
export function migrateTaskToItem(task: Record<string, unknown>): Record<string, unknown> {
  return {
    ...task,
    type: (task.type as string | undefined) ?? "task",
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
