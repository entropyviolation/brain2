/**
 * lib/habit-value-sync.ts — Sum a daily habit into a period habit
 *
 * A weekly "Read 30 pages" can listen to one daily habit. Each period cell
 * stores the sum of that habit's `value` on the days of the week, month, or
 * season that have already happened, today included (the whole period, once
 * it is finished). Monday 2 pages and Tuesday 2 pages show 4 toward 30.
 * A day with no number and no check adds nothing. A logged zero adds zero
 * and leaves the other days in the total. A bare check counts as 1.
 * A number typed by hand stays; the sum is still recorded on `habitSumValue`.
 *
 * Writes go through the period completion setters inside `withoutUndo`, and the
 * subscriber watches daily `weeklyData` only, so a parent write cannot loop.
 */
"use client"

import { useEffect } from "react"
import { isRestoring, withoutUndo } from "@/lib/action-history"
import { formatLocalDateKey } from "@/lib/date-utils"
import { periodWindowsForFrequency } from "@/lib/habit-period-windows"
import { habitWriteIsQuiet, useHabitsStore } from "@/lib/habits-store"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "@/lib/start-hydrated-store-sync"
import type { TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"

export function childHabitAmount(cell: TaskCompletion | undefined): number {
  if (!cell) return 0
  if (typeof cell.value === "number" && Number.isFinite(cell.value)) return cell.value
  if (cell.completed) return 1
  return 0
}

export function sumHabitValuesOverDays(weeklyData: WeeklyData, habitId: string, dayKeys: string[]): number {
  let sum = 0
  for (const key of dayKeys) sum += childHabitAmount(weeklyData[key]?.[habitId])
  return sum
}

/**
 * Merge a period sum into the cell. Returns null when the cell already says this.
 * A hand-owned cell keeps its typed total and only stores `habitSumValue`.
 * A zero sum does not open an empty cell.
 */
export function applyHabitSum(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  sum: number,
): TaskCompletion | null {
  const goal = task.goal ?? completion?.goal
  const handOwned = completion?.handCompleted !== undefined || completion?.manualValue !== undefined
  if (handOwned || completion?.listSentPercent !== undefined) {
    if (completion?.habitSumValue === sum) return null
    return { ...(completion ?? {}), habitSumValue: sum }
  }
  if (sum === 0 && completion?.habitSumValue === undefined) return null
  if (completion?.habitSumValue === sum && completion?.value === sum && completion?.goal === goal) return null
  return { ...(completion ?? {}), habitSumValue: sum, value: sum, goal }
}

function bucketFor(task: WeeklyTask, state: ReturnType<typeof useHabitsStore.getState>): WeeklyData {
  if (task.frequency === "monthly") return state.monthlyHabitData
  if (task.frequency === "quarterly") return state.quarterlyHabitData
  return state.weeklyHabitData
}

function writePeriod(task: WeeklyTask, anchor: Date, next: TaskCompletion): void {
  const habits = useHabitsStore.getState()
  if (task.frequency === "monthly") habits.updateMonthlyHabitCompletion(task.id, anchor, next)
  else if (task.frequency === "quarterly") habits.updateQuarterlyHabitCompletion(task.id, anchor, next)
  else habits.updateWeeklyHabitCompletion(task.id, anchor, next)
}

export function syncHabitValueLinks(): void {
  withoutUndo(() => {
    const habits = useHabitsStore.getState()
    const parents = habits.tasks.filter((task) => {
      const link = task.habitValueLink
      const freq = task.frequency || "daily"
      return freq !== "daily" && !!link?.habitId && link.enabled !== false
    })
    if (!parents.length) return
    const todayKey = formatLocalDateKey(new Date())
    const dateKeys = new Set<string>(Object.keys(habits.weeklyData))
    dateKeys.add(todayKey)
    for (const parent of parents) {
      const link = parent.habitValueLink
      if (!link?.habitId) continue
      const windows = periodWindowsForFrequency(parent.frequency, [...dateKeys])
      for (const window of windows) {
        const keys = window.keys.filter((key) => key <= todayKey)
        if (!keys.length) continue
        const sum = sumHabitValuesOverDays(habits.weeklyData, link.habitId, keys)
        const previous = bucketFor(parent, habits)[window.periodKey]?.[parent.id]
        const next = applyHabitSum(parent, previous, sum)
        if (!next) continue
        writePeriod(parent, window.anchor, next)
      }
    }
  })
}

const valueSyncSlot: HydratedStoreSyncSlot = { stopper: null }

export function startHabitValueSync(): () => void {
  return startHydratedStoreSync({
    slot: valueSyncSlot,
    persists: [useHabitsStore.persist],
    onReady: () => {
      const unHabits = useHabitsStore.subscribe((state, prev) => {
        if (isRestoring() || habitWriteIsQuiet()) return
        if (state.tasks !== prev.tasks || state.weeklyData !== prev.weeklyData) syncHabitValueLinks()
      })
      syncHabitValueLinks()
      return () => {
        unHabits()
      }
    },
  })
}

export function useHabitValueSync(): void {
  useEffect(() => {
    startHabitValueSync()
  }, [])
}
