/**
 * components/Home/Habits/percent-led-bar.tsx — Quiet loading channel
 *
 * Compact (week / row %): 10 via-dots, 10% each. Wide (Day View daily
 * footer): percent-true fill plus 10% ticks that span the stretched slot.
 * Milled metal trough (Tek POWER / TENO / FR4), not a toy EQ and not the
 * circular Yes/No cell lamp. Displayed % math is unchanged.
 */
"use client"

import type { CSSProperties } from "react"
import { percentBarLitCount, percentLedText } from "@/lib/habit-led"
import { useHabitsStore } from "@/lib/habits-store"
import "./percent-led-bar.css"

const LAMPS = 10
const TICKS = 9

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
  const lit = percentBarLitCount(value)
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
      data-lit={lit}
      data-density={density}
      style={{ "--hab-led-tint": tint } as CSSProperties}
    >
      <span className="hab-pled-bar-bezel" aria-hidden="true">
        <span className="hab-pled-bar-well">
          {wide ? (
            <>
              <span className="hab-pled-bar-fill" style={{ width: `${fill}%` }} />
              <span className="hab-pled-bar-ticks">
                {Array.from({ length: TICKS }, (_, i) => (
                  <span
                    key={i}
                    className="hab-pled-bar-tick"
                    style={{ left: `${(i + 1) * 10}%` }}
                  />
                ))}
              </span>
            </>
          ) : (
            Array.from({ length: LAMPS }, (_, i) => (
              <span key={i} className={`hab-pled-bar-lamp${i < lit ? " is-on" : ""}`} />
            ))
          )}
        </span>
      </span>
      <span className="hab-pled-bar-read">{text}</span>
    </span>
  )
}
