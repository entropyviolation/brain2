/**
 * hooks/use-day-log-bimby.ts — Start the Day Log BIMBY's automatic pipeline
 *
 * Mounted once from `app/page.tsx`. Desktop only (`startDayLogBimby` does
 * nothing on the phone). See `lib/day-log-bimby/README.md`.
 */
"use client"

import { useEffect } from "react"
import { startDayLogBimby } from "@/lib/day-log-bimby/run"

export function useDayLogBimby(): void {
  useEffect(() => startDayLogBimby(), [])
}
