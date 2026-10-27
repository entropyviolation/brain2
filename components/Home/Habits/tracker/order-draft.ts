/**
 * tracker/order-draft.ts — Visible-row order while Default sort is in edit.
 *
 * Pure helpers. The draft state and the store write stay on the desktop page.
 */
import type { HabitFrequency, WeeklyTask } from "@/lib/types"
import type { HabitSortMode } from "@/lib/habit-sort"
import { mergeVisibleOrder } from "@/lib/habit-order"

export type HabitOrderDraft = { frequency: HabitFrequency; ids: string[] }

export function orderWithDraft(
  rows: WeeklyTask[],
  frequency: HabitFrequency,
  orderDraft: HabitOrderDraft | null,
): WeeklyTask[] {
  if (!orderDraft || orderDraft.frequency !== frequency) return rows
  const rank = new Map(orderDraft.ids.map((id, index) => [id, index]))
  return [...rows].sort((a, b) => (rank.get(a.id) ?? 1e9) - (rank.get(b.id) ?? 1e9))
}

export function editingFrequency(
  habitSortMode: HabitSortMode,
  orderDraft: HabitOrderDraft | null,
): HabitFrequency | undefined {
  return habitSortMode === "default" ? orderDraft?.frequency : undefined
}

export function reorderVisibleDraft(
  prev: HabitOrderDraft | null,
  frequency: HabitFrequency,
  visibleIds: string[],
): HabitOrderDraft | null {
  if (!prev || prev.frequency !== frequency) return prev
  return { frequency, ids: mergeVisibleOrder(prev.ids, visibleIds) }
}
