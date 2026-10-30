/**
 * lib/session-pen.ts — The Tracking pen clock and a painting session, in step
 *
 * A painting session (`plan.paint`) puts its current task on the pen clock.
 * The two clocks are linked (2026-10-22): pausing or resuming either one does
 * the same to the other, parking the session pauses the pen (so the focus bar
 * stays), and stopping the pen lets go of the session's line. Ending the
 * session or ■ on its line stops the pen; the time so far is written as on
 * Stop (`stopTaskClock`).
 */
"use client"

import { allLines, pauseSession, resumeSession, stopLine, type SessionPlan } from "@/lib/session-plan"
import { useSessionPlanStore } from "@/lib/session-plan-store"
import { usePenColorSessionStore, type PenColorSession } from "@/lib/pen-color-session-store"
import { pausePenColorSession, resumePenColorSession } from "@/lib/pen-color-session"
import { takeQueuedPauseReason } from "@/lib/work-pause"
import { stopTaskClock } from "@/lib/task-clock"

function paintsPen(plan: SessionPlan | undefined, pen: PenColorSession | null | undefined): plan is SessionPlan {
  return !!plan?.paint && !!pen?.taskId && allLines(plan).some(({ line }) => line.taskId === pen.taskId)
}

/** Stop the pen clock when it is on a task of one of these painting sessions. */
export function releasePenClock(plans: readonly SessionPlan[]): void {
  const pen = usePenColorSessionStore.getState().session
  if (plans.some((p) => paintsPen(p, pen))) stopTaskClock()
}

const ticking = (plan: SessionPlan | undefined) => plan?.phase === "run" && !!plan.clock?.running

/** True when pausing this plan will also pause the pen clock it is painting. */
export function linkedPenIsRunning(plan: SessionPlan): boolean {
  const pen = usePenColorSessionStore.getState().session
  return paintsPen(plan, pen) && ticking(plan) && !pen?.pausedAt
}

let unlink: (() => void) | null = null

/** Start the two-way link once (the always-mounted focus bar dock calls it). Returns the unlink. */
export function linkSessionAndPen(): () => void {
  if (unlink) return unlink
  let syncing = false
  const sync = (fn: () => void) => {
    if (syncing) return
    syncing = true
    try {
      fn()
    } finally {
      syncing = false
    }
  }

  // Pen → session: the focus bar's pause, resume and stop drive the session.
  const offPen = usePenColorSessionStore.subscribe((state, prev) =>
    sync(() => {
      const was = prev.session
      const pen = state.session
      const plan = useSessionPlanStore.getState().open.find((p) => p.phase === "run" && paintsPen(p, was))
      if (!plan || !was) return
      const now = new Date()
      const put = (next: SessionPlan) => useSessionPlanStore.getState().put(next, now)
      const current = allLines(plan).find(({ line }) => line.id === plan.activeLineId)?.line
      if (!pen || pen.taskId !== was.taskId) {
        if (current?.taskId === was.taskId) put(stopLine(plan, now))
      } else if (pen.pausedAt && !was.pausedAt) put(pauseSession(plan, now))
      else if (!pen.pausedAt && was.pausedAt) put(resumeSession(plan, now))
    }),
  )

  // Session → pen: pause, park and resume anywhere (popup, focus bar, header) drive the pen.
  const offSession = useSessionPlanStore.subscribe((state, prev) =>
    sync(() => {
      const pen = usePenColorSessionStore.getState().session
      for (const plan of state.open) {
        if (!paintsPen(plan, pen)) continue
        const before = prev.open.find((p) => p.id === plan.id)
        if (!before) continue
        if (ticking(before) && !ticking(plan) && !pen?.pausedAt) {
          const reason = takeQueuedPauseReason()
          if (reason) pausePenColorSession(new Date(), reason)
          else pausePenColorSession(new Date(), { hold: true })
        }
        else if (!ticking(before) && ticking(plan) && pen?.pausedAt) resumePenColorSession()
      }
    }),
  )

  unlink = () => {
    offPen()
    offSession()
    unlink = null
  }
  return unlink
}
