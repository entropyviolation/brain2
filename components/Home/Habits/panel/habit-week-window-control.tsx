/**
 * components/Home/Habits/habit-week-window-control.tsx — Weekly window plate
 *
 * Milled keys in the same bay as the Months plate. 7 weeks, this civil month,
 * this app quarter, 4 weeks, or this synodic month. One hint line under the keys.
 */
"use client"

import { useId } from "react"
import {
  HABIT_WEEK_WINDOW_HINTS,
  HABIT_WEEK_WINDOW_LABELS,
  HABIT_WEEK_WINDOW_MODES,
  type HabitWeekWindowMode,
} from "@/lib/habit-week-window"

const TITLES: Record<HabitWeekWindowMode, string> = {
  sevenWeeks: "Seven Monday-weeks ending this week",
  thisMonth: "Monday-weeks in this civil month",
  thisSeason: "Monday-weeks in this app quarter, through this week",
  fourWeeks: "Four Monday-weeks ending this week",
  thisMoon: "Monday-weeks from this new moon to the next, through this week",
}

export function HabitWeekWindowControl({
  mode,
  onMode,
  id = "habit-week-window",
}: {
  mode: HabitWeekWindowMode
  onMode: (mode: HabitWeekWindowMode) => void
  id?: string
}) {
  const legendId = useId()

  return (
    <div className="hab-sort" id={id}>
      <span className="hab-sort-legend" id={legendId}>
        Weeks
      </span>
      <div className="hab-sort-bay">
        <div className="hab-sort-keys" role="radiogroup" aria-labelledby={legendId}>
          {HABIT_WEEK_WINDOW_MODES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              title={TITLES[value]}
              className={`hab-sort-key hab-sort-key-wide${mode === value ? " is-on" : ""}`}
              onClick={() => onMode(value)}
            >
              {HABIT_WEEK_WINDOW_LABELS[value]}
            </button>
          ))}
        </div>
        <p className="hab-week-hint">{HABIT_WEEK_WINDOW_HINTS[mode]}</p>
      </div>
    </div>
  )
}
