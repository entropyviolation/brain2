/**
 * components/Home/Habits/habit-led-lamp.tsx — Skeuomorphic panel lamp
 *
 * Shared Yes/No lamp for Daily / Weekly / Monthly sheets (and any other
 * boolean). **Small LEDs** ON (default): 15px silver-chrome rim + smoked glass
 * + lit die (Tek POWER / gadget-wall). OFF: rectangular consult / TENO / Tek
 * panel window that fills the same cell (`data-fill`) — glass, metal bezel,
 * even glow; not an oval, sphere, or pill. The cell box does not grow or
 * shrink. Click or Space/Enter flips the lamp in that event. The completion
 * write (undo snapshot, grades, points, coverage) waits for the next turn,
 * after that paint. The timer carries only the reconcile — the click already
 * committed the glass. When `saved` changes, the lamp shows the stored
 * `checked` again, including when a reconcile kept the old boolean.
 * Off = dark glass; on = `percentLedTint` (warm/dark mix, not blast-white);
 * partial = dimmer tint. Unavailable = grey plate: the period is exempt,
 * neither done nor still owed.
 */
"use client"

import { useEffect, useRef, useState, type CSSProperties } from "react"
import { booleanLampState, type HabitLampState } from "@/lib/habit-led"
import { useHabitsStore } from "@/lib/habits-store"
import "./habit-led-lamp.css"

/**
 * Paint `checked` on the click. The grade / points / coverage scan waits for
 * the next turn so it is not in the same flush as that paint. `saved` is the
 * stored record's identity; a new one means the write (or an undo) has landed.
 */
function usePaintFirstToggle(
  checked: boolean,
  saved: unknown,
  onCheckedChange: (checked: boolean) => void,
) {
  const [pending, setPending] = useState<boolean | null>(null)
  const [seenSaved, setSeenSaved] = useState(saved)
  const onChangeRef = useRef(onCheckedChange)
  onChangeRef.current = onCheckedChange
  const clickGen = useRef(0)
  const issuedGen = useRef(0)

  if (saved !== seenSaved) {
    setSeenSaved(saved)
    if (pending !== null && issuedGen.current === clickGen.current) {
      clickGen.current = 0
      issuedGen.current = 0
      setPending(null)
    }
  }

  const shown = pending ?? checked

  useEffect(() => {
    if (pending === null) return
    const gen = clickGen.current
    if (issuedGen.current === gen) return
    const timer = window.setTimeout(() => {
      if (issuedGen.current === gen) return
      issuedGen.current = gen
      onChangeRef.current(pending)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [pending])

  const toggle = () => {
    clickGen.current += 1
    setPending(!shown)
  }

  return { shown, toggle }
}

export function HabitLedLamp({
  checked,
  onCheckedChange,
  label,
  tracked = false,
  ratio,
  tint,
  unavailable = false,
  unavailableFollowsCheck = false,
  saved,
  readOnly = false,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: string
  tracked?: boolean
  ratio?: number
  tint?: string
  /** Exempt period: grey plate, not the completion light and not the dark “still owed” glass. */
  unavailable?: boolean
  /** Exemption wand: the grey plate tracks the optimistic check, same as the click. */
  unavailableFollowsCheck?: boolean
  /** Identity of the saved cell or exemption. A new value drops the optimistic check. */
  saved?: unknown
  /** Show the stored check. Click does not write. */
  readOnly?: boolean
}) {
  const storedTint = useHabitsStore((s) => s.percentLedTint)
  const smallLeds = useHabitsStore((s) => s.habitSmallLeds)
  const { shown, toggle } = usePaintFirstToggle(checked, saved, onCheckedChange)
  const state: HabitLampState = booleanLampState(readOnly ? checked : shown, ratio)
  const color = tint || storedTint
  const paintUnavailable = unavailableFollowsCheck ? (readOnly ? checked : shown) : unavailable
  const glass = (
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
  )

  if (readOnly) {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        data-state={paintUnavailable ? "unavailable" : state}
        data-tracked={tracked ? "true" : undefined}
        data-fill={smallLeds ? undefined : "true"}
        data-no95=""
        className="hab-lamp"
        style={{ "--hab-lamp-tint": color } as CSSProperties}
      >
        {glass}
      </span>
    )
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={shown}
      aria-label={label}
      title={label}
      data-state={paintUnavailable ? "unavailable" : state}
      data-tracked={tracked ? "true" : undefined}
      data-fill={smallLeds ? undefined : "true"}
      data-no95=""
      className="hab-lamp"
      style={{ "--hab-lamp-tint": color } as CSSProperties}
      onClick={toggle}
    >
      {glass}
    </button>
  )
}

/** Chart cell for an exempt period when the wand is off: grey, not a completion control. */
export function HabitExemptCell({ label }: { label: string }) {
  return <span className="habit-exempt" role="img" aria-label={label} title={label} />
}
