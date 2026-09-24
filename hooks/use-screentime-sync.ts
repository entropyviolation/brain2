/**
 * hooks/use-screentime-sync.ts — Pull ActivityWatch into the Screen Time scope
 *
 * Mount-only, like `useSleepSync`: Time Grid and Analytics poll while they are
 * on screen. Entry dialogs do not call this. Settings "Sync now" calls
 * `syncScreenTime()` itself so a closed Tracking tab can still refresh.
 *
 * Full lookback on first paint of a session (and on that first 2-minute poll if
 * the mount tick has not run yet). Later ticks and window `focus` only cover
 * today and yesterday.
 */
"use client"

import { useEffect } from "react"

const POLL_MS = 2 * 60 * 1000
/** Today + yesterday. */
const RECENT_DAYS = 2

let sessionFullLookback = false

async function pull(full: boolean): Promise<void> {
  try {
    const { syncScreenTime } = await import("@/lib/screentime/sync")
    if (full) {
      await syncScreenTime()
      return
    }
    await syncScreenTime({ lookbackDays: RECENT_DAYS })
  } catch {
    // ActivityWatch missing or prefs unread — the grid stays as-is.
  }
}

export function useScreenTimeSync(): void {
  useEffect(() => {
    let cancelled = false
    const run = (full: boolean) => {
      if (cancelled) return
      void pull(full)
    }

    const fullOnMount = !sessionFullLookback
    sessionFullLookback = true
    run(fullOnMount)

    const onFocus = () => run(false)
    window.addEventListener("focus", onFocus)

    let firstPoll = true
    const timer = window.setInterval(() => {
      const full = firstPoll && !fullOnMount
      firstPoll = false
      run(full)
    }, POLL_MS)

    return () => {
      cancelled = true
      window.removeEventListener("focus", onFocus)
      window.clearInterval(timer)
    }
  }, [])
}

/** Test-only: pretend this process has not done a full lookback yet. */
export function resetScreenTimeSyncSessionForTests(): void {
  sessionFullLookback = false
}
