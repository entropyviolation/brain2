/**
 * lib/use-current-date.ts — Shared Home day cursor with wall-clock catch-up
 *
 * Home overview tiles, Habits Day View, Hide Completed, Plan, the To Do day
 * lens, Time Grid, Activity Log, Day Log, and day notes share this cursor. The
 * date plate uses `useLiveToday` and does not follow it.
 *
 * Choosing another day persists across refresh and tab switches. A cursor left
 * on today catches up when the calendar moves — at midnight, when the window
 * becomes visible, or on the next launch — including after more than one
 * missed night. A saved day from before that choice was recorded is treated
 * as the last session's today and catches up once.
 *
 * Coarser period anchors (`weekAnchorFromDay`, `monthAnchorFromDay`,
 * `quarterAnchorFromDay`, `periodAnchorsFromDay`) are pure facts derived from
 * that day. Habits / To Do chrome may keep a local lens offset; they must not
 * invent a second shell day.
 */
"use client"

import { useCallback, useEffect, useState } from "react"
import { APP_NAV_KEYS, readStoredDate, writeStoredDate } from "@/lib/app-navigation"
import { formatLocalDateKey, getWeekStartDate } from "@/lib/date-utils"
import { quarterStartDate } from "@/lib/seasons"
import { readAliasedLocal, writeAliasedLocal } from "@/lib/storage-keys"

/** Monday that opens the week containing `day`. */
export function weekAnchorFromDay(day: Date): Date {
  return getWeekStartDate(day)
}

/** First-of-month for the month containing `day`. */
export function monthAnchorFromDay(day: Date): Date {
  return new Date(day.getFullYear(), day.getMonth(), 1)
}

/** Season (quarter) start for the quarter containing `day`. */
export function quarterAnchorFromDay(day: Date): Date {
  return quarterStartDate(day)
}

/** Week / month / season anchors derived from one Home day. */
export function periodAnchorsFromDay(day: Date): {
  day: Date
  weekStart: Date
  monthStart: Date
  quarterStart: Date
} {
  return {
    day,
    weekStart: weekAnchorFromDay(day),
    monthStart: monthAnchorFromDay(day),
    quarterStart: quarterAnchorFromDay(day),
  }
}

export function msUntilLocalMidnight(from = new Date()): number {
  const next = new Date(from.getFullYear(), from.getMonth(), from.getDate() + 1)
  return Math.max(0, next.getTime() - from.getTime())
}

function readFollowsToday(): boolean | null {
  const raw = readAliasedLocal(APP_NAV_KEYS.homeDateFollowsToday)
  if (raw === "1") return true
  if (raw === "0") return false
  return null
}

function writeFollowsToday(follows: boolean): void {
  writeAliasedLocal(APP_NAV_KEYS.homeDateFollowsToday, follows ? "1" : "0")
}

/** Persist a Home day and whether it should keep following the wall clock. */
export function pinHomeCursor(date: Date, followsToday: boolean): void {
  writeStoredDate(APP_NAV_KEYS.homeDate, date)
  writeFollowsToday(followsToday)
}

/**
 * The cursor to show at `now`. An explicit other day stays. A cursor that was
 * still today — or a legacy save with no flag — moves ahead by every missed day.
 */
export function resolveHomeCursor(now = new Date()): Date {
  return settleHomeCursor(readStoredDate(APP_NAV_KEYS.homeDate), now)
}

function settleHomeCursor(candidate: Date | null, now: Date): Date {
  if (!candidate) return now

  const storedKey = formatLocalDateKey(candidate)
  const todayKey = formatLocalDateKey(now)
  const follows = readFollowsToday()

  if (storedKey === todayKey) {
    if (follows !== true) writeFollowsToday(true)
    return candidate
  }

  if (storedKey > todayKey) {
    if (follows !== false) writeFollowsToday(false)
    return candidate
  }

  if (follows === false) return candidate

  writeStoredDate(APP_NAV_KEYS.homeDate, now)
  writeFollowsToday(true)
  return now
}

export function useCurrentDate() {
  const [currentDate, setCurrentDateState] = useState(() => resolveHomeCursor(new Date()))

  const setCurrentDate = useCallback((date: Date) => {
    const now = new Date()
    setCurrentDateState(date)
    pinHomeCursor(date, formatLocalDateKey(date) === formatLocalDateKey(now))
  }, [])

  useEffect(() => {
    let timeoutId = 0
    let cancelled = false

    const catchUp = () => {
      if (cancelled) return
      const now = new Date()
      setCurrentDateState((prev) => {
        // A sibling hook can still be sitting on an older "today" after the
        // owner navigates. Only a cursor that is still following the clock
        // moves, and only forward.
        if (readFollowsToday() === false) return prev
        if (formatLocalDateKey(prev) >= formatLocalDateKey(now)) return prev
        writeStoredDate(APP_NAV_KEYS.homeDate, now)
        writeFollowsToday(true)
        return now
      })
    }

    const arm = () => {
      timeoutId = window.setTimeout(() => {
        catchUp()
        if (!cancelled) arm()
      }, Math.max(1000, msUntilLocalMidnight()))
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible") return
      catchUp()
      window.clearTimeout(timeoutId)
      arm()
    }

    // The server has no localStorage, so the first paint can be the wall clock
    // while a saved day is still sitting in the browser. Re-read it here.
    setCurrentDateState(resolveHomeCursor(new Date()))
    arm()
    document.addEventListener("visibilitychange", onVisible)
    return () => {
      cancelled = true
      window.clearTimeout(timeoutId)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [])

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
