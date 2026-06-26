/**
 * lib/workflow-hooks.ts — Item-mutation dispatch seam (Module platform, Phase 0)
 *
 * A tiny, dependency-free registry that lets a future workflow engine observe
 * item mutations WITHOUT later edits to `lib/task-store.ts`. The store calls
 * `dispatchItemMutation(...)` on create / update / complete; by default there
 * is no registered dispatcher, so this is a pure no-op with zero behavior
 * change today. The engine workstream registers a dispatcher at startup.
 *
 * Intentionally has no imports beyond the `Task` type so it stays cycle-free
 * and safe to import from the store.
 */
import type { Task } from "@/lib/types"

/** A single observed item mutation emitted by the task store. */
export interface ItemMutationEvent {
  trigger: "create" | "update" | "complete"
  itemId: string
  /** Previous task snapshot (absent on create). */
  before?: Task
  /** Resulting task snapshot. */
  after?: Task
  /** Best-effort list of changed attribute ids (update only). */
  changedAttrs?: string[]
}

type Dispatcher = (e: ItemMutationEvent) => void

let dispatcher: Dispatcher | null = null

/** Register (or clear, with `null`) the active item-mutation dispatcher. */
export function registerItemMutationDispatcher(d: Dispatcher | null): void {
  dispatcher = d
}

/**
 * Dispatch an item-mutation event to the registered dispatcher, if any.
 * Side-effect-safe: a throwing dispatcher never breaks the originating
 * mutation (the error is logged outside production).
 */
export function dispatchItemMutation(e: ItemMutationEvent): void {
  try {
    dispatcher?.(e)
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[workflow-hooks] dispatcher threw", err)
    }
  }
}
