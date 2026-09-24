/**
 * components/Operations/WorkingNowControl.tsx — Live work toggle
 *
 * The menubar clock on an operation workspace. Idle: **Working on this now**.
 * Live: a phosphor lamp and **Stop working on {name}**. Start/stop are the
 * same helpers Tracking uses, so the grid, Day Log, To Do Done, and tagged
 * habits all see one session.
 */
"use client"

import { useEffect, useState } from "react"
import {
  formatElapsedClock,
  sessionElapsedMs,
  tickWorkSession,
  toggleWorkingOnOperation,
  WORK_SESSION_TICK_MS,
} from "@/lib/operation-work-session"
import { useWorkSessionStore } from "@/lib/work-session-store"

export function useWorkSessionClock() {
  const session = useWorkSessionStore((s) => s.session)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!session) return
    tickWorkSession()
    const ui = window.setInterval(() => setNow(Date.now()), 1000)
    const grid = window.setInterval(() => tickWorkSession(), WORK_SESSION_TICK_MS)
    return () => {
      window.clearInterval(ui)
      window.clearInterval(grid)
    }
  }, [session?.operationId, session?.startedAt, session?.pausedAt, session?.pausedAccumMs])

  return { session, now }
}

export function WorkingNowControl({
  operationId,
  operationName,
}: {
  operationId: string
  operationName: string
}) {
  const { session, now } = useWorkSessionClock()
  const live = session?.operationId === operationId
  const elapsed =
    live && session ? formatElapsedClock(sessionElapsedMs(session, now)) : null

  return (
    <span className="ops-menubar-now">
      {live && <span className="ops-now-led live" aria-hidden />}
      {elapsed && (
        <span className="ops-now-elapsed" aria-live="polite">
          {elapsed}
        </span>
      )}
      <button
        type="button"
        className={`ops-btn ops-btn-now${live ? " live" : ""}`}
        onClick={() => toggleWorkingOnOperation(operationId)}
      >
        {live ? `Stop working on ${operationName}` : "Working on this now"}
      </button>
    </span>
  )
}

export default WorkingNowControl
