/**
 * hooks/use-tracking-lists.ts — Tracking folder after the vault hydrates
 *
 * Mounted once from `app/page.tsx` (`IdleVaultSeeds`). Creates Tracking →
 * Thought Process and Log, then files log-row and count pointers that are
 * not items yet. A later grid line or count is filed the same way. An
 * interval paint does not create a task.
 */
"use client"

import { useEffect } from "react"
import { useCountStatusesStore } from "@/lib/count-statuses"
import { useTaskStore } from "@/lib/task-store"
import { newCountsNeedPointers, newEntriesNeedPointers, syncTrackingLists } from "@/lib/tracking-lists"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"

export function useTrackingLists(): void {
  useEffect(() => {
    let stopTracking = () => {}
    let stopCounts = () => {}
    let stopEntries = () => {}
    let stopCountSub = () => {}
    const stopTasks = afterPersistHydrated(useTaskStore.persist, () => {
      stopTracking = afterPersistHydrated(useTimeTrackingStore.persist, () => {
        stopCounts = afterPersistHydrated(useCountStatusesStore.persist, () => {
          syncTrackingLists()
          stopEntries = useTimeTrackingStore.subscribe((state, prev) => {
            if (!newEntriesNeedPointers(prev.entries, state.entries)) return
            syncTrackingLists()
          })
          stopCountSub = useCountStatusesStore.subscribe((state, prev) => {
            if (!newCountsNeedPointers(prev.counts, state.counts, state.builtins.shower === "removed")) return
            syncTrackingLists()
          })
        })
      })
    })
    return () => {
      stopTasks()
      stopTracking()
      stopCounts()
      stopEntries()
      stopCountSub()
    }
  }, [])
}
