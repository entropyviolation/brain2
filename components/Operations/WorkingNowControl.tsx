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
  isSessionPaused,
  pauseWorkingOnOperation,
  resumeWorkingOnOperation,
  sessionElapsedMs,
  stopWorkingOnOperation,
  tickWorkSession,
  toggleWorkingOnOperation,
  WORK_SESSION_TICK_MS,
} from "@/lib/operation-work-session"
import { useWorkSessionStore } from "@/lib/work-session-store"
import { ItemPicker } from "@/components/Lists/item-picker"
import { useUnfinishedStop } from "@/components/Home/Tracking/save-unfinished-dialog"
import { usePauseReason } from "@/components/Home/Tracking/pause-reason-dialog"
import { offerPenDebrief, reviewWorkStop } from "@/lib/session-debrief"
import { activeNowObjectives } from "@/lib/now-objective"

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
  const [taskOpen, setTaskOpen] = useState(false)
  const live = session?.operationId === operationId
  const taskClock = useTaskClockStarter()
  const clockTaskId = usePenColorSessionStore((s) => s.session?.taskId)
  const penObjectives = usePenColorSessionStore((s) => s.session?.nowObjectives)
  const namedTask = tasks.find((t) => t.id === clockTaskId)
  const elapsed =
    live && session ? formatElapsedClock(sessionElapsedMs(session, now)) : null
  const workStop = useUnfinishedStop(live ? activeNowObjectives(session?.nowObjectives).length : 0, (park) =>
    reviewWorkStop(park),
  )
  const pauseAsk = usePauseReason()
  const paused = live && session ? isSessionPaused(session) : false
  const taskStop = useUnfinishedStop(activeNowObjectives(penObjectives).length, (park) => {
    const ended = stopTaskClock(namedTask?.id, new Date(), park ? { parkUnfinished: true } : undefined)
    if (ended) offerPenDebrief(ended)
  })

  return (
    <span className="ops-menubar-now b2-now">
      {live && <span className="ops-now-led live" aria-hidden />}
      {elapsed && (
        <span className="ops-now-elapsed" aria-live="polite">
          {elapsed}
        </span>
      )}
      {live ? (
        <button
          type="button"
          className="todo-cap"
          onClick={() => {
            if (paused) resumeWorkingOnOperation()
            else void pauseAsk.ask().then((reason) => {
              if (reason) pauseWorkingOnOperation(new Date(), reason)
            })
          }}
        >
          {paused ? `Resume ${operationName}` : `Pause ${operationName}`}
        </button>
      ) : null}
      <button
        type="button"
        className={`todo-cap${live ? "" : " is-primary"}`}
        onClick={() => (live ? workStop.request() : toggleWorkingOnOperation(operationId))}
      >
        {live ? `Stop working on ${operationName}` : "Working on this now"}
      </button>
      {namedTask ? (
        <button type="button" className="todo-cap" onClick={() => taskStop.request()}>
          Stop {namedTask.name}
        </button>
      ) : tasks.length > 0 ? (
        <span className="ops-task-pick">
          <button
            type="button"
            className="todo-cap is-mod"
            aria-expanded={taskOpen}
            onClick={() => setTaskOpen((open) => !open)}
          >
            …or a task
          </button>
          {taskOpen ? (
            <span className="ops-task-pick-panel">
              <ItemPicker
                compact
                searchLabel="Work on a task in this operation now"
                choices={tasks.map((task) => ({ id: task.id, title: task.name }))}
                selected={[]}
                mode="single"
                onChange={(ids) => {
                  const id = ids[0]
                  if (!id) return
                  if (live) stopWorkingOnOperation()
                  taskClock.start(id)
                  setTaskOpen(false)
                }}
              />
            </span>
          ) : null}
        </span>
      ) : null}
      {taskClock.picker}
      {workStop.dialog}
      {taskStop.dialog}
      {pauseAsk.dialog}
    </span>
  )
}

export default WorkingNowControl
