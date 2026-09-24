/**
 * components/Home/Habits/habit-led-lamp.tsx — Recessed panel indicator
 *
 * Shared Yes/No lamp for Daily / Weekly / Monthly sheets (and any other
 * boolean). **Small LEDs** ON (default): 15px dark well with one round die,
 * the same lamp language as the percent readout. OFF: rectangular consult /
 * TENO / Tek panel window that
 * fills the same cell (`data-fill`) — glass, metal bezel, even glow; not an oval,
 * sphere, or pill. The cell box does not grow or shrink. Same write path: click or Space/Enter toggles `completed`.
 * Off = dark glass; on = `percentLedTint` (warm/dark mix, not blast-white);
 * partial = dimmer tint. Unavailable = grey plate: the period is exempt,
 * neither done nor still owed.
 */
"use client"

import type { CSSProperties } from "react"
import { booleanLampState, type HabitLampState } from "@/lib/habit-led"
import { useHabitsStore } from "@/lib/habits-store"
import "./habit-led-lamp.css"

export function HabitLedLamp({
  checked,
  onCheckedChange,
  label,
  tracked = false,
  ratio,
  tint,
  unavailable = false,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  tracked?: boolean
  ratio?: number
  tint?: string
  /** Exempt period: grey plate, not the completion light and not the dark “still owed” glass. */
  unavailable?: boolean
}) {
  const storedTint = useHabitsStore((s) => s.percentLedTint)
  const smallLeds = useHabitsStore((s) => s.habitSmallLeds)
  const state: HabitLampState = booleanLampState(checked, ratio)
  const color = tint || storedTint

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      title={label}
      data-state={unavailable ? "unavailable" : state}
      data-tracked={tracked ? "true" : undefined}
      data-fill={smallLeds ? undefined : "true"}
      data-no95=""
      className="hab-lamp"
      style={{ "--hab-lamp-tint": color } as CSSProperties}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="hab-lamp-socket" aria-hidden="true">
        <span className="hab-lamp-bezel">
          <span className="hab-lamp-glass">
            <span className="hab-lamp-die" />
            <span className="hab-lamp-core" />
            <span className="hab-lamp-bloom" />
            <span className="hab-lamp-spec" />
            <span className="hab-lamp-spec hab-lamp-spec-low" />
          </span>
        </span>
      </span>
    </button>
  )
}

/** Chart cell for an exempt period when the wand is off: grey, not a completion control. */
export function HabitExemptCell({ label }: { label: string }) {
  return <span className="habit-exempt" role="img" aria-label={label} title={label} />
}
