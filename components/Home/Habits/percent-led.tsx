/**
 * components/Home/Habits/percent-led.tsx — Dot-matrix percent readout
 *
 * Photoreal 5×7 LED module for row and column totals. Value is the same
 * rounded percentage the old pastel bars showed.
 */
"use client"

import type { CSSProperties } from "react"
import { percentLedText } from "@/lib/habit-led"
import { useHabitsStore } from "@/lib/habits-store"
import "./percent-led.css"

/** 5-wide × 7-tall bit rows (MSB = left). */
const GLYPHS: Record<string, number[]> = {
  "0": [0b01110, 0b10001, 0b10011, 0b10101, 0b11001, 0b10001, 0b01110],
  "1": [0b00100, 0b01100, 0b00100, 0b00100, 0b00100, 0b00100, 0b01110],
  "2": [0b01110, 0b10001, 0b00001, 0b00010, 0b00100, 0b01000, 0b11111],
  "3": [0b01110, 0b10001, 0b00001, 0b00110, 0b00001, 0b10001, 0b01110],
  "4": [0b00010, 0b00110, 0b01010, 0b10010, 0b11111, 0b00010, 0b00010],
  "5": [0b11111, 0b10000, 0b11110, 0b00001, 0b00001, 0b10001, 0b01110],
  "6": [0b01110, 0b10000, 0b11110, 0b10001, 0b10001, 0b10001, 0b01110],
  "7": [0b11111, 0b00001, 0b00010, 0b00100, 0b01000, 0b01000, 0b01000],
  "8": [0b01110, 0b10001, 0b10001, 0b01110, 0b10001, 0b10001, 0b01110],
  "9": [0b01110, 0b10001, 0b10001, 0b01111, 0b00001, 0b00001, 0b01110],
  "%": [0b11001, 0b11010, 0b00010, 0b00100, 0b01000, 0b01011, 0b10011],
  " ": [0, 0, 0, 0, 0, 0, 0],
}

function Glyph({ ch }: { ch: string }) {
  const rows = GLYPHS[ch] ?? GLYPHS[" "]
  return (
    <span className="hab-pled-glyph" aria-hidden="true">
      {rows.flatMap((row, y) =>
        Array.from({ length: 5 }, (_, x) => {
          const on = (row & (1 << (4 - x))) !== 0
          return <span key={`${y}-${x}`} className={on ? "is-on" : undefined} />
        }),
      )}
    </span>
  )
}

export function PercentLed({
  value,
  label,
}: {
  value: number
  label?: string
}) {
  const tint = useHabitsStore((s) => s.percentLedTint)
  const text = percentLedText(value)
  const padded = text.length >= 4 ? text : text.padStart(4, " ")

  return (
    <span
      className="hab-pled"
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(Number.isFinite(value) ? value : 0)}
      aria-label={label ? `${label} ${text}` : text}
      style={{ "--hab-led-tint": tint } as CSSProperties}
    >
      <span className="hab-pled-face">
        {Array.from(padded, (ch, i) => (
          <Glyph key={`${ch}-${i}`} ch={ch} />
        ))}
      </span>
    </span>
  )
}
