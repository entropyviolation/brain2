/**
 * lib/list-added-at.ts — when an item joined a list
 *
 * `Task.listAddedAt[listId]` is an ISO instant stamped by the task store when
 * an existing item gains that list (`updateTask`, `setTasks`). Leaving a list
 * drops its entry, so a re-add restamps. Lists an item was created into carry
 * no entry: `listAddedAt()` falls back to `createdAt` for them (and for every
 * item older than this field).
 */
import type { Task } from "@/lib/types"

type Membership = Pick<Task, "lists" | "listAddedAt">

/**
 * Stamp lists `next` gained over `prev` with `now` and drop entries for lists
 * it left. Returns `next` unchanged (same object) when nothing moves. An entry
 * `next` already carries (e.g. synced from another device) is kept.
 */
export function stampListAddedAt<T extends Membership>(prev: Membership | undefined, next: T, now: Date): T {
  if (!prev) return next
  const before = new Set(prev.lists ?? [])
  const lists = next.lists ?? []
  const current = next.listAddedAt ?? prev.listAddedAt
  let out: Record<string, string> | undefined
  const ensure = () => (out ??= { ...(current ?? {}) })
  for (const id of lists) {
    if (before.has(id) || current?.[id]) continue
    ensure()[id] = now.toISOString()
  }
  if (current) {
    const keep = new Set(lists)
    for (const id of Object.keys(current)) {
      if (!keep.has(id)) delete ensure()[id]
    }
  }
  if (!out) {
    // Carry the previous record across an edit that rebuilt the item without it.
    if (!next.listAddedAt && prev.listAddedAt) return { ...next, listAddedAt: prev.listAddedAt }
    return next
  }
  if (Object.keys(out).length === 0) {
    const { listAddedAt: _drop, ...rest } = next
    return rest as T
  }
  return { ...next, listAddedAt: out }
}

/** Stamp a whole replacement array against the store's current tasks. */
export function stampListAddedAtAll(prev: readonly Task[], next: Task[], now: Date): Task[] {
  if (prev === next) return next
  const byId = new Map<string, Task>()
  for (const t of prev) byId.set(t.id, t)
  let changed = false
  const out = next.map((t) => {
    const before = byId.get(t.id)
    if (!before || before === t) return t
    const stamped = stampListAddedAt(before, t, now)
    if (stamped !== t) changed = true
    return stamped
  })
  return changed ? out : next
}

function toMs(value: unknown): number | null {
  if (value == null) return null
  const ms = value instanceof Date ? value.getTime() : new Date(value as string).getTime()
  return Number.isFinite(ms) ? ms : null
}

/**
 * When `task` joined `listId` (ms), else its `createdAt`. Without a list id
 * (All Items views) the earliest join across its lists stands in.
 */
export function listAddedAt(task: Pick<Task, "createdAt" | "listAddedAt" | "lists">, listId?: string | null): number | null {
  const created = toMs(task.createdAt)
  const map = task.listAddedAt
  if (!map) return created
  if (listId) return toMs(map[listId]) ?? created
  let earliest: number | null = null
  for (const id of task.lists ?? []) {
    const ms = toMs(map[id]) ?? created
    if (ms != null && (earliest == null || ms < earliest)) earliest = ms
  }
  return earliest ?? created
}
