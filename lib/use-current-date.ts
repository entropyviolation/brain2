/**
 * lib/use-current-date.ts — Shared "today" with midnight rollover
 *
 * Used by Home dashboard header, points, progress, Plan, Time Grid, Activity
 * Log, Day Log, and day notes so they stay on the same calendar
 * day and advance at local midnight when the cursor is still on "today".
 * Navigating to another day persists across refresh and tab switches.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { APP_NAV_KEYS, readStoredDate, writeStoredDate } from "@/lib/app-navigation"
import { formatLocalDateKey } from "@/lib/date-utils"

export function msUntilLocalMidnight(from = new Date()): number {
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
  return Math.max(0, next.getTime() - from.getTime())
}

export function useCurrentDate() {
  const [currentDate, setCurrentDateState] = useState(() => readStoredDate(APP_NAV_KEYS.homeDate) ?? new Date())

  const setCurrentDate = useCallback((date: Date) => {
    setCurrentDateState(date)
    writeStoredDate(APP_NAV_KEYS.homeDate, date)
  }, [])

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>

    const scheduleNextMidnight = () => {
      timeoutId = setTimeout(() => {
        setCurrentDateState((prev) => {
          const now = new Date()
          const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)
          if (formatLocalDateKey(prev) !== formatLocalDateKey(yesterday)) return prev
          writeStoredDate(APP_NAV_KEYS.homeDate, now)
          return now
        })
      }, msUntilLocalMidnight())
    }

    scheduleNextMidnight()
    return () => clearTimeout(timeoutId)
  }, [currentDate])

  const goToToday = useCallback(() => setCurrentDate(new Date()), [setCurrentDate])

  return { currentDate, setCurrentDate, goToToday }
}

/** The clock's calendar day. Does not follow the Home date cursor. */
export function useLiveToday(): Date {
  const [today, setToday] = useState(() => new Date())

  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>
    const arm = () => {
      const now = new Date()
      setToday(now)
      timeoutId = setTimeout(arm, Math.max(1000, msUntilLocalMidnight(now)))
    }
    timeoutId = setTimeout(arm, Math.max(1000, msUntilLocalMidnight()))
    return () => clearTimeout(timeoutId)
  }, [])

  return today
}
