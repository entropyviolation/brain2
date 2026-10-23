/**
 * hooks/use-instagram-lists.ts — Ensure the Instagram lists after hydrate
 *
 * Mounted once from `app/page.tsx`, beside `usePeopleIKnowList()`. Each list
 * is created or adopted only after the task vault has loaded. The table
 * display is selected when that list has no saved display yet.
 */
"use client"

import { useEffect } from "react"
import {
  ensureInstagramAnalysisLists,
  ensureInstagramFollowersList,
  ensureInstagramFollowingList,
} from "@/lib/instagram-lists"
import { syncInstagramListsFromReport } from "@/lib/instagram-lists-sync"
import { instagramSource } from "@/lib/instagram-report"
import { syncInstagramSessionsFromReport } from "@/lib/instagram-sessions-sync"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { useTaskStore } from "@/lib/task-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"

function useEnsureInstagramList(ensure: () => string | string[]): void {
  useEffect(() => {
    let cancelled = false
    const stops: Array<() => void> = []
    stops.push(
      afterPersistHydrated(useTaskStore.persist, () => {
        if (cancelled) return
        const made = ensure()
        const ids = Array.isArray(made) ? made : [made]
        const stopUi = afterPersistHydrated(useListsUiStore.persist, () => {
          if (cancelled) return
          const ui = useListsUiStore.getState()
          for (const id of ids) if (!ui.listDisplay[id]) ui.setListDisplay(id, "table")
        })
        if (cancelled) stopUi()
        else stops.push(stopUi)
      }),
    )
    return () => {
      cancelled = true
      for (const stop of stops) stop()
    }
  }, [ensure])
}

export function useInstagramFollowingList(): void {
  useEnsureInstagramList(ensureInstagramFollowingList)
}

export function useInstagramFollowersList(): void {
  useEnsureInstagramList(ensureInstagramFollowersList)
}

/** The five Instagram analysis lists, empty until summary.json is imported. */
export function useInstagramAnalysisLists(): void {
  useEnsureInstagramList(ensureInstagramAnalysisLists)
}

/**
 * Fill the Instagram lists from the Analytics report. Runs after the vault and
 * the lists UI have hydrated, then again when the desktop builds a new report.
 */
export function useInstagramListsSync(): void {
  useEffect(() => {
    let cancelled = false
    let off: (() => void) | undefined
    const stop = afterPersistHydrated(useTaskStore.persist, () => {
      if (cancelled) return
      const run = () => {
        if (!cancelled) void syncInstagramListsFromReport()
      }
      ensureInstagramAnalysisLists()
      run()
      off = instagramSource()?.onChange?.(run)
    })
    return () => {
      cancelled = true
      stop()
      off?.()
    }
  }, [])
}

/**
 * Paint the report's Instagram sessions on Tracking → iPhone Screen Time. Waits
 * for the Tracking store, then runs again when the desktop builds a new report.
 */
export function useInstagramSessionsSync(): void {
  useEffect(() => {
    let cancelled = false
    let off: (() => void) | undefined
    const stop = afterPersistHydrated(useTimeTrackingStore.persist, () => {
      if (cancelled) return
      const run = () => {
        if (!cancelled) void syncInstagramSessionsFromReport()
      }
      run()
      off = instagramSource()?.onChange?.(run)
    })
    return () => {
      cancelled = true
      stop()
      off?.()
    }
  }, [])
}
