/**
 * components/Home/Tracking/entry-dialog/span-lock-button.tsx — Lock start, end, or duration
 *
 * The locked edge stays put. The other two follow each other. No hooks.
 */
"use client"

import { Lock, LockOpen } from "lucide-react"
import type { SpanLock } from "@/lib/time-entries"

export function SpanLockButton({
  edge,
  locked,
  onLock,
}: {
  edge: SpanLock
  locked: boolean
  onLock: () => void
}) {
  const name = edge === "start" ? "Start" : edge === "end" ? "End" : "Duration"
  return (
    <button
      type="button"
      className="trk-span-lock"
      data-no95=""
      aria-pressed={locked}
      aria-label={locked ? `${name} locked` : `Lock ${name}`}
      title={locked ? `${name} stays put when the others change` : `Lock ${name}. The other two follow each other.`}
      onClick={onLock}
    >
      {locked ? <Lock size={12} strokeWidth={2.25} aria-hidden /> : <LockOpen size={12} strokeWidth={2.25} aria-hidden />}
    </button>
  )
}
