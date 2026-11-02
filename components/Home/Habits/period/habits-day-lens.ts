/**
 * components/Home/Habits/period/habits-day-lens.ts — Day View's own day
 *
 * Day View does not read Home's day cursor. That cursor can stay pinned on a
 * past day from Plan or To Do. The shown day is the wall-clock today when the
 * viewed week holds it, else that week's Monday. Day keys step one day and
 * move the week lens with them.
 */
"use client"

import { useCallback, useState } from "react"
import { addCalendarDays, formatLocalDateKey, getWeekStartDate, isSameLocalWeek, startOfLocalDay } from "@/lib/date-utils"
import { useLiveToday } from "@/lib/use-current-date"

/** The day Day View shows for `weekStart`. A picked day wins inside its own week. */
export function habitsDayViewDate(weekStart: Date, picked: Date | null, today: Date): Date {
  if (picked && isSameLocalWeek(weekStart, picked)) return startOfLocalDay(picked)
  return isSameLocalWeek(weekStart, today) ? startOfLocalDay(today) : startOfLocalDay(weekStart)
}

export function useHabitsDayLens(currentWeekStart: Date, setWeekLens: (next: Date | null) => void) {
  const today = useLiveToday()
  const [picked, setPicked] = useState<Date | null>(null)
  const dayViewDate = habitsDayViewDate(currentWeekStart, picked, today)

  const goToDay = useCallback(
    (date: Date) => {
      const day = startOfLocalDay(date)
      setPicked(day)
      setWeekLens(getWeekStartDate(day))
    },
    [setWeekLens],
  )

  return {
    dayViewDate,
    isToday: formatLocalDateKey(dayViewDate) === formatLocalDateKey(today),
    goToDay,
    stepDay: (dir: -1 | 1) => goToDay(addCalendarDays(dayViewDate, dir)),
    goToToday: () => goToDay(today),
  }
}
