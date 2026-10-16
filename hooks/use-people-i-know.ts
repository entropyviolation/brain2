/**
 * hooks/use-people-i-know.ts — Ensure the People I Know list after hydrate
 *
 * Mounted once from `app/page.tsx`. The list is created or adopted only after
 * the task vault has loaded, so a seed list is not written and then replaced.
 * Also starts `lib/people-sync-runner.ts`: every Company person pen has a
 * People I Know item, and Who-with details match Company pens.
 */
"use client"

import { useEffect } from "react"
import { ensurePeopleIKnowList } from "@/lib/people-i-know"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"
import { startPeopleSync } from "@/lib/people-sync-runner"

export function usePeopleIKnowList(): void {
  useEffect(() => {
    const stopList = afterPersistHydrated(useTaskStore.persist, () => {
      ensurePeopleIKnowList()
    })
    // Who-with details, Company pens, and People I Know items stay matched.
    const stopSync = startPeopleSync()
    return () => {
      stopList()
      stopSync()
    }
  }, [])
}
