/**
 * tracker/habit-sort-tools.tsx — Order plate for one Habits sheet.
 *
 * Returns the control bar itself. Sort ids stay `habit-sort` and the
 * weekly, monthly, and season suffixes.
 */
"use client"

import { HabitControlBar } from "@/components/Home/Habits/habit-priority-bar"
import type { HabitSortMode } from "@/lib/habit-sort"
import type { HabitFrequency, WeeklyTask } from "@/lib/types"

export type HabitSortBag = {
  sortMode: HabitSortMode
  sortDirection: "asc" | "desc" | null
  onSortMode: (mode: HabitSortMode) => void
  onSortDirection: (direction: "asc" | "desc") => void
  editingFrequency: HabitFrequency | undefined
  beginOrder: (rows: WeeklyTask[], frequency: HabitFrequency) => void
  saveOrder: () => void
  cancelOrder: () => void
}

export function habitSortTools(
  bag: HabitSortBag,
  frequency: HabitFrequency,
  rows: WeeklyTask[],
  sortId: string,
) {
  return (
    <HabitControlBar
      frequency={frequency}
      sortId={sortId}
      sortMode={bag.sortMode}
      sortDirection={bag.sortDirection}
      onSortMode={bag.onSortMode}
      onSortDirection={bag.onSortDirection}
      editing={bag.editingFrequency === frequency}
      onEditOrder={() => bag.beginOrder(rows, frequency)}
      onSaveOrder={bag.saveOrder}
      onCancelOrder={bag.cancelOrder}
    />
  )
}
