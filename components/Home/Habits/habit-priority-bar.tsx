/**
 * components/Home/Habits/habit-priority-bar.tsx — Priority bar above a habit sheet
 *
 * One bar inside the grid pane on daily, weekly, monthly, and season.
 * Highlight priorities is off until turned on. Streaks and multipliers
 * start on. Sort lives here. Edit default order is only offered while
 * Default is the active sort.
 */
"use client"

import { CockpitSwitch } from "@/components/Home/Habits/cockpit-switch"
import { HabitSortControl } from "@/components/Home/Habits/habit-sort-control"
import type { HabitSortMode } from "@/lib/habit-sort"
import type { HabitFrequency } from "@/lib/types"

export function HabitPriorityBar({
  frequency,
  sortId,
  highlight,
  onHighlight,
  showMarks,
  onShowMarks,
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
  highlight: boolean
  onHighlight: (on: boolean) => void
  showMarks: boolean
  onShowMarks: (on: boolean) => void
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
    <div className="hab-priority" role="region" aria-label="Priority">
      <span className="hab-priority-legend">Priority</span>
      <CockpitSwitch checked={highlight} onCheckedChange={onHighlight} label="Highlight priorities" />
      <CockpitSwitch checked={showMarks} onCheckedChange={onShowMarks} label="Streaks and multipliers" />
      <HabitSortControl
        id={sortId}
        value={sortMode}
        direction={sortDirection}
        frequency={frequency}
        onChange={onSortMode}
        onDirection={onSortDirection}
      />
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
    </div>
  )
}
