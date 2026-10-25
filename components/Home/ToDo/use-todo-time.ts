"use client"

/**
 * use-todo-time.ts — Time spent and your pace for To Do (Phase 6, slice L)
 *
 * One hook so the ledger, the lid and Sessions read the same numbers:
 * `spentOf` (task total, cached per render of the store: the actual rollup,
 * each minute once), `timeOf` (what the open lid shows),
 * `settle` (on a tick, `actualDuration` takes spent when larger) and `pace`
 * (your own pace, `lib/estimate-pace.ts`).
 */
import { useCallback, useMemo } from "react"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { useSessionPlanStore } from "@/lib/session-plan-store"
import { findPen, settleSpentOnFinish, taskActualAccount, taskActualReport, trackedTimeForItem } from "@/lib/tracked-time"
import { paceFor, paceForTask, paceSamples } from "@/lib/estimate-pace"
import type { Subtask, Task } from "@/lib/types"
import { useTodoPrefs } from "./todo-prefs"
import type { TodoTimeInfo } from "./TodoBreakdown"

export function useTodoTime(tasks: readonly Task[]) {
  const entries = useTimeTrackingStore((s) => s.entries)
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const history = useSessionPlanStore((s) => s.history)
  const { paceOverrides, paceGhosts } = useTodoPrefs()

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const samples = useMemo(() => paceSamples(tasks, history), [tasks, history])
  const pace = useMemo(() => paceFor(samples, { kind: "overall" }, paceOverrides), [samples, paceOverrides])

  // Spent is computed lazily per task and kept until tasks or blocks change.
  const spentCache = useMemo(() => {
    void entries
    void byId
    return new Map<string, number>()
  }, [entries, byId])

  const spentOf = useCallback(
    (taskId: string) => {
      const hit = spentCache.get(taskId)
      if (hit !== undefined) return hit
      const task = byId.get(taskId)
      const spent = task ? taskActualAccount(task, entries).total : 0
      spentCache.set(taskId, spent)
      return spent
    },
    [spentCache, byId, entries],
  )

  const timeOf = useCallback(
    (taskId: string): TodoTimeInfo | undefined => {
      const task = byId.get(taskId)
      if (!task) return undefined
      const link = task.penLinks?.[0]
      const pen = link ? findPen(scopes, link.penId) : undefined
      const report = taskActualReport(task, entries)
      const stepSpent = new Map<string, number>()
      for (const [id, account] of report.steps) {
        if (account.total > 0) stepSpent.set(id, account.total)
      }
      return {
        spent: report.task.total,
        penPool: link ? trackedTimeForItem(task, entries, { penScope: "tagged" }).penPoolMinutes : 0,
        stepSpent,
        account: report.task,
        stepAccounts: report.steps,
        segments: report.segments,
        pace: paceForTask(task, samples, paceOverrides),
        ghosts: paceGhosts,
        pen: pen ? { name: pen.name, color: pen.color } : undefined,
      }
    },
    [byId, scopes, spentOf, entries, samples, paceOverrides, paceGhosts],
  )

  const settle = useCallback(
    (task: Task, steps: Subtask[]) => settleSpentOnFinish(task, steps, entries),
    [entries],
  )

  return { spentOf, timeOf, settle, samples, pace, paceOverrides, paceGhosts, scopes }
}
