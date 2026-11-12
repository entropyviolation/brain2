/**
 * lib/plan-bimby/day/history.ts — Your own finished work, as the base for estimates
 *
 * Three places hold how long a thing took: a completed task (`actualDuration`, else its time logs), a block
 * in Tracking's Activity view, and a row finished in an earlier day plan. All three become `PastRun`s for
 * `estimate.ts`. Read only.
 */
"use client"

import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import type { PastRun } from "./estimate"
import { useDayPlanStore } from "./store"

export function pastRuns(): PastRun[] {
  const out: PastRun[] = []
  for (const task of useTaskStore.getState().tasks) {
    if (!task.completed || task.loggedAction) continue
    const title = (task.title || task.description || "").trim()
    const logged = (task.timeLogs ?? []).reduce((n, l) => n + (l.durationMinutes || 0), 0)
    const minutes = task.actualDuration && task.actualDuration > 0 ? task.actualDuration : logged
    if (title && minutes > 0) out.push({ title, minutes: Math.round(minutes), from: "To Do" })
  }
  const tracking = useTimeTrackingStore.getState()
  const pens = tracking.scopes.find((s) => s.id === "activity")?.pens ?? []
  for (const e of tracking.entries) {
    if (e.scopeId !== "activity" || e.kind === "instant" || e.endMin <= e.startMin) continue
    const title = ((e as { title?: string }).title || pens.find((p) => p.id === e.penId)?.name || "").trim()
    if (title) out.push({ title, minutes: e.endMin - e.startMin, from: "Tracking" })
  }
  for (const plan of Object.values(useDayPlanStore.getState().plans)) {
    for (const item of plan.items) if (item.actualMin && item.actualMin > 0 && !item.filedTaskId) out.push({ title: item.title, minutes: item.actualMin, from: "day plan" })
  }
  return out
}
