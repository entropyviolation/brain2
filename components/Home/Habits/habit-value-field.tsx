/**
 * components/Home/Habits/habit-value-field.tsx — Habit cell while it is being typed
 *
 * Goal and climb cells used to be controlled by the stored number alone. The
 * browser's number input and `parseFloat("0.") === 0` snapped the field back
 * to "0" before the rest of the value landed, so a completion looked typed
 * and then vanished. While the cell is focused, the characters on screen are
 * the draft; the store still receives each finite number as it becomes one.
 */
"use client"

import type React from "react"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { completionValueFromInput } from "@/lib/incremental-habits"

export function HabitNumberField({
  value,
  onValue,
  className,
  style,
  ariaLabel,
  placeholder,
  plain = false,
}: {
  value: number | undefined
  onValue: (value: number | undefined) => void
  className?: string
  style?: React.CSSProperties
  ariaLabel?: string
  placeholder?: string
  /** Lists rows use a bare `fm-input` instead of the spreadsheet slot. */
  plain?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft !== null ? draft : value === undefined ? "" : String(value)
  const props = {
    type: "text" as const,
    inputMode: "decimal" as const,
    autoComplete: "off" as const,
    value: shown,
    "aria-label": ariaLabel,
    placeholder,
    className,
    style,
    onFocus: () => setDraft(value === undefined ? "" : String(value)),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value
      if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return
      setDraft(raw)
      onValue(completionValueFromInput(raw))
    },
    onBlur: () => setDraft(null),
  }
  if (plain) return <input {...props} />
  return <Input {...props} />
}

export function HabitTextField({
  value,
  onValue,
  className,
  style,
  placeholder,
  plain = false,
}: {
  value: string
  onValue: (value: string) => void
  className?: string
  style?: React.CSSProperties
  placeholder?: string
  plain?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft !== null ? draft : value
  const props = {
    type: "text" as const,
    value: shown,
    placeholder,
    className,
    style,
    onFocus: () => setDraft(value),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setDraft(e.target.value)
      onValue(e.target.value)
    },
    onBlur: () => setDraft(null),
  }
  if (plain) return <input {...props} />
  return <Input {...props} />
}
