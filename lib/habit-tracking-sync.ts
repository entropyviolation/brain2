/**
 * lib/habit-tracking-sync.ts — Push tagged time into linked habits
 *
 * The bridge between `lib/time-tracking-store.ts` (pens, tags, tracked intervals)
 * and `lib/habits-store.ts` (habits). Paint 25 minutes with a pen tagged
 * "Cleaning" and every Goal / Yes-No habit linked to that tag picks the minutes
 * up for that day — or, for weekly/monthly/season habits, the sum across the
 * week, month, or quarter — with no manual entry.
 *
 * This module imports both stores. `lib/habit-coverage-sync.ts` also imports
 * the habits store and the time-tracking store. The math is pure in
 * `lib/tracked-time.ts` and `lib/habit-tracking.ts`, so neither store depends on
 * the other.
 *
 * The subscription is a process-wide singleton started by `useHabitTrackingSync`,
 * which both `TimeGrid` and the Habits tab mount. Painting recomputes only the
 * days that changed; editing a pen's tags or a scope re-checks every day that has
 * data, since any of them may now match differently.
 *
 * The same mount also starts the tagged-task count sync. That source counts
 * Done tasks. This file still only pushes painted minutes.
 */
"use client"

import { useEffect } from "react"
import { isRestoring } from "@/lib/action-history"
import { startHabitConnectionSync } from "@/lib/habit-connection-sync"
import { startHabitCoverageSync } from "@/lib/habit-coverage-sync"
import { startHabitValueSync } from "@/lib/habit-value-sync"
import { startTaggedTaskSync } from "@/lib/habit-tagged-count"
import { useHabitsStore } from "@/lib/habits-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { periodWindowsForFrequency } from "@/lib/habit-period-windows"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "@/lib/start-hydrated-store-sync"
import { activeTrackingLink, convertTrackedMinutes } from "@/lib/habit-tracking"
import { trackedDateKeys, trackedMinutesForTagsInRange, type TrackedTimeSource } from "@/lib/tracked-time"
import type { TimeEntry } from "@/lib/time-entries"
import type { HabitTrackingLink, WeeklyTask } from "@/lib/types"

/**
 * Which days differ between two entry lists. Painting only rebuilds the entries
 * of the day it touched, so comparing object identity is enough — and it keeps a
 * single brush stroke from re-checking a year of history.
 */
function changedDateKeys(before: TimeEntry[], after: TimeEntry[]): string[] {
  const group = (entries: TimeEntry[]) => {
    const map = new Map<string, TimeEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.date)
      if (list) list.push(entry)
      else map.set(entry.date, [entry])
    }
    return map
  }
  const previous = group(before)
  const next = group(after)
  const changed: string[] = []
  for (const key of new Set([...previous.keys(), ...next.keys()])) {
    const a = previous.get(key) ?? []
    const b = next.get(key) ?? []
    if (a.length !== b.length || b.some((entry, i) => entry !== a[i])) changed.push(key)
  }
  return changed
}

function applyTrackedForTask(
  task: WeeklyTask,
  link: HabitTrackingLink | undefined,
  source: TrackedTimeSource,
  dateKeys: string[],
): void {
  const apply = useHabitsStore.getState().applyTrackedValue
  const frequency = task.frequency || "daily"
  for (const { anchor, keys } of periodWindowsForFrequency(frequency, dateKeys)) {
    const minutes = link ? trackedMinutesForTagsInRange(source, keys, link.tagIds) : 0
    apply(task.id, anchor, convertTrackedMinutes(minutes, link?.unit))
  }
}

/** Recompute linked habits for the given days (default: every day with data). */
export function syncTrackedHabits(dateKeys?: string[]): void {
  const tracking = useTimeTrackingStore.getState()
  const source: TrackedTimeSource = { scopes: tracking.scopes, entries: tracking.entries ?? [] }
  // Habits whose link was switched off are included with zero tracked time so
  // the store can withdraw what it previously wrote.
  const linked: { task: WeeklyTask; link?: HabitTrackingLink }[] = []
  for (const task of useHabitsStore.getState().tasks) {
    if (!task.trackingLink) continue
    linked.push({ task, link: activeTrackingLink(task) })
  }
  if (linked.length === 0) return

  const keys = dateKeys ?? trackedDateKeys(source)
  for (const { task, link } of linked) {
    applyTrackedForTask(task, link, source, keys)
  }
}

/** Re-check one habit across the whole history — used after its link is edited. */
export function syncTrackedHabitsForTask(taskId: string): void {
  try {
    const task = useHabitsStore.getState().tasks.find((t) => t.id === taskId)
    if (!task) return
    const link = activeTrackingLink(task)
    const tracking = useTimeTrackingStore.getState()
    const source: TrackedTimeSource = { scopes: tracking.scopes, entries: tracking.entries ?? [] }
    applyTrackedForTask(task, link, source, trackedDateKeys(source))
  } catch (error) {
    console.error("Failed to sync tracked time onto habit", taskId, error)
  }
}

const trackingSyncSlot: HydratedStoreSyncSlot = { stopper: null }

/**
 * Idempotent: repeated calls reuse the one subscription. Returns a stopper used
 * by tests; components rely on the singleton and never tear it down.
 *
 * Wait until Habits *and* Tracking have rehydrated. Applying tracked minutes
 * onto seed habits before the vault lands wrote defaults over the grid and
 * looked like a blank sheet until reload.
 */
export function startHabitTrackingSync(): () => void {
  return startHydratedStoreSync({
    slot: trackingSyncSlot,
    persists: [useHabitsStore.persist, useTimeTrackingStore.persist],
    onReady: () => {
      let previous = useTimeTrackingStore.getState()
      const stop = useTimeTrackingStore.subscribe((state) => {
        if (isRestoring()) {
          previous = state
          return
        }
        const paletteChanged = state.scopes !== previous.scopes || state.tags !== previous.tags
        const changedDays = state.entries === previous.entries ? [] : changedDateKeys(previous.entries, state.entries)
        previous = state
        if (paletteChanged) syncTrackedHabits()
        else if (changedDays.length > 0) syncTrackedHabits(changedDays)
      })
      syncTrackedHabits()
      return stop
    },
  })
}

/** Mount anywhere tracked time or habits are visible. */
export function useHabitTrackingSync(): void {
  useEffect(() => {
    startHabitTrackingSync()
    startHabitConnectionSync()
    startHabitCoverageSync()
    startHabitValueSync()
    startTaggedTaskSync()
  }, [])
}
