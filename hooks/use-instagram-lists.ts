/**
 * hooks/use-instagram-lists.ts — Ensure the Instagram lists after hydrate
 *
 * Mounted once from `app/page.tsx`, beside `usePeopleIKnowList()`. Each list
 * is created or adopted only after the task vault has loaded. The table
 * display is selected when that list has no saved display yet.
 */
"use client"

import { useEffect } from "react"
import { ensureInstagramFollowersList, ensureInstagramFollowingList } from "@/lib/instagram-lists"
import { useListsUiStore } from "@/lib/lists-ui-store"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"

function useEnsureInstagramList(ensure: () => string): void {
  useEffect(() => {
    let cancelled = false
    const stops: Array<() => void> = []
    stops.push(
      afterPersistHydrated(useTaskStore.persist, () => {
        if (cancelled) return
        const id = ensure()
        const stopUi = afterPersistHydrated(useListsUiStore.persist, () => {
          if (cancelled) return
          const ui = useListsUiStore.getState()
          if (!ui.listDisplay[id]) ui.setListDisplay(id, "table")
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
