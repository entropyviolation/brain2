/**
 * components/header-now-box.tsx — Header "now" well for live work timers
 *
 * Always mounted from AppHeader. While both sessions are idle this module
 * reads only the session flags (`useWorkSessionStore`, `usePenColorSessionStore`)
 * and returns null. It does not import the timegrid. A live Operations or
 * pen-color session loads `header-now-rows.tsx` for the clocks, pause, stop,
 * and pen color. A refresh should not JSON.parse the timegrid blob before
 * the desk paints.
 *
 * Sessions (slice H2): a running or parked To Do session shows a small
 * **Session** chip that opens it, and the box hosts `SessionDock`, loaded
 * only once `lib/session-open-store.ts` holds a request.
 */
"use client"

import { lazy, Suspense, useEffect, useState, type ComponentType } from "react"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { openSession, useSessionOpenStore } from "@/lib/session-open-store"
import { useSessionPlanStore } from "@/lib/session-plan-store"

const SessionDock = lazy(() => import("@/components/Home/ToDo/SessionDock"))

/** "Session" while one runs or is in review; parked ones live on the To do shelves, not here. */
function SessionChip() {
  const running = useSessionPlanStore((s) => s.open.some((p) => p.phase === "run" || p.phase === "review"))
  if (!running) return null
  return (
    <button
      type="button"
      className="b2-shell-now-row b2-now-session-chip"
      title="Open the running session"
      onClick={() => openSession({ startOn: "session" })}
    >
      Session
    </button>
  )
}

function SessionHost() {
  const asked = useSessionOpenStore((s) => s.request != null)
  if (!asked) return null
  return (
    <Suspense fallback={null}>
      <SessionDock />
    </Suspense>
  )
}

export function HeaderNowBox() {
  const workLive = useWorkSessionStore((s) => s.session != null)
  const penLive = usePenColorSessionStore((s) => s.session != null)
  const live = workLive || penLive
  const [Rows, setRows] = useState<ComponentType | null>(null)

  useEffect(() => {
    if (!live || Rows) return
    let cancelled = false
    void import("./header-now-rows").then((mod) => {
      if (!cancelled) setRows(() => mod.HeaderNowRows)
    })
    return () => {
      cancelled = true
    }
  }, [live, Rows])

  return (
    <>
      <SessionChip />
      {live && Rows ? <Rows /> : null}
      <SessionHost />
    </>
  )
}

export default HeaderNowBox
