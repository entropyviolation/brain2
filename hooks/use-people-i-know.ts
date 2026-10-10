/**
 * hooks/use-people-i-know.ts — Ensure the People I Know list after hydrate
 *
 * Mounted once from `app/page.tsx`. The list is created or adopted only after
 * the task vault has loaded, so a seed list is not written and then replaced.
 */
"use client"

import { useEffect } from "react"
import { ensurePeopleIKnowList } from "@/lib/people-i-know"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"

export function usePeopleIKnowList(): void {
  useEffect(() => {
    return afterPersistHydrated(useTaskStore.persist, () => {
      ensurePeopleIKnowList()
    })
  }, [])
}
