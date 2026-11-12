/**
 * lib/plan-bimby/day/track.ts — What happened, written back when a day plan's run row is finished
 *
 * Called by the run store (`../store.ts`) when a row becomes done, and by chat ("done dye hair"). If the row
 * belongs to a day plan: the item keeps its real minutes (the next estimate reads them), the follow-through ledger gets the action
 * and the step's verdict, and the To Do task the plan filed is completed with that time. A row from a
 * plain "right now" plan is not touched. This file must not import the run store.
 */
"use client"

import { hashId, type Action } from "@/lib/follow-through/types"
import { useFollowStore } from "@/lib/follow-through/store"
import { completeTask } from "@/lib/services/completion-service"
import { useTaskStore } from "@/lib/task-store"
import type { Run, RunItem } from "../types"
import { useDayPlanStore } from "./store"
import type { DayItem, DayPlan } from "./types"

const pad = (n: number) => String(n).padStart(2, "0")
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

/**
 * One item of a day plan is finished: keep its real minutes, write the action and the step's verdict to the
 * ledger, and complete the task the plan filed. Returns the sentence to show, or null when it was already done.
 */
export function finishDayItem(plan: DayPlan, item: DayItem, accumMs: number, doneAt: Date): string | null {
  if (item.doneAt) return null
  const minutes = Math.round(accumMs / 60_000)
  useDayPlanStore.getState().patchItem(plan.id, item.id, { doneAt: doneAt.toISOString(), ...(minutes > 0 ? { actualMin: minutes } : {}) })

  if (item.stepId) {
    const start = new Date(doneAt.getTime() - accumMs)
    const day = dayKey(doneAt)
    const action: Action = {
      id: hashId("ac", day, `${pad(start.getHours())}:${pad(start.getMinutes())}`, item.title.toLowerCase()),
      day,
      at: start.toISOString(),
      ...(minutes > 0 ? { end: doneAt.toISOString() } : {}),
      what: item.title,
      kind: "activity",
      said: `${item.title} (finished from the day plan)`,
      stepId: item.stepId,
      source: "chat",
      asked: [],
    }
    useFollowStore.getState().take({ intentions: [], actions: [action], feelings: [] }, doneAt)
    const delayMin = Math.max(0, Math.round((start.getTime() - new Date(plan.at).getTime()) / 60_000))
    // You said it is done, so the link is yours, not a proposal.
    useFollowStore.getState().setStep(item.stepId, { verdict: "done", standing: "confirmed", actionId: action.id, delayMin })
  }

  const task = item.filedTaskId ? useTaskStore.getState().tasks.find((t) => t.id === item.filedTaskId) : undefined
  if (task && !task.completed) completeTask(task.id, minutes > 0 ? { actualDuration: minutes } : {})
  const planned = item.estimate.minutes
  return minutes > 0 ? `Took ${minutes} min (planned ${planned}).${task ? " Checked off To Do." : ""}` : task ? "Checked off To Do." : "Marked done."
}

/** Called by the run store when a row becomes done. Null when the row is not a day plan's. */
export function noteRunItemDone(done: RunItem, run: Run, now = new Date()): string | null {
  const plan = Object.values(useDayPlanStore.getState().plans).find((p) => p.runId === run.id)
  const item = plan?.items.find((i) => i.id === done.id)
  if (!plan || !item) return null
  return finishDayItem(plan, item, done.accumMs, new Date(done.doneAt ?? now))
}
