/**
 * hooks/use-tracking-lists.ts — Tracking folder after the vault hydrates
 *
 * Mounted once from `app/page.tsx` (`IdleVaultSeeds`). Creates Tracking →
 * Thought Process and Log, then files existing thought-process and log rows
 * that are not on those lists yet.
 */
"use client"

import { useEffect } from "react"
import { useTaskStore } from "@/lib/task-store"
import { syncTrackingLists } from "@/lib/tracking-lists"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"

export function useTrackingLists(): void {
  useEffect(() => {
    let stopTracking = () => {}
    const stopTasks = afterPersistHydrated(useTaskStore.persist, () => {
      stopTracking = afterPersistHydrated(useTimeTrackingStore.persist, () => {
        syncTrackingLists()
      })
    })
    return () => {
      stopTasks()
      stopTracking()
    }
  }, [])
}
