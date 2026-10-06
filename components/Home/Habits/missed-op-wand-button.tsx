/**
 * components/Home/Habits/missed-op-wand-button.tsx — Missed op wand
 *
 * Sits under Exemption wand. Pressed, an eligible cell toggles “definitely
 * not done.” Complete and exempt cells stay grey and do not take the mark.
 * The control stays metal either way. Turning it on clears the exemption wand.
 */
"use client"

import { WandMark } from "@/components/Home/Habits/exemption-wand-button"

export function MissedOpWandButton({
  on,
  onToggle,
}: {
  on: boolean
  onToggle: (on: boolean) => void
}) {
  return (
    <button
      type="button"
      className={`hab-wand${on ? " is-on" : ""}`}
      aria-pressed={on}
      data-ui-name="Missed op wand"
      data-ui-help="Mark a period definitely not done, without waiving it and without logging it complete."
      data-ui-docs="components/Home/Habits/README.md"
      aria-label={on ? "Missed op wand on" : "Missed op wand"}
      title={
        on
          ? "Missed op wand is on. Click a cell to mark that period definitely not done. Complete and exempt cells stay grey. Click the crossed wand to log habits again."
          : "Missed op wand. Turn it on to mark a period definitely not done."
      }
      onClick={() => onToggle(!on)}
    >
      <WandMark crossed={on} />
      <span>Missed op wand</span>
    </button>
  )
}
