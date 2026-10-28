/**
 * components/Home/ToDo/step-clock-elapsed.tsx — The running time of one step timer.
 *
 * The header clock stays the task sitting. This is the step's own elapsed,
 * from the second its play was pressed, with the sitting's pauses taken out.
 */
"use client"

import { useEffect, useState } from "react"
import { formatElapsedClock } from "@/lib/operation-work-session"
import { subclockActiveMs } from "@/lib/pen-color-session"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"

export function StepClockElapsed({ startedAt }: { startedAt: string }) {
  const session = usePenColorSessionStore((s) => s.session)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  if (!session) return null
  return (
    <span className="subclock-elapsed">
      {formatElapsedClock(subclockActiveMs(session, startedAt, now))}
    </span>
  )
}
