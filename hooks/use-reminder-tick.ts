/**
 * hooks/use-reminder-tick.ts — Deliver due reminders while the app is open
 *
 * Mounted once from `app/page.tsx`. After the vault hydrates, on the next
 * minute, and when the window becomes visible, `deliverDueReminders` copies
 * due Reminders into the Inbox and texts the paired Telegram chat.
 * A closed app does not fire; the next open catches up once per reminder.
 */
"use client"

import { useEffect } from "react"
import { deliverDueReminders } from "@/lib/reminders"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"

function msUntilNextMinute(now: Date): number {
  return Math.max(1000, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 200)
}

export function useReminderTick(): void {
  useEffect(() => {
    let timer = 0
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      void deliverDueReminders(new Date()).catch(() => undefined)
      timer = window.setTimeout(tick, msUntilNextMinute(new Date()))
    }

    const unsub = afterPersistHydrated(useTaskStore.persist, () => {
      window.clearTimeout(timer)
      tick()
    })

    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      window.clearTimeout(timer)
      tick()
    }
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      cancelled = true
      unsub()
      window.clearTimeout(timer)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])
}
