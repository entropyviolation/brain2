/**
 * components/Home/Habits/cockpit-switch.tsx — Analog rocker for Habits
 *
 * A beveled cockpit throw with engraved ON/OFF and a jewel lamp.
 * Replaces iOS/shadcn pills on this surface. Keyboard: native button
 * (Space / Enter). role="switch".
 */
"use client"

import type { ReactNode } from "react"
import "./cockpit-switch.css"

export function CockpitSwitch({
  id,
  checked,
  onCheckedChange,
  label,
  className,
}: {
  id?: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  label: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      id={id}
      role="switch"
      aria-checked={checked}
      className={`hab-rocker${className ? ` ${className}` : ""}`}
      onClick={() => onCheckedChange(!checked)}
    >
      <span className="hab-rocker-plate" aria-hidden="true">
        <span className="hab-rocker-throw" />
        <span className="hab-rocker-jewel" />
      </span>
      <span className="hab-rocker-caption">{label}</span>
    </button>
  )
}
