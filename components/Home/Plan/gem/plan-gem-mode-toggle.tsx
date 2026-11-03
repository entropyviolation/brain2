/**
 * components/Home/Plan/gem/plan-gem-mode-toggle.tsx — Gem and trinket mode latch
 *
 * Compact Plan toolbar control. Sits in `#plan-chrome-toggles` beside Dark.
 * Does not own dark-mode CSS. Default off. Visible label flips with the latch:
 * off = "Gem and trinket", on = "no gem no trinket". `keycap` is the phone
 * Plan latch (pale silver key, CRT when on). Desktop leaves it off.
 */
"use client"

import "./plan-gem-mode.css"

const GEM_OFF_LABEL = "Gem and trinket"
const GEM_ON_LABEL = "no gem no trinket"

export function PlanGemModeToggle({
  on,
  onChange,
  keycap = false,
}: {
  on: boolean
  onChange: (on: boolean) => void
  /** Phone Plan paints this latch as a pale silver keycap. Desktop stays the mill key. */
  keycap?: boolean
}) {
  const label = on ? GEM_ON_LABEL : GEM_OFF_LABEL
  return (
    <button
      type="button"
      id="plan-gem-mode"
      className={keycap ? "plan-mode-toggle plan-phone-key" : "plan-mode-toggle"}
      data-no95={keycap ? "" : undefined}
      aria-pressed={on}
      aria-label={label}
      title={
        on
          ? "no gem no trinket — restore chip listing on past days"
          : "Gem and trinket — past days show completed work as gems and orbs"
      }
      onClick={() => onChange(!on)}
    >
      {label}
    </button>
  )
}
