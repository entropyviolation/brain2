/**
 * components/Home/Plan/plan-gem-mode-toggle.tsx — Gem and trinket mode latch
 *
 * Compact Plan toolbar control. Sits in `#plan-chrome-toggles` beside Dark.
 * Does not own dark-mode CSS. Default off. Visible label flips with the latch:
 * off = "Gem and trinket", on = "no gem no trinket".
 */
"use client"

import "./plan-gem-mode.css"

const GEM_OFF_LABEL = "Gem and trinket"
const GEM_ON_LABEL = "no gem no trinket"

export function PlanGemModeToggle({
  on,
  onChange,
}: {
  on: boolean
  onChange: (on: boolean) => void
}) {
  const label = on ? GEM_ON_LABEL : GEM_OFF_LABEL
  return (
    <button
      type="button"
      id="plan-gem-mode"
      className="plan-mode-toggle"
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
