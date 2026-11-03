/**
 * components/Home/Habits/period/period-picker.tsx — Double-click date jump
 *
 * Double-clicking a Habits nameplate opens the native date picker. The picked
 * day goes to `onPick`. Week, month, and season callers snap it to their own
 * period. The input is visually hidden and never takes a tab stop.
 */
"use client"

import { useRef, type ReactNode } from "react"
import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"

export function usePeriodPicker(value: Date, onPick: ((date: Date) => void) | undefined): {
  open: () => void
  input: ReactNode
} {
  const ref = useRef<HTMLInputElement>(null)
  const open = () => {
    const el = ref.current
    if (!el || !onPick) return
    el.value = formatLocalDateKey(value)
    try {
      el.showPicker()
    } catch {
      el.focus()
      el.click()
    }
  }
  const input = onPick ? (
    <input
      ref={ref}
      type="date"
      className="sr-only"
      tabIndex={-1}
      aria-hidden="true"
      defaultValue={formatLocalDateKey(value)}
      onChange={(event) => {
        const date = parseLocalDate(event.target.value)
        if (date) onPick(date)
      }}
    />
  ) : null
  return { open, input }
}
