/**
 * components/Home/Habits/percent-led-bar.tsx — Glass thermometer
 *
 * Row and column percents share one thin glass tube. The mercury column is
 * the percent itself (the same rounded figure as the label). Tint still comes
 * from the habits store. Numeric LED mode is a different component.
 */
"use client"

import type { CSSProperties } from "react"
import { percentBarLitCount, percentLedText } from "@/lib/habit-led"
import { useHabitsStore } from "@/lib/habits-store"
import "./percent-led-bar.css"

export function PercentLedBar({
  value,
  label,
  density = "compact",
}: {
  value: number
  label?: string
  density?: "compact" | "wide"
}) {
  const tint = useHabitsStore((s) => s.percentLedTint)
  const text = percentLedText(value)
  const now = Math.round(Number.isFinite(value) ? value : 0)
  const fill = Math.min(100, Math.max(0, now))
  const wide = density === "wide"

  return (
    <span
      className={`hab-pled-bar${wide ? " is-wide" : ""}`}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={now}
      aria-label={label ? `${label} ${text}` : text}
      data-lit={percentBarLitCount(value)}
      data-density={density}
      style={{ "--hab-led-tint": tint } as CSSProperties}
    >
      <span className="hab-pled-bar-bezel" aria-hidden="true">
        <span className="hab-pled-bar-glass">
          <span className="hab-pled-bar-mercury" style={{ width: `${fill}%` }} />
        </span>
      </span>
      <span className="hab-pled-bar-read">{text}</span>
    </span>
  )
}
