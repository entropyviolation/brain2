/**
 * components/Home/Tracking/now-time-button.tsx — A labeled clock in a dialog
 *
 * Log activity start / end / discrete-event clocks, and the same field in the
 * block editor. The clock is `ClockPicker`. Now lives inside that picker's
 * popup. This row does not add a second button beside it.
 */
"use client"

import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
import { minutesToTimeString } from "@/lib/time-entries"

export function nowTimeString(at = new Date()): string {
  return minutesToTimeString(at.getHours() * 60 + at.getMinutes())
}

export function ClockTime({
  id,
  time,
  onTime,
}: {
  id: string
  /** Kept so existing call sites still name the field. Now is inside the clock. */
  label?: string
  time: string
  onTime: (value: string) => void
}) {
  return (
    <div className="trk-clock-time">
      <ClockPicker id={id} value={time} onChange={onTime} />
    </div>
  )
}
