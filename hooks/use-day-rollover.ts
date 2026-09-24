/**
 * hooks/use-day-rollover.ts — Roll unfinished past schedules up one level
 *
 * Mounted once from `app/page.tsx`. After the vault hydrates, and again at
 * the next local midnight (and when the window becomes visible on a new day),
 * unfinished period assignments whose period has ended roll up the funnel
 * (day → week → month → year → unscheduled). Prior placements stay on
 * `schedulePlacements`. Today and explicit pushes stay. Done / missed stay put.
 */
"use client"

import { useEffect } from "react"
import { noteDayClock } from "@/lib/day-clock"
import { rollUpExpiredSchedules } from "@/lib/services/scheduling-service"
import { useTaskStore } from "@/lib/task-store"
import { afterPersistHydrated } from "@/lib/use-persist-hydrated"

function msUntilNextLocalMidnight(now: Date): number {
  const next = new Date(now)
  next.setHours(24, 0, 0, 250)
  return Math.max(1000, next.getTime() - now.getTime())
}

export function useDayScheduleRollover(): void {
  useEffect(() => {
    let timer = 0
    let cancelled = false

    const tick = () => {
      if (cancelled) return
      const now = new Date()
      if (useTaskStore.persist.hasHydrated()) rollUpExpiredSchedules(now)
      noteDayClock(now)
      timer = window.setTimeout(tick, msUntilNextLocalMidnight(now))
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
