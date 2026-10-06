/**
 * lib/habit-connection-sync.ts — Keep sleep and list connections current
 *
 * Started beside tracking sync. A night edit or a finished next action
 * recomputes the boolean cells those habits own. Hand ticks are left alone
 * (`applyAutoFlag`). Writes go through `applyAutoChecks`, which does not push
 * an undo step.
 */
"use client"

import { isRestoring } from "@/lib/action-history"
import { formatLocalDateKey } from "@/lib/date-utils"
import {
  applyAutoFlag,
  doneNextActionCount,
  effectiveListLink,
  effectiveSleepLink,
  sleepEndMeets,
  sleepHabitDayKey,
} from "@/lib/habit-connections"
import { useHabitsStore } from "@/lib/habits-store"
import { useSleepStore } from "@/lib/sleep-store"
import { useTaskStore } from "@/lib/task-store"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "@/lib/start-hydrated-store-sync"
import type { TaskCompletion } from "@/lib/types"

type AutoUpdate = {
  taskId: string
  dateKey: string
  flag: "sleepCompleted" | "listCompleted"
  met: boolean
}

function sleepUpdates(): AutoUpdate[] {
  const habits = useHabitsStore.getState()
  const nights = useSleepStore.getState().nights
  const wanted = new Map<string, boolean>()
  const linked = habits.tasks.filter((task) => effectiveSleepLink(task))

  for (const task of linked) {
    const link = effectiveSleepLink(task)
    if (!link) continue
    for (const [morningKey, night] of Object.entries(nights)) {
      const dayKey = sleepHabitDayKey(morningKey, link.end)
      if (!dayKey) continue
      if (sleepEndMeets(link, night)) wanted.set(`${task.id}|${dayKey}`, true)
    }
  }

  for (const [dateKey, day] of Object.entries(habits.weeklyData)) {
    for (const task of linked) {
      if (!day?.[task.id]?.sleepCompleted) continue
      const id = `${task.id}|${dateKey}`
      if (!wanted.has(id)) wanted.set(id, false)
    }
  }

  const updates: AutoUpdate[] = []
  for (const [id, met] of wanted) {
    const split = id.indexOf("|")
    updates.push({ taskId: id.slice(0, split), dateKey: id.slice(split + 1), flag: "sleepCompleted", met })
  }
  return updates
}

function listUpdates(): AutoUpdate[] {
  const habits = useHabitsStore.getState()
  const { tasks, lists, folders } = useTaskStore.getState()
  const linked = habits.tasks.filter((task) => effectiveListLink(task))
  const days = new Set<string>()
  for (const task of tasks) {
    if (!task.completed || !task.completedDate) continue
    const when = task.completedDate instanceof Date ? task.completedDate : new Date(task.completedDate)
    if (!Number.isNaN(when.getTime())) days.add(formatLocalDateKey(when))
  }
  for (const [dateKey, day] of Object.entries(habits.weeklyData)) {
    if (linked.some((task) => day?.[task.id]?.listCompleted)) days.add(dateKey)
  }

  const updates: AutoUpdate[] = []
  for (const task of linked) {
    const link = effectiveListLink(task)
    if (!link) continue
    for (const dayKey of days) {
      const met = doneNextActionCount(tasks, lists, folders, link.listName, dayKey) >= link.count
      const cell: TaskCompletion | undefined = habits.weeklyData[dayKey]?.[task.id]
      if (!met && !cell?.listCompleted) continue
      updates.push({ taskId: task.id, dateKey: dayKey, flag: "listCompleted", met })
    }
  }
  return updates
}

export function syncHabitConnections(): void {
  const updates = [...sleepUpdates(), ...listUpdates()]
  if (!updates.length) return
  const pending = updates.filter((update) => {
    const cell = useHabitsStore.getState().weeklyData[update.dateKey]?.[update.taskId]
    return applyAutoFlag(cell, update.flag, update.met) != null
  })
  if (pending.length) useHabitsStore.getState().applyAutoChecks(pending)
}

const connectionSyncSlot: HydratedStoreSyncSlot = { stopper: null }

/** Idempotent. Components leave the singleton up; tests can call the stopper. */
export function startHabitConnectionSync(): () => void {
  return startHydratedStoreSync({
    slot: connectionSyncSlot,
    persists: [useHabitsStore.persist, useSleepStore.persist, useTaskStore.persist],
    onReady: () => {
      const unNights = useSleepStore.subscribe((state, prev) => {
        if (isRestoring()) return
        if (state.nights !== prev.nights) syncHabitConnections()
      })
      const unTasks = useTaskStore.subscribe((state, prev) => {
        if (isRestoring()) return
        if (state.tasks !== prev.tasks || state.lists !== prev.lists || state.folders !== prev.folders) {
          syncHabitConnections()
        }
      })
      const unHabits = useHabitsStore.subscribe((state, prev) => {
        if (isRestoring()) return
        if (state.tasks !== prev.tasks) syncHabitConnections()
      })
      syncHabitConnections()
      return () => {
        unNights()
        unTasks()
        unHabits()
      }
    },
  })
}
