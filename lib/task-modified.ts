/**
 * lib/task-modified.ts — when an item was last changed
 *
 * `Task.modifiedAt` is an ISO string `updateTask` writes when the saved row
 * differs from the previous one (the clock itself is ignored). Operations
 * "Recently modified" reads `taskModifiedMs`. Rows that never received a stamp
 * fall back to `createdAt`, then a completion stamp, then a note's `editedAt`.
 * A Date that is not a real time is ignored by the clock and does not throw
 * while the row is fingerprinted.
 */
import type { Task } from "@/lib/types"

function dateMs(value: unknown): number | null {
  if (value == null || value === "") return null
  if (value instanceof Date) {
    const t = value.getTime()
    return Number.isNaN(t) ? null : t
  }
  if (typeof value === "string" || typeof value === "number") {
    const t = new Date(value).getTime()
    return Number.isNaN(t) ? null : t
  }
  return null
}

function stable(value: unknown): string {
  if (value instanceof Date) {
    const t = value.getTime()
    // `toISOString` throws RangeError on an Invalid Date (`new Date(undefined)`).
    if (Number.isNaN(t)) return "null"
    return JSON.stringify(value.toISOString())
  }
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>
    const keys = Object.keys(obj)
      .filter((key) => key !== "modifiedAt" && obj[key] !== undefined)
      .sort()
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stable(obj[key])}`).join(",")}}`
  }
  return JSON.stringify(value) ?? "null"
}

/** Stable content fingerprint. `modifiedAt` is not part of the content. */
export function taskContentKey(task: Task): string {
  return stable(task)
}

/** Newest known change, in milliseconds. */
export function taskModifiedMs(task: Task): number {
  let ms = dateMs(task.createdAt) ?? 0
  const stamped = dateMs(task.modifiedAt)
  if (stamped != null) ms = Math.max(ms, stamped)
  const done = dateMs(task.completedDate)
  if (done != null) ms = Math.max(ms, done)
  for (const entry of task.noteLog ?? []) {
    const edited = dateMs(entry.editedAt)
    if (edited != null) ms = Math.max(ms, edited)
  }
  return ms
}

/**
 * Keep `modifiedAt` when nothing else changed. A real edit stamps `now`.
 * A no-op save does not invent a stamp the previous row lacked.
 */
export function withModifiedStamp(prev: Task, next: Task, now: Date = new Date()): Task {
  if (taskContentKey(prev) !== taskContentKey(next)) {
    return { ...next, modifiedAt: now.toISOString() }
  }
  if (prev.modifiedAt) {
    return next.modifiedAt === prev.modifiedAt ? next : { ...next, modifiedAt: prev.modifiedAt }
  }
  if (next.modifiedAt) {
    const { modifiedAt: _drop, ...rest } = next
    return rest
  }
  return next
}
