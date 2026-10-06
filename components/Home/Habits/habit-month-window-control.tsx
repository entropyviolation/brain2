/**
 * components/Home/Habits/habit-month-window-control.tsx — Monthly window plate
 *
 * Milled keys in the same bay as Sort Habits. Year so far, 12 months, or
 * since the stored birthday. Month and day are two number fields — no calendar.
 */
"use client"

import { useId } from "react"
import {
  HABIT_MONTH_WINDOW_LABELS,
  HABIT_MONTH_WINDOW_MODES,
  type HabitBirthday,
  type HabitMonthWindowMode,
} from "@/lib/habit-month-window"

const TITLES: Record<HabitMonthWindowMode, string> = {
  yearToDate: "January through this month",
  trailing12: "Twelve months ending this month",
  sinceBirthday: "From your last birthday through this month",
}

export function HabitMonthWindowControl({
  mode,
  birthday,
  onMode,
  onBirthday,
  id = "habit-month-window",
}: {
  mode: HabitMonthWindowMode
  birthday: HabitBirthday
  onMode: (mode: HabitMonthWindowMode) => void
  onBirthday: (birthday: HabitBirthday) => void
  id?: string
}) {
  const legendId = useId()

  const setPart = (part: keyof HabitBirthday, raw: string) => {
    const n = Number(raw)
    if (!Number.isInteger(n)) return
    const next = { ...birthday, [part]: n }
    if (next.month < 1 || next.month > 12 || next.day < 1 || next.day > 31) return
    onBirthday(next)
  }

  return (
    <div className="hab-sort" id={id}>
      <span className="hab-sort-legend" id={legendId}>
        Months
      </span>
      <div className="hab-sort-bay">
        <div className="hab-sort-keys" role="radiogroup" aria-labelledby={legendId}>
          {HABIT_MONTH_WINDOW_MODES.map((value) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={mode === value}
              title={TITLES[value]}
              className={`hab-sort-key hab-sort-key-wide${mode === value ? " is-on" : ""}`}
              onClick={() => onMode(value)}
            >
              {HABIT_MONTH_WINDOW_LABELS[value]}
            </button>
          ))}
        </div>
        {mode === "sinceBirthday" && (
          <div className="hab-month-bday">
            <label>
              <span>Month</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={12}
                aria-label="Birthday month"
                value={birthday.month}
                onChange={(e) => setPart("month", e.target.value)}
              />
            </label>
            <label>
              <span>Day</span>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                aria-label="Birthday day"
                value={birthday.day}
                onChange={(e) => setPart("day", e.target.value)}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  )
}
