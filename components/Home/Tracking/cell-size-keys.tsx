/**
 * components/Home/Tracking/cell-size-keys.tsx — Minute cell-size keys
 *
 * The Cell well on Time Grid. Exclusive 1m / 5m / … keys. The active step is
 * inset, navy, and phosphor-capped so a glance at the buttons is enough.
 */
"use client"

import "./tracking-chrome.css"

export function CellSizeKeys<T extends number>({
  steps,
  value,
  onChange,
  ariaLabel = "Cell size",
}: {
  steps: readonly T[]
  value: T
  onChange: (step: T) => void
  ariaLabel?: string
}) {
  return (
    <div className="trk-module" style={{ width: "fit-content", marginBottom: 6 }}>
      <span className="trk-silk">Cell</span>
      <div className="trk-module-keys" role="group" aria-label={ariaLabel}>
        {steps.map((step) => {
          const on = value === step
          return (
            <button
              key={step}
              type="button"
              className={on ? "trk-cell-size-btn trk-cell-size-btn-on" : "trk-cell-size-btn"}
              aria-pressed={on}
              title="Rendering only — stored time stays minute-accurate"
              onClick={() => onChange(step)}
            >
              {step}m
            </button>
          )
        })}
      </div>
    </div>
  )
}
