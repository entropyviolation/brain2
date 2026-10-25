/**
 * components/header-now-box.tsx — Header "now" well for live work timers
 *
 * Always mounted from AppHeader. While both sessions are idle this module
 * reads only the session flags (`useWorkSessionStore`, `usePenColorSessionStore`)
 * and returns null. It does not import the timegrid. A live Operations or
 * pen-color session loads `header-now-rows.tsx` for the clocks, pause, stop,
 * and pen color. A refresh should not JSON.parse the timegrid blob before
 * the desk paints. The pen clock's paint lives here, and only while that
 * clock is actually on screen. If it is not, the sitting ends: the block
 * gets an end, and the task and step stay open.
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

/** True when the header clock is in the document and not collapsed off screen. */
export function headerPenClockOnScreen(): boolean {
  if (typeof document === "undefined") return false
  const el = document.querySelector('[data-testid="header-now-box"]')
  if (!(el instanceof HTMLElement)) return false
  const r = el.getBoundingClientRect()
  // jsdom, and a node that has not been laid out, reports an all-zero box.
  if (r.width === 0 && r.height === 0 && r.top === 0 && r.left === 0) return true
  if (r.width < 8 || r.height < 8) return false
  const vw = window.innerWidth
  const vh = window.innerHeight
  if (!vw || !vh) return true
  return r.bottom > 0 && r.right > 0 && r.top < vh && r.left < vw
}

export function HeaderNowBox() {
  const workLive = useWorkSessionStore((s) => s.session != null)
  const penLive = usePenColorSessionStore((s) => s.session != null)
  const live = workLive || penLive
  const [Rows, setRows] = useState<ComponentType | null>(null)

  useEffect(() => {
    if (!penLive) return
    let dispose: (() => void) | undefined
    let cancel = false
    void import("@/lib/pen-color-session").then((mod) => {
      if (cancel) return
      dispose = mod.watchPenClockShown(headerPenClockOnScreen)
    })
    return () => {
      cancel = true
      dispose?.()
    }
  }, [penLive])

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
