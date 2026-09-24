/**
 * components/Home/Tracking/now-time-button.tsx — Stamp a clock with this minute
 *
 * A Win95 latch that appears only while its time field is live (focused or
 * open). Click or Enter sets hours and minutes to now; the dialog keeps its
 * own date. Used by Log activity start / end / discrete-event clocks
 * (`OptionalClock` in `log-activity-dialog.tsx`).
 */
"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { minutesToTimeString } from "@/lib/time-entries"

export function nowTimeString(at = new Date()): string {
  return minutesToTimeString(at.getHours() * 60 + at.getMinutes())
}

export function NowTimeButton({
  label,
  onNow,
}: {
  label: string
  onNow: () => void
}) {
  return (
    <button
      type="button"
      className="trk-now-time"
      aria-label={`Set ${label.toLowerCase()} to right now`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onNow}
    >
      <span className="trk-led" aria-hidden />
      right now
    </button>
  )
}

export function ClockTime({
  id,
  label,
  time,
  onTime,
}: {
  id: string
  label: string
  time: string
  onTime: (value: string) => void
}) {
  const [live, setLive] = useState(false)
  return (
    <div
      className="trk-clock-time"
      onPointerDown={() => setLive(true)}
      onFocusCapture={() => setLive(true)}
      onBlurCapture={(e) => {
        const next = e.relatedTarget as Node | null
        // Native time pickers often blur with no relatedTarget while still selected.
        if (!next) return
        if (e.currentTarget.contains(next)) return
        setLive(false)
      }}
    >
      <Input id={id} type="time" value={time} onChange={(e) => onTime(e.target.value)} />
      {live && <NowTimeButton label={label} onNow={() => onTime(nowTimeString())} />}
    </div>
  )
}
