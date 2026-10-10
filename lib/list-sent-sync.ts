/**
 * lib/list-sent-sync.ts — Push a list's sent ratio into a habit
 *
 * Habits that check **List sent** store the grace-adjusted percent on the
 * current period cell. The ratio is `listSentCompletion` for that period's
 * range. Weekly clear runs first: last week's sent items leave opted-in
 * lists and stay in the vault.
 *
 * Writes go through the period completion setters inside `withoutUndo`.
 * A hand-typed cell keeps its number. Started from `useHabitTrackingSync`.
 */
"use client"

import { useEffect } from "react"
import { isRestoring, withoutUndo } from "@/lib/action-history"
import { formatLocalDateKey, formatLocalMonthKey, getWeekString } from "@/lib/date-utils"
import { habitWriteIsQuiet, useHabitsStore } from "@/lib/habits-store"
import { effectiveHabitCount, listRoutingFromLink } from "@/lib/habit-completion-pipeline"
import {
  applyListLengthCount,
  applyListSentPercent,
  currentPeriodRange,
  listSentCompletion,
  membershipAfterWeeklySentClear,
  reportedListSentPercent,
} from "@/lib/list-sent"
import { quarterKey } from "@/lib/seasons"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "@/lib/start-hydrated-store-sync"
import { useTaskStore } from "@/lib/task-store"
import type { TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"

function listens(task: WeeklyTask): boolean {
  const link = task.listSentLink
  return !!task.completionSources?.includes("listSent") && !!link?.listId && link.enabled !== false
}

function bucketFor(task: WeeklyTask, state: ReturnType<typeof useHabitsStore.getState>): WeeklyData {
  const freq = task.frequency || "daily"
  if (freq === "monthly") return state.monthlyHabitData
  if (freq === "quarterly") return state.quarterlyHabitData
  if (freq === "weekly") return state.weeklyHabitData
  return state.weeklyData
}

function periodKeyFor(task: WeeklyTask, rangeStart: Date): string {
  const freq = task.frequency || "daily"
  if (freq === "weekly") return getWeekString(rangeStart)
  if (freq === "monthly") return formatLocalMonthKey(rangeStart)
  if (freq === "quarterly") return quarterKey(rangeStart)
  return formatLocalDateKey(rangeStart)
}

function writePeriod(task: WeeklyTask, anchor: Date, next: TaskCompletion): void {
  const habits = useHabitsStore.getState()
  const freq = task.frequency || "daily"
  if (freq === "monthly") habits.updateMonthlyHabitCompletion(task.id, anchor, next)
  else if (freq === "quarterly") habits.updateQuarterlyHabitCompletion(task.id, anchor, next)
  else if (freq === "weekly") habits.updateWeeklyHabitCompletion(task.id, anchor, next)
  else habits.updateCompletion(task.id, anchor, next)
}

let syncing = false

export function syncListSentHabits(now = new Date()): void {
  if (syncing) return
  syncing = true
  try {
    withoutUndo(() => {
      const vault = useTaskStore.getState()
      const sentListIds = new Set(vault.lists.filter((list) => list.sentThisWeek === true).map((list) => list.id))
      const cleared = membershipAfterWeeklySentClear(vault.tasks, sentListIds, now)
      if (cleared !== vault.tasks) {
        for (let i = 0; i < cleared.length; i++) {
          if (cleared[i] !== vault.tasks[i]) useTaskStore.getState().updateTask(cleared[i])
        }
      }

      const habits = useHabitsStore.getState()
      const parents = habits.tasks.filter(listens)
      if (!parents.length) return
      const items = useTaskStore.getState().tasks
      for (const parent of parents) {
        const listId = parent.listSentLink?.listId
        if (!listId) continue
        const range = currentPeriodRange(parent.frequency, now)
        const key = periodKeyFor(parent, range.start)
        const previous = bucketFor(parent, useHabitsStore.getState())[key]?.[parent.id]
        const length = listRoutingFromLink(parent.listSentLink).target === "listLength"
        if (length) {
          const measure = effectiveHabitCount(parent, undefined, items, now)
          const raw = measure.target === 0 ? 0 : (measure.current / measure.target) * 100
          const reported = reportedListSentPercent(raw, parent.listSentLink?.grace)
          const next = applyListLengthCount(previous, measure.current, measure.target, reported)
          if (next) writePeriod(parent, range.start, next)
          if ((parent.goal || 0) !== measure.target) {
            useHabitsStore.getState().updateTask({ ...parent, goal: measure.target })
          }
          continue
        }
        const counts = listSentCompletion(items, listId, range)
        const reported = reportedListSentPercent(counts.rawPercent, parent.listSentLink?.grace)
        const next = applyListSentPercent(parent, previous, reported)
        if (!next) continue
        writePeriod(parent, range.start, next)
      }
    })
  } finally {
    syncing = false
  }
}

const listSentSyncSlot: HydratedStoreSyncSlot = { stopper: null }

export function startListSentSync(): () => void {
  return startHydratedStoreSync({
    slot: listSentSyncSlot,
    persists: [useHabitsStore.persist, useTaskStore.persist],
    onReady: () => {
      const unTasks = useTaskStore.subscribe((state, prev) => {
        if (isRestoring()) return
        if (state.tasks !== prev.tasks || state.lists !== prev.lists) syncListSentHabits()
      })
      const unHabits = useHabitsStore.subscribe((state, prev) => {
        if (isRestoring() || habitWriteIsQuiet()) return
        if (state.tasks !== prev.tasks) syncListSentHabits()
      })
      syncListSentHabits()
      return () => {
        unTasks()
        unHabits()
      }
    },
  })
}

export function useListSentSync(): void {
  useEffect(() => {
    startListSentSync()
  }, [])
}
