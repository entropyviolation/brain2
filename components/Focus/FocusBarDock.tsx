/**
 * components/Focus/FocusBarDock.tsx — Always-mounted shell for the focus bar
 *
 * Reads only whether a task is on the pen clock, then loads `FocusBar` (which
 * pulls in the timegrid and the clock hooks). Nothing else is loaded while idle.
 */
"use client"

import { lazy, Suspense } from "react"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"

const FocusBar = lazy(() => import("./FocusBar"))

export function FocusBarDock() {
  const onClock = usePenColorSessionStore((s) => Boolean(s.session?.taskId))
  if (!onClock) return null
  return (
    <Suspense fallback={null}>
      <FocusBar />
    </Suspense>
  )
}
