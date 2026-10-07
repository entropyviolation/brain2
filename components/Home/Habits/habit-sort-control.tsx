/**
 * components/Home/Habits/habit-sort-control.tsx — Analog sort plate
 *
 * Orders sit in a milled bay as equal keys (the completion-% key spans the row).
 * Daily habits sort by the week percent, so that key reads Weekly completion %.
 * Weekly, monthly, and season sort by the period on screen, so that key reads
 * Period completion %. Selected keys use the same CRT face as the period
 * switcher. Ascending / Descending sit under a hairline so direction is obvious.
 */
"use client"

import { useId } from "react"
import {
  effectiveSortDescending,
  HABIT_SORT_LABELS,
  HABIT_SORT_MODES,
  type HabitSortMode,
} from "@/lib/habit-sort"
import type { HabitFrequency } from "@/lib/types"

/** Daily sorts by week percent. Weekly, monthly, and season sort by the period on screen. */
export function habitCompletionSortLabel(frequency: HabitFrequency): string {
  return frequency === "daily" ? "Weekly completion %" : "Period completion %"
}

/**
 * Sheets that have not passed `frequency` yet are told apart by the sort bay id
 * (`habit-sort-weekly`, `habit-sort-monthly`, `habit-sort-season`).
 */
function frequencyOnPlate(frequency: HabitFrequency | undefined, id: string): HabitFrequency {
  if (frequency) return frequency
  if (id.includes("weekly")) return "weekly"
  if (id.includes("monthly")) return "monthly"
  if (id.includes("season") || id.includes("quarter")) return "quarterly"
  return "daily"
}

export function HabitSortControl({
  value,
  direction,
  onChange,
  onDirection,
  id = "habit-sort",
  frequency,
}: {
  value: HabitSortMode
  direction: "asc" | "desc" | null
  onChange: (mode: HabitSortMode) => void
  onDirection: (direction: "asc" | "desc") => void
  id?: string
  /** Habit sheet. Daily keeps the week percent; weekly, monthly, and season name the period on screen. */
  frequency?: HabitFrequency
  /**
   * Ignored. A view-mode label cannot rename this key.
   * The name comes from `frequency` (or the sort bay id until that is passed).
   */
  completionLabel?: string
}) {
  const legendId = useId()
  const descending = effectiveSortDescending(value, direction)
  const completionLabel = habitCompletionSortLabel(frequencyOnPlate(frequency, id))

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
