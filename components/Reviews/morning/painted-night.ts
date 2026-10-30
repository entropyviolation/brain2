/**
 * components/Reviews/morning/painted-night.ts — Sleep painted on the time grid.
 *
 * The morning seed uses this when the sleep log has no clocks yet.
 */
"use client"

import { useMemo } from "react"
import { inferNight } from "@/lib/sleep-inference"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"

export function usePaintedNight(dayKey: string) {
  const scopes = useTimeTrackingStore((s) => s.scopes)
  const entries = useTimeTrackingStore((s) => s.entries)
  return useMemo(() => inferNight({ scopes, entries }, dayKey), [scopes, entries, dayKey])
}
