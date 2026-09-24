/**
 * components/Home/Habits/habit-percent-readout.tsx — Row/column % display
 *
 * Loading Bar on → milled channel (compact 10-pip, or wide fill+ticks).
 * Off → numeric dot-matrix LED. Both sit in the same `.habit-pct` slot so
 * the column and footer cells stay put (22px tall; bar fills the slot).
 */
"use client"

import { PercentLed } from "@/components/Home/Habits/percent-led"
import { PercentLedBar } from "@/components/Home/Habits/percent-led-bar"
import { useHabitsStore } from "@/lib/habits-store"

export function HabitPercentReadout({
  value,
  label,
  density = "compact",
}: {
  /** `null` — nothing was required in this window (every period exempt). */
  value: number | null
  label?: string
  density?: "compact" | "wide"
}) {
  const bar = useHabitsStore((s) => s.percentLoadingBar)
  if (value === null || !Number.isFinite(value)) {
    return (
      <span className="habit-pct habit-pct-vacant" title={label ? `${label}: nothing required` : "Nothing required"}>
        —
      </span>
    )
  }
  return (
    <span className="habit-pct">
      {bar ? (
        <PercentLedBar value={value} label={label} density={density} />
      ) : (
        <PercentLed value={value} label={label} />
      )}
    </span>
  )
}
