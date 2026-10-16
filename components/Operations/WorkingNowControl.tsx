/**
 * components/Operations/WorkingNowControl.tsx — Live work toggle
 *
 * The menubar clock on an operation workspace. Idle: **Working on this now**.
 * Live: a phosphor lamp and **Stop working on {name}**. Start/stop are the
 * same helpers Tracking uses, so the grid, Day Log, To Do Done, and tagged
 * habits all see one session.
 *
 * Naming a task (Phase 6): the picker beside the button puts one of the
 * operation's open tasks on the pen clock, exactly like ▶ on its To Do row
 * (`useTaskClockStarter`). The two clocks stay separate stores; naming a task
 * stops this operation's own session first so time is not painted twice.
 */
"use client"

import { useEffect, useState } from "react"
import { useTaskClockStarter } from "@/components/Focus/TaskClockStarter"
import { stopTaskClock } from "@/lib/task-clock"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import {
  formatElapsedClock,
  sessionElapsedMs,
  stopWorkingOnOperation,
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
    const ui = window.setInterval(() => {
      if (document.hidden) return
      setNow(Date.now())
    }, 1000)
    const grid = window.setInterval(() => {
      if (document.hidden) return
      tickWorkSession()
    }, WORK_SESSION_TICK_MS)
    const onVis = () => {
      if (!document.hidden) setNow(Date.now())
    }
    document.addEventListener("visibilitychange", onVis)
    return () => {
      window.clearInterval(ui)
      window.clearInterval(grid)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [session?.operationId, session?.startedAt, session?.pausedAt, session?.pausedAccumMs])

  return { session, now }
}

export function WorkingNowControl({
  operationId,
  operationName,
  tasks = [],
}: {
  operationId: string
  operationName: string
  /** Open tasks in the operation's tree; naming one puts it on the ▶ clock. */
  tasks?: { id: string; name: string }[]
}) {
  const { session, now } = useWorkSessionClock()
  const live = session?.operationId === operationId
  const taskClock = useTaskClockStarter()
  const clockTaskId = usePenColorSessionStore((s) => s.session?.taskId)
  const namedTask = tasks.find((t) => t.id === clockTaskId)
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
      {namedTask ? (
        <button type="button" className="ops-btn ops-btn-now live" onClick={() => stopTaskClock(namedTask.id)}>
          Stop {namedTask.name}
        </button>
      ) : tasks.length > 0 ? (
        <select
          className="ops-btn ops-now-task"
          aria-label="Work on a task in this operation now"
          value=""
          onChange={(e) => {
            const id = e.target.value
            if (!id) return
            if (live) stopWorkingOnOperation()
            taskClock.start(id)
          }}
        >
          <option value="">…or a task</option>
          {tasks.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      ) : null}
      {taskClock.picker}
    </span>
  )
}

export default WorkingNowControl
