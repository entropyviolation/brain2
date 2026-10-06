/**
 * components/Home/Habits/habit-sort-control.tsx — Analog sort plate
 *
 * Orders sit in a milled bay as equal keys (the completion-% key spans the row).
 * That key names the period on screen: Weekly on day and week, Monthly, Season.
 * Selected keys use the same CRT face as the period switcher. Ascending /
 * Descending sit under a hairline so direction is obvious.
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
  completionLabel = "Weekly completion %",
}: {
  value: HabitSortMode
  direction: "asc" | "desc" | null
  onChange: (mode: HabitSortMode) => void
  onDirection: (direction: "asc" | "desc") => void
  id?: string
  /** Day and week stay weekly. Month and season name that period. */
  completionLabel?: string
}) {
  const legendId = useId()
  const descending = effectiveSortDescending(value, direction)

  return (
    <div className="hab-sort" id={id}>
      <span className="hab-sort-legend" id={legendId}>
        Sort Habits
      </span>
      <div className="hab-sort-bay">
        <div className="hab-sort-keys" role="radiogroup" aria-labelledby={legendId}>
          {HABIT_SORT_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={mode === value}
              className={`hab-sort-key${mode === "weeklyCompletion" ? " hab-sort-key-wide" : ""}${
                mode === value ? " is-on" : ""
              }`}
              onClick={() => onChange(mode)}
            >
              {mode === "weeklyCompletion" ? completionLabel : HABIT_SORT_LABELS[mode]}
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
    </div>
  )
}
