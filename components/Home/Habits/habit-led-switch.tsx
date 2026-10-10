/**
 * components/Home/Habits/habit-led-switch.tsx — Horizontal rocker on the control bar
 *
 * One skeuomorphic family for every binary toggle on the habits control bar.
 * Off is the left position, on is the right. The throw travels left to right.
 * Keyboard: native button (Space / Enter). role="switch".
 */
"use client"

import "./habit-led-switch.css"

export function HabitBarRocker({
  id,
  checked,
  onCheckedChange,
  label,
}: {
  id?: string
  checked: boolean
  onCheckedChange: (on: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className="hab-bar-rocker"
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="hab-bar-rocker-plate" aria-hidden="true">
        <span className="hab-bar-rocker-track">
          <span className="hab-bar-rocker-throw" />
        </span>
        <span className="hab-bar-rocker-jewel" />
      </span>
      <span className="hab-bar-rocker-caption">{label}</span>
    </button>
  )
}
