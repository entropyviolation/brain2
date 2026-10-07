/**
 * components/Home/Tracking/now-time-button.tsx — Stamp a clock with this minute
 *
 * A Win95 latch that appears only while its clock is live (focused or the
 * shared picker is open). Click or Enter sets hours and minutes to now; the
 * dialog keeps its own date. Used by Log activity start / end / discrete-event
 * clocks (`OptionalClock` in `log-activity-dialog.tsx`). The clock itself is
 * `ClockPicker` — not the platform time popup.
 */
"use client"

import { useRef, useState } from "react"
import { ClockPicker } from "@/components/ui/clock-picker/clock-picker"
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
  const openRef = useRef(false)
  return (
    <div
      className="trk-clock-time"
      onPointerDown={() => setLive(true)}
      onFocusCapture={() => setLive(true)}
      onBlurCapture={(e) => {
        if (openRef.current) return
        const next = e.relatedTarget as Node | null
        if (!next) return
        if (e.currentTarget.contains(next)) return
        setLive(false)
      }}
    >
      <ClockPicker
        id={id}
        value={time}
        onChange={onTime}
        onOpenChange={(open) => {
          openRef.current = open
          if (open) setLive(true)
        }}
      />
      {live && <NowTimeButton label={label} onNow={() => onTime(nowTimeString())} />}
    </div>
  )
}
