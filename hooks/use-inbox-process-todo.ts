/**
 * hooks/use-inbox-process-todo.ts — Keep the Inbox-over-100 To Do in place
 *
 * Mounted once from `app/page.tsx`, after `useDayScheduleRollover`, so a past
 * copy auto-pushes before this looks. Runs when the vault hydrates, when
 * items change, and when the local day changes.
 */
"use client"

import { useEffect } from "react"
import { subscribeDayClock } from "@/lib/day-clock"
import { processInboxTodoToAdd } from "@/lib/inbox-process-todo"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"

export function useProcessInboxTodo(): void {
  useEffect(() => {
    let unsubscribeStore = () => {}
    let unsubscribeDay = () => {}
    let placing = false

    const place = () => {
      if (placing) return
      if (!useTaskStore.persist.hasHydrated()) return
      placing = true
      try {
        const next = processInboxTodoToAdd(useTaskStore.getState().tasks, new Date())
        if (next) useTaskStore.getState().addTask(next)
      } finally {
        placing = false
      }
    }

    const stop = afterPersistHydrated(useTaskStore.persist, () => {
      place()
      unsubscribeStore = useTaskStore.subscribe((state, prev) => {
        if (prev && state.tasks === prev.tasks) return
        place()
      })
      unsubscribeDay = subscribeDayClock(place)
    })

    return () => {
      stop()
      unsubscribeStore()
      unsubscribeDay()
    }
  }, [])
}
