/**
 * hooks/use-close-gift-ideas.ts — Gift ideas lists for people already Close
 *
 * Mounted once from `app/page.tsx`, beside `usePeopleIKnowList`. After the
 * task vault hydrates, each person with `personProfile.close` gets a Gift
 * ideas list. Later saves that turn Close on create one too, and a renamed
 * person updates that list's name. Turning Close off does not delete it.
 */
"use client"

import { useEffect } from "react"
import { ensureCloseGiftIdeas, noteSavedPeople } from "@/lib/gift-ideas"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"

export function useCloseGiftIdeas(): void {
  useEffect(() => {
    let stopTasks = () => {}
    const stopHydrate = afterPersistHydrated(useTaskStore.persist, () => {
      ensureCloseGiftIdeas()
      stopTasks = useTaskStore.subscribe((state, prev) => {
        if (state.tasks === prev.tasks) return
        noteSavedPeople(prev.tasks, state.tasks)
      })
    })
    return () => {
      stopHydrate()
      stopTasks()
    }
  }, [])
}
