/**
 * lib/use-visible-habits.ts — The habit list a view shows
 *
 * `visibleHabits` (`lib/habit-pause.ts`) against the live clock day and the
 * Show paused habits switch. The desktop desk store and the phone page call
 * this where they read the list; each view then filters by frequency as before.
 * The day rolls at midnight, so an "until" pause ends without a reload.
 */
"use client"

import { useMemo } from "react"
import { formatLocalDateKey } from "@/lib/date-utils"
import { visibleHabits } from "@/lib/habit-pause"
import { useHabitsStore } from "@/lib/habits-store"
import { useLiveToday } from "@/lib/use-current-date"
import type { WeeklyTask } from "@/lib/types"

export function useVisibleHabits(tasks: WeeklyTask[]): WeeklyTask[] {
  const showPaused = useHabitsStore((s) => s.showPausedHabits)
  const todayKey = formatLocalDateKey(useLiveToday())
  return useMemo(() => visibleHabits(tasks, todayKey, showPaused), [tasks, todayKey, showPaused])
}
