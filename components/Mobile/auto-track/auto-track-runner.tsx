/**
 * components/Mobile/auto-track/auto-track-runner.tsx — Runs the automatic sync in the iPhone app
 *
 * Renders nothing. Mounted on the desk page (`components/AppHeader.tsx`) and on
 * the phone shell (`components/Mobile/MobileApp.tsx`). It calls
 * `runAutoTrack` (`lib/mobile/auto-track.ts`) once the Mac's data is in
 * memory, each time the app comes back to the front, and every five minutes
 * while it is open. Off the phone it does nothing.
 *
 * It waits for the Mac's copy on purpose: a walk painted onto a time grid that
 * has not loaded yet would be checked against an empty day.
 */
"use client"

import { useEffect } from "react"
import { autoTrackAvailable, runAutoTrack } from "@/lib/mobile/auto-track"
import { getPhoneWindowSnapshot, subscribePhoneWindow } from "@/lib/phone-window"

const EVERY_MS = 5 * 60_000

export function AutoTrackRunner() {
  useEffect(() => {
    if (!autoTrackAvailable()) return
    const tick = () => {
      if (document.visibilityState !== "visible") return
      const status = getPhoneWindowSnapshot().status
      if (status !== "live" && status !== "stale") return
      void runAutoTrack()
    }
    tick()
    const off = subscribePhoneWindow(tick)
    document.addEventListener("visibilitychange", tick)
    const id = window.setInterval(tick, EVERY_MS)
    return () => {
      off()
      document.removeEventListener("visibilitychange", tick)
      window.clearInterval(id)
    }
  }, [])
  return null
}
