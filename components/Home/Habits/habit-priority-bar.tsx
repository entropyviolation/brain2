/**
 * components/Home/Habits/habit-priority-bar.tsx — Control bar above a habit sheet
 *
 * One strip inside the grid pane on daily, weekly, monthly, and season.
 * It is the control bar, not a priority heading. Every binary toggle sits
 * in one rocker cluster that may wrap. Edit default order (only while
 * Default is the active sort) and SORT: stay beside that cluster. They
 * are not rockers. The rocker face stays Off-left / On-right.
 */
"use client"

import { HabitBarRocker } from "@/components/Home/Habits/habit-led-switch"
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
  toggles,
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
  toggles: HabitControlToggle[]
}) {
  const canEdit = sortMode === "default"
  return (
    <div className="hab-priority hab-control-bar" role="region" aria-label="Control bar">
      <div className="hab-bar-rockers">
        <HabitBarRocker checked={highlight} onCheckedChange={onHighlight} label="Highlight priorities" />
        <HabitBarRocker checked={showMarks} onCheckedChange={onShowMarks} label="Streaks and multipliers" />
        {toggles.map((toggle) => (
          <HabitBarRocker
            key={toggle.id}
            id={toggle.id}
            checked={toggle.checked}
            onCheckedChange={toggle.onCheckedChange}
            label={toggle.label}
          />
        ))}
      </div>
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
