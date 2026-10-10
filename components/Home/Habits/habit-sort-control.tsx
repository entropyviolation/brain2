/**
 * components/Home/Habits/habit-sort-control.tsx — Sort on the Priority bar
 *
 * A milled `habit95-select` (not a native OS popup) plus one direction key.
 * Daily names the completion key Weekly completion %. Weekly, monthly, and
 * season name it Period completion %. The key stores asc / desc. Its mark
 * shows which of those is active.
 */
"use client"

import { useEffect, useId, useRef, useState } from "react"
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
 * Names for the stored asc / desc pair. The click still writes that direction.
 * Completion % and priority compare a number. Alphabetical is A→Z / Z→A.
 * Date created asc is oldest. Default asc is the store array.
 */
export function habitSortDirectionLabels(mode: HabitSortMode): { asc: string; desc: string } {
  switch (mode) {
    case "alphabetical":
      return { asc: "A → Z", desc: "Z → A" }
    case "created":
      return { asc: "Oldest first", desc: "Newest first" }
    case "weeklyCompletion":
    case "priority":
      return { asc: "Low first", desc: "High first" }
    case "default":
      return { asc: "As stored", desc: "Reversed" }
  }
}

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
  /** Habit sheet. Daily keeps the week percent; the other sheets name the period on screen. */
  frequency?: HabitFrequency
  /**
   * Ignored. A view-mode label cannot rename this key.
   * The name comes from `frequency` (or the sort id until that is passed).
   */
  completionLabel?: string
}) {
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const descending = effectiveSortDescending(value, direction)
  const completionLabel = habitCompletionSortLabel(frequencyOnPlate(frequency, id))
  const directionLabels = habitSortDirectionLabels(value)
  const valueLabel = value === "weeklyCompletion" ? completionLabel : HABIT_SORT_LABELS[value]
  const activeName = descending ? directionLabels.desc : directionLabels.asc

  useEffect(() => {
    if (!open) return
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("mousedown", onPointer)
    window.addEventListener("keydown", onKey)
    return () => {
      window.removeEventListener("mousedown", onPointer)
      window.removeEventListener("keydown", onKey)
    }
  }, [open])

  return (
    <div className="hab-priority-sort" id={id}>
      <div className="habit95-pick" ref={rootRef}>
        <button
          type="button"
          className="habit95-select"
          aria-label="Sort"
          aria-expanded={open}
          aria-haspopup="listbox"
          aria-controls={open ? menuId : undefined}
          onClick={() => setOpen((current) => !current)}
        >
          <span className="habit95-select-label">{valueLabel}</span>
          <span className="habit95-select-arrow" aria-hidden />
        </button>
        {open ? (
          <div className="habit95-select-menu" id={menuId} role="listbox" aria-label="Sort">
            {HABIT_SORT_MODES.map((mode) => {
              const label = mode === "weeklyCompletion" ? completionLabel : HABIT_SORT_LABELS[mode]
              const selected = mode === value
              return (
                <button
                  key={mode}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className="habit95-habit-option"
                  onClick={() => {
                    onChange(mode)
                    setOpen(false)
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        className={`hab-priority-dir${descending ? " is-desc" : " is-asc"}`}
        aria-pressed={descending}
        aria-label={descending ? "Sort descending" : "Sort ascending"}
        title={activeName}
        onClick={() => onDirection(descending ? "asc" : "desc")}
      >
        <span aria-hidden>{descending ? "↓" : "↑"}</span>
      </button>
    </div>
  )
}
