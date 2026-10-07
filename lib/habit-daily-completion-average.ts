/**
 * lib/habit-daily-completion-average.ts — Raw mean of daily-habit row percents
 *
 * One source, `dailyCompletionAverage`, on a weekly, monthly, or season habit.
 * The period cell becomes the raw average of daily-habit completion for that
 * period. Raw means the uncurved arithmetic mean of each active daily habit's
 * row percent — `calculateTaskPercentage`, the same figure as that habit's
 * week % column. Yes/No and text are the percent of days met. Goals are the
 * logged amount over goal × days, capped at 100. An empty habit that was
 * active in the span counts as 0. A habit exempt on every day of the span is
 * left out. This does not call the Perfect output curve or the week-grade curve.
 *
 * A week uses that Monday week's seven dates, so the number cannot disagree
 * with the week % column: a day still ahead counts as not met. A month or
 * season uses only the days of that period that have already happened, today
 * included — the raw completion of daily tasks over those days, not a mean of
 * the weekly averages inside the period.
 *
 * The habit's own goal is the line (50 meets a goal of 50). A number typed by
 * hand stays; the average is still stored on `dailyCompletionAverage`.
 * Missing from `completionSources` means the source is off.
 *
 * Writes go through the period completion setters inside `withoutUndo`. The
 * subscriber watches daily `weeklyData`, the habit list, and exemptions, so a
 * parent write cannot loop.
 */
"use client"

import { useEffect } from "react"
import { isRestoring, withoutUndo } from "@/lib/action-history"
import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import { calculateTaskPercentage, type HabitExemptFn } from "@/lib/calculations"
import { currentExemptionContext, isHabitPeriodExempt } from "@/lib/habit-exemption"
import { periodWindowsForFrequency, type HabitPeriodWindow } from "@/lib/habit-period-windows"
import { habitWriteIsQuiet, useHabitsStore } from "@/lib/habits-store"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "@/lib/start-hydrated-store-sync"
import type { TaskCompletion, WeeklyData, WeeklyTask } from "@/lib/types"

/**
 * Mean of each daily habit's row percent over `dates`.
 * Null when the span is empty or every daily habit is exempt for the whole span.
 */
export function rawDailyCompletionAverage(
  dailyTasks: readonly WeeklyTask[],
  weeklyData: WeeklyData,
  dates: readonly Date[],
  isExempt?: HabitExemptFn,
): number | null {
  if (dates.length === 0) return null
  const percents: number[] = []
  for (const task of dailyTasks) {
    if ((task.frequency || "daily") !== "daily") continue
    const active = dates.filter((date) => !isExempt?.(task, formatLocalDateKey(date)))
    if (active.length === 0) continue
    percents.push(calculateTaskPercentage(task.id, dailyTasks as WeeklyTask[], weeklyData, dates as Date[], isExempt))
  }
  if (percents.length === 0) return null
  return percents.reduce((sum, pct) => sum + pct, 0) / percents.length
}

function foreignAuto(completion: TaskCompletion | undefined): boolean {
  if (!completion) return false
  return (
    completion.trackedValue !== undefined ||
    completion.trackedCompleted !== undefined ||
    completion.coverageCompleted !== undefined ||
    completion.habitSumValue !== undefined ||
    completion.taggedTaskCount !== undefined ||
    completion.keywordLogged === true ||
    completion.listSentPercent !== undefined ||
    completion.sleepCompleted !== undefined ||
    completion.listCompleted !== undefined ||
    completion.dailyFloorCompleted !== undefined
  )
}

/**
 * Merge a raw average into the cell. Returns null when the cell already says this.
 * A hand-owned cell, or a cell another auto source already fills, keeps its number
 * and only stores `dailyCompletionAverage`.
 */
export function applyDailyCompletionAverage(
  task: WeeklyTask,
  completion: TaskCompletion | undefined,
  average: number,
): TaskCompletion | null {
  const handOwned = completion?.handCompleted !== undefined || completion?.manualValue !== undefined
  if (handOwned || foreignAuto(completion)) {
    if (completion?.dailyCompletionAverage === average) return null
    return { ...(completion ?? {}), dailyCompletionAverage: average }
  }
  const goal = task.goal ?? completion?.goal
  if (
    completion?.dailyCompletionAverage === average &&
    completion?.value === average &&
    completion?.goal === goal
  ) {
    return null
  }
  return { ...(completion ?? {}), dailyCompletionAverage: average, value: average, goal }
}

function listens(task: WeeklyTask): boolean {
  const freq = task.frequency || "daily"
  if (freq !== "weekly" && freq !== "monthly" && freq !== "quarterly") return false
  return !!task.completionSources?.includes("dailyCompletionAverage")
}

/** Days that enter the average. A week is the full Monday week; a month or season stops at today. */
export function datesForCompletionAverage(
  frequency: WeeklyTask["frequency"] | undefined,
  window: HabitPeriodWindow,
  todayKey: string,
): Date[] {
  const freq = frequency || "daily"
  const keys =
    freq === "weekly"
      ? window.keys[0] && window.keys[0] <= todayKey
        ? window.keys
        : []
      : window.keys.filter((key) => key <= todayKey)
  const dates: Date[] = []
  for (const key of keys) {
    const date = parseLocalDate(key)
    if (date) dates.push(date)
  }
  return dates
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

export function syncDailyCompletionAverages(): void {
  withoutUndo(() => {
    const habits = useHabitsStore.getState()
    const parents = habits.tasks.filter(listens)
    if (!parents.length) return
    const daily = habits.tasks.filter((task) => (task.frequency || "daily") === "daily")
    if (!daily.length) return
    const todayKey = formatLocalDateKey(new Date())
    const dateKeys = new Set<string>(Object.keys(habits.weeklyData))
    dateKeys.add(todayKey)
    const isExempt: HabitExemptFn = (task, dateKey) =>
      isHabitPeriodExempt(task, dateKey, "daily", habits.habitExemptions, currentExemptionContext())

    for (const parent of parents) {
      const windows = periodWindowsForFrequency(parent.frequency, [...dateKeys])
      for (const window of windows) {
        const dates = datesForCompletionAverage(parent.frequency, window, todayKey)
        if (!dates.length) continue
        const average = rawDailyCompletionAverage(daily, habits.weeklyData, dates, isExempt)
        if (average === null) continue
        const previous = bucketFor(parent, useHabitsStore.getState())[window.periodKey]?.[parent.id]
        const next = applyDailyCompletionAverage(parent, previous, average)
        if (!next) continue
        writePeriod(parent, window.anchor, next)
      }
    }
  })
}

const averageSyncSlot: HydratedStoreSyncSlot = { stopper: null }

export function startDailyCompletionAverageSync(): () => void {
  return startHydratedStoreSync({
    slot: averageSyncSlot,
    persists: [useHabitsStore.persist],
    onReady: () => {
      const unHabits = useHabitsStore.subscribe((state, prev) => {
        if (isRestoring() || habitWriteIsQuiet()) return
        if (
          state.tasks !== prev.tasks ||
          state.weeklyData !== prev.weeklyData ||
          state.habitExemptions !== prev.habitExemptions
        ) {
          syncDailyCompletionAverages()
        }
      })
      syncDailyCompletionAverages()
      return () => {
        unHabits()
      }
    },
  })
}

export function useDailyCompletionAverageSync(): void {
  useEffect(() => {
    startDailyCompletionAverageSync()
  }, [])
}
