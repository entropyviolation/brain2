/**
 * components/Home/Habits/habit-priority-bar.tsx — Control bar above a habit sheet
 *
 * One strip inside the grid pane on daily, weekly, monthly, and season.
 * Edit default order (only while Default is the active sort) and SORT:
 * only. Every rocker lives in the side panel (HabitsTabControls, Views).
 */
"use client"

import { HabitSortControl } from "@/components/Home/Habits/habit-sort-control"
import type { HabitSortMode } from "@/lib/habit-sort"
import type { HabitFrequency } from "@/lib/types"

export type HabitControlToggle = {
  id: string
  label: string
  checked: boolean
  onCheckedChange: (on: boolean) => void
}

export function HabitControlBar({
  frequency,
  sortId,
  sortMode,
  sortDirection,
  onSortMode,
  onSortDirection,
  editing,
  onEditOrder,
  onSaveOrder,
  onCancelOrder,
}: {
  frequency: HabitFrequency
  sortId?: string
  sortMode: HabitSortMode
  sortDirection: "asc" | "desc" | null
  onSortMode: (mode: HabitSortMode) => void
  onSortDirection: (direction: "asc" | "desc") => void
  editing: boolean
  onEditOrder: () => void
  onSaveOrder: () => void
  onCancelOrder: () => void
}) {
  const canEdit = sortMode === "default"
  return (
    <div className="hab-priority hab-control-bar" role="region" aria-label="Control bar">
      <div className="hab-bar-tools">
        {canEdit && !editing ? (
          <button type="button" className="hab-priority-text" onClick={onEditOrder}>
            Edit default order
          </button>
        ) : null}
        {canEdit && editing ? (
          <>
            <button type="button" className="hab-priority-text" onClick={onSaveOrder}>
              Save default order
            </button>
            <button type="button" className="hab-priority-text" onClick={onCancelOrder}>
              Cancel
            </button>
          </>
        ) : null}
        <HabitSortControl
          id={sortId}
          value={sortMode}
          direction={sortDirection}
          frequency={frequency}
          onChange={onSortMode}
          onDirection={onSortDirection}
        />
      </div>
    </div>
  )
}
