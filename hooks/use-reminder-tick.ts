/**
 * hooks/use-reminder-tick.ts — Deliver due reminders while the app is open
 *
 * Mounted once from `app/page.tsx`. After the vault hydrates, on the next
 * minute, and when the window becomes visible, moon-night reminders are
 * ensured and `deliverDueReminders` copies due Reminders into the Inbox and
 * texts the paired Telegram chat. A closed app does not fire; the next open
 * catches up once per reminder.
 *
 * While the always-on hub answers and says `remindersByHub`, this tick stands down: the hub delivers Reminders
 * (and the Coach BIMBY's brief) every minute with the app closed, and two senders would text twice.
 */
"use client"

import { useEffect } from "react"
import { deliverDueReminders, ensureMoonNightReminders } from "@/lib/reminders"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"
import { useIngestStore } from "@/lib/ingest/ingest-store"
import { fetchPhoneHubStatus, normalizeHubUrl } from "@/lib/ingest/vault-push"

let hubSeen: { at: number; delivers: boolean } = { at: 0, delivers: false }

/** True when the hub delivers Reminders itself. Asked at most once a minute. */
async function hubDelivers(): Promise<boolean> {
  if (Date.now() - hubSeen.at < 55_000) return hubSeen.delivers
  const origin = normalizeHubUrl(useIngestStore.getState().phoneHubUrl) || "http://127.0.0.1:8787"
  const status = await fetchPhoneHubStatus(origin).catch(() => ({ ok: false, remindersByHub: false }))
  hubSeen = { at: Date.now(), delivers: Boolean(status.ok && status.remindersByHub) }
  return hubSeen.delivers
}

function msUntilNextMinute(now: Date): number {
  return Math.max(1000, 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 200)
}

export function useReminderTick(): void {
  useEffect(() => {
    let timer = 0
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      void hubDelivers().then((byHub) => {
        if (byHub || cancelled) return
        ensureMoonNightReminders(new Date())
        return deliverDueReminders(new Date())
      }).catch(() => undefined)
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
