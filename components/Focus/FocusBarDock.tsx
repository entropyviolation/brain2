/**
 * components/Focus/FocusBarDock.tsx — Always-mounted shell for the focus bar
 *
 * Reads only whether a task is on the pen clock, then loads `FocusBar` (which
 * pulls in the timegrid and the clock hooks). Nothing else is loaded while idle.
 */
"use client"

import { lazy, Suspense, useEffect } from "react"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { linkSessionAndPen } from "@/lib/session-pen"

const FocusBar = lazy(() => import("./focus-bar/FocusBar"))

export function FocusBarDock() {
  // A painting session and the pen clock pause, resume and stop together.
  // Linked for the life of the app, not just this mount.
  useEffect(() => {
    linkSessionAndPen()
  }, [])
  const onClock = usePenColorSessionStore((s) => Boolean(s.session?.taskId))
  if (!onClock) return null
  return (
    <Suspense fallback={null}>
      <FocusBar />
    </Suspense>
  )
}
