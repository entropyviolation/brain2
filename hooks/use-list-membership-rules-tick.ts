/**
 * hooks/use-list-membership-rules-tick.ts — Keep rule lists current
 *
 * Mounted once from `app/page.tsx`. Date rules ("due within 7 days") move with
 * the clock, so after the vault hydrates, every hour, just past midnight, and
 * when the window becomes visible, the store re-runs every list's auto-add
 * rules (`lib/list-membership-rules.ts`). Lists without rules cost nothing.
 */
"use client"

import { useEffect } from "react"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"

const HOUR = 3_600_000

function msUntilNext(now: Date): number {
  const nextHour = HOUR - (now.getMinutes() * 60_000 + now.getSeconds() * 1000 + now.getMilliseconds())
  return Math.max(5_000, nextHour + 1_000)
}

export function useListMembershipRulesTick(): void {
  useEffect(() => {
    let timer = 0
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      useTaskStore.getState().applyListMembershipRules(new Date())
      timer = window.setTimeout(tick, msUntilNext(new Date()))
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
