/**
 * tracker/use-habit-period-lens.ts — Week, month, and season lenses.
 *
 * First paint ignores localStorage so the server render matches. A stored
 * cursor becomes the lens only after mount, and only when it is not Home's day.
 */
"use client"

import { useEffect, useLayoutEffect, useState } from "react"
import {
  habitsLensFromStored,
  habitsViewedMonth,
  habitsViewedQuarter,
  habitsViewedWeekStart,
  retainHabitsWeekDates,
} from "@/components/Home/Habits/habits-period-cursor"
import { getWeekDates } from "@/lib/date-utils"
import { APP_NAV_KEYS, readStoredDate, writeStoredDate } from "@/lib/app-navigation"
import { resolveHomeCursor } from "@/lib/use-current-date"

export function useHabitPeriodLens(currentDate: Date) {
  // Coarser periods follow Home `currentDate` until milled nav pages a lens.
  // First paint matches SSR: ignore localStorage (same rule as usePersistedTab).
  // After mount, a stored cursor that is not Home day's period becomes the lens.
  const [weekLens, setWeekLens] = useState<Date | null>(null)
  const [monthLens, setMonthLens] = useState<Date | null>(null)
  const [quarterLens, setQuarterLens] = useState<Date | null>(null)
  const [weekDates, setWeekDates] = useState<Date[]>(() => getWeekDates(habitsViewedWeekStart(currentDate)))
  const [periodCursorReady, setPeriodCursorReady] = useState(false)

  const currentWeekStart = weekLens ?? habitsViewedWeekStart(currentDate)
  const currentMonth = monthLens ?? habitsViewedMonth(currentDate)
  const currentQuarter = quarterLens ?? habitsViewedQuarter(currentDate)

  useLayoutEffect(() => {
    const asOf = resolveHomeCursor(new Date())
    setWeekLens(habitsLensFromStored(asOf, readStoredDate(APP_NAV_KEYS.homeHabitsWeek), "week"))
    setMonthLens(habitsLensFromStored(asOf, readStoredDate(APP_NAV_KEYS.homeHabitsMonth), "month"))
    setQuarterLens(habitsLensFromStored(asOf, readStoredDate(APP_NAV_KEYS.homeHabitsQuarter), "quarter"))
    setPeriodCursorReady(true)
  }, [])

  useEffect(() => {
    setWeekDates((prev) => retainHabitsWeekDates(prev, currentWeekStart))
    if (!periodCursorReady) return
    writeStoredDate(APP_NAV_KEYS.homeHabitsWeek, currentWeekStart)
  }, [currentWeekStart, periodCursorReady])

  useEffect(() => {
    if (!periodCursorReady) return
    writeStoredDate(APP_NAV_KEYS.homeHabitsMonth, currentMonth)
  }, [currentMonth, periodCursorReady])

  useEffect(() => {
    if (!periodCursorReady) return
    writeStoredDate(APP_NAV_KEYS.homeHabitsQuarter, currentQuarter)
  }, [currentQuarter, periodCursorReady])

  return {
    setWeekLens,
    setMonthLens,
    setQuarterLens,
    weekDates,
    currentWeekStart,
    currentMonth,
    currentQuarter,
  }
}
