/**
 * lib/habit-order.ts — Default habit order
 *
 * The Default sort is the store array. Saving a new default rewrites that
 * array for one frequency and leaves every completion map alone.
 * Pointer reorder asks which visible row the pointer is above, then
 * moves the dragged id to sit before that row (or at the end).
 */
import type { HabitFrequency, WeeklyTask } from "./types"

export function habitFrequencyOf(task: WeeklyTask): HabitFrequency {
  return task.frequency || "daily"
}

/** Place `orderedIds` into the slots this frequency already occupies. */
export function applyHabitOrder<T extends WeeklyTask>(
  tasks: readonly T[],
  frequency: HabitFrequency,
  orderedIds: readonly string[],
): T[] {
  const rank = new Map(orderedIds.map((id, index) => [id, index]))
  const group = tasks.filter((task) => habitFrequencyOf(task) === frequency)
  const sorted = [...group].sort((a, b) => {
    const ar = rank.has(a.id) ? rank.get(a.id)! : orderedIds.length
    const br = rank.has(b.id) ? rank.get(b.id)! : orderedIds.length
    return ar - br
  })
  let index = 0
  return tasks.map((task) => (habitFrequencyOf(task) === frequency ? sorted[index++]! : task))
}

/** Move `movingId` to sit immediately before `beforeId`. `null` sends it to the end. */
export function reorderIdList(ids: readonly string[], movingId: string, beforeId: string | null): string[] {
  if (!ids.includes(movingId)) return [...ids]
  const rest = ids.filter((id) => id !== movingId)
  if (beforeId === null) return [...rest, movingId]
  const at = rest.indexOf(beforeId)
  if (at < 0) return [...rest, movingId]
  const next = [...rest]
  next.splice(at, 0, movingId)
  return next
}

/**
 * The visible row the pointer should insert before.
 * Rows are in paint order. The dragged row is skipped so its own box
 * does not count as a target. `null` means the end of the list.
 */
export function pointerBeforeId(
  rows: readonly { id: string; top: number; height: number }[],
  movingId: string,
  clientY: number,
): string | null {
  for (const row of rows) {
    if (row.id === movingId) continue
    const mid = row.top + Math.max(row.height, 1) / 2
    if (clientY < mid) return row.id
  }
  return null
}

/** Splice a new visible order back into a full id list, leaving hidden ids in place. */
export function mergeVisibleOrder(full: readonly string[], visibleNext: readonly string[]): string[] {
  const visible = new Set(visibleNext)
  let index = 0
  return full.map((id) => (visible.has(id) ? visibleNext[index++]! : id))
}
