/**
 * lib/session-pen.ts — Let go of the Tracking pen clock for sessions put down
 *
 * A painting session that is parked (by hand, from the focus bar, or to make
 * room for another) stops the pen clock when it is on one of its tasks. The
 * time so far is written as on Stop (`stopTaskClock`).
 */
"use client"

import { allLines, type SessionPlan } from "@/lib/session-plan"
import { usePenColorSessionStore } from "@/lib/pen-color-session-store"
import { stopTaskClock } from "@/lib/task-clock"

export function releasePenClock(plans: readonly SessionPlan[]): void {
  const pen = usePenColorSessionStore.getState().session
  if (!pen?.taskId) return
  if (plans.some((p) => p.paint && allLines(p).some(({ line }) => line.taskId === pen.taskId))) stopTaskClock()
}
