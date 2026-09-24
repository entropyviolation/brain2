/**
 * components/Home/Habits/habit-sort-control.tsx — Analog sort plate
 *
 * The five orders sit on the plate as keys, so switching does not open a menu.
 * Ascending / descending flips the current order. A mode with no explicit
 * direction keeps the order it has always used.
 */
"use client"

import { useId } from "react"
import {
  effectiveSortDescending,
  HABIT_SORT_LABELS,
  HABIT_SORT_MODES,
  type HabitSortMode,
} from "@/lib/habit-sort"

export function HabitSortControl({
  value,
  direction,
  onChange,
  onDirection,
  id = "habit-sort",
}: {
  value: HabitSortMode
  direction: "asc" | "desc" | null
  onChange: (mode: HabitSortMode) => void
  onDirection: (direction: "asc" | "desc") => void
  id?: string
}) {
  const legendId = useId()
  const descending = effectiveSortDescending(value, direction)

  return (
    <div className="hab-sort" id={id}>
      <span className="hab-sort-legend" id={legendId}>
        Sort Habits
      </span>
      <div className="hab-sort-keys" role="radiogroup" aria-labelledby={legendId}>
        {HABIT_SORT_MODES.map((mode) => (
          <button
            key={mode}
            type="button"
            role="radio"
            aria-checked={mode === value}
            className={`hab-sort-key${mode === value ? " is-on" : ""}`}
            onClick={() => onChange(mode)}
          >
            {HABIT_SORT_LABELS[mode]}
          </button>
        ))}
      </div>
      <div className="hab-sort-dir" role="radiogroup" aria-label="Sort direction">
        <button
          type="button"
          role="radio"
          aria-checked={!descending}
          className={`hab-sort-key${!descending ? " is-on" : ""}`}
          onClick={() => onDirection("asc")}
        >
          Ascending
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={descending}
          className={`hab-sort-key${descending ? " is-on" : ""}`}
          onClick={() => onDirection("desc")}
        >
          Descending
        </button>
      </div>
    </div>
  )
}
