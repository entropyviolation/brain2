/**
 * lib/habit-coverage-sync.ts — Push Tracking coverage % and daily-floor links
 *
 * Coverage habits read **Activity Occupancy** from `lib/tracking-summary.ts`
 * (`activityOccupancyCoverage` — the same "% of the day|week" figure Tracking
 * shows on the Activity Time Grid / Week) for the habit's period. Any Activity
 * minutes write that percent into the cell immediately; the habit is met only
 * at the threshold, and `coverageCompleted: false` is still a reading. No
 * Activity minutes clears that reading. Daily-floor weekly habits recompute
 * from live daily habit week % through `applyLinkedFlag` so hand ticks stay.
 *
 * A tracking edit recomputes only the dates whose entries changed, plus the
 * daily-floor weeks that contain them. Boot, a habit edit, and a call with no
 * dates still walk every dated entry and every floor week. The habits
 * subscriber watches the same buckets this module writes and notifies
 * synchronously; re-entry stays on the dates already in progress instead of
 * widening into another full pass. Those writes use `withoutUndo`: a paint
 * already snapshotted the habit cells, and a coverage update must not become
 * its own Cmd+Z step on top of the stroke. Both subscribers stand down while
 * `isRestoring()` — the snapshot already has the cells from before the stroke,
 * and recomputing them on the undo turn would scan the whole book before the
 * grid could paint.
 */
"use client"

import { useEffect } from "react"
import { isRestoring, withoutUndo } from "@/lib/action-history"
import {
  applyCoverageObservation,
  applyLinkedFlag,
  clampCoverageThreshold,
  clearCoverageObservation,
  coverageMeetsThreshold,
  dailyHabitsClearFloor,
  effectiveCoverageLink,
  effectiveDailyFloorLink,
  weekDatesForKey,
} from "@/lib/habit-completion-source"
import { getWeekStartDate, getWeekString, parseLocalDate } from "@/lib/date-utils"
import { habitWriteIsQuiet, useHabitsStore } from "@/lib/habits-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { periodWindowsForFrequency } from "@/lib/habit-period-windows"
import { startHydratedStoreSync, type HydratedStoreSyncSlot } from "@/lib/start-hydrated-store-sync"
import {
  activityOccupancyCoverage,
  COVERAGE_HABIT_SCOPE_ID,
  entriesInRange,
  uniqueMinutes,
} from "@/lib/tracking-summary"
import type { TimeEntry } from "@/lib/time-entries"
import type { TaskCompletion, WeeklyTask } from "@/lib/types"
import { TaskType } from "@/lib/types"
import { currentExemptionContext, exemptionKind, isExemptKind } from "@/lib/habit-exemption"

/**
 * Days whose entry list changed. Same identity compare as tag sync: a stroke
 * replaces the entries it touched and leaves every other day's objects in place,
 * so one brush does not rebuild a year of occupancy sets.
 */
function changedEntryDates(before: TimeEntry[], after: TimeEntry[]): string[] {
  const group = (entries: TimeEntry[]) => {
    const map = new Map<string, TimeEntry[]>()
    for (const entry of entries) {
      const list = map.get(entry.date)
      if (list) list.push(entry)
      else map.set(entry.date, [entry])
    }
    return map
  }
  const previous = group(before)
  const next = group(after)
  const changed: string[] = []
  for (const key of new Set([...previous.keys(), ...next.keys()])) {
    const a = previous.get(key) ?? []
    const b = next.get(key) ?? []
    if (a.length !== b.length || b.some((entry, i) => entry !== a[i])) changed.push(key)
  }
  return changed
}

function everyDatedKey(): string[] {
  return Array.from(
    new Set(
      (useTimeTrackingStore.getState().entries ?? [])
        .map((entry) => entry.date)
        .concat(Object.keys(useHabitsStore.getState().weeklyData)),
    ),
  )
}

function dailyHabits(tasks: WeeklyTask[]): WeeklyTask[] {
  return tasks.filter((task) => (task.frequency || "daily") === "daily")
}

/** Activity scope whose Occupancy % feeds coverage habits. */
function activityScopeId(): string {
  const state = useTimeTrackingStore.getState()
  return state.scopes?.some((s) => s.id === COVERAGE_HABIT_SCOPE_ID)
    ? COVERAGE_HABIT_SCOPE_ID
    : state.scopes?.[0]?.id ?? COVERAGE_HABIT_SCOPE_ID
}

/** Activity Occupancy for the period — Tracking's "% of the day|week" on Activity. */
function activityWindow(dateKeys: string[]): { coverage: number; minutes: number } {
  const state = useTimeTrackingStore.getState()
  const entries = state.entries ?? []
  const scopeId = activityScopeId()
  const scoped = entriesInRange(entries, dateKeys, scopeId)
  return {
    coverage: activityOccupancyCoverage(entries, dateKeys, scopeId),
    minutes: uniqueMinutes(scoped, dateKeys),
  }
}

function writeCoverage(
  task: WeeklyTask,
  periodKey: string,
  anchor: Date,
  coverage: number,
  minutes: number,
  threshold: number,
): void {
  const habits = useHabitsStore.getState()
  const frequency = task.frequency || "daily"
  const bucket =
    frequency === "weekly"
      ? habits.weeklyHabitData
      : frequency === "monthly"
        ? habits.monthlyHabitData
        : frequency === "quarterly"
          ? habits.quarterlyHabitData
          : habits.weeklyData
  const previous = bucket[periodKey]?.[task.id]
  // No Activity minutes is silence, not 0%. A stored false/true flag is withdrawn
  // so the percent cannot stay stuck after the paint is erased.
  if (minutes <= 0) {
    const cleared = clearCoverageObservation(previous)
    if (!cleared) return
    applyPeriodCompletion(task, periodKey, anchor, cleared)
    return
  }
  const safe = Number.isFinite(coverage) ? coverage : 0
  const met = coverageMeetsThreshold(safe, threshold)
  // Yes/No cells store the check only. The percent lives on Goal cells.
  // Unmet is explicit false — deleting the flag never survived the store merge,
  // so a later pass kept treating the old check as live.
  const extras =
    task.type === TaskType.BOOLEAN
      ? undefined
      : { value: Math.round(safe * 10) / 10, goal: clampCoverageThreshold(threshold) }
  const next = applyCoverageObservation(previous, met, extras)
  if (!next) return
  applyPeriodCompletion(task, periodKey, anchor, next)
}

function applyPeriodCompletion(task: WeeklyTask, periodKey: string, anchor: Date, completion: TaskCompletion): void {
  const frequency = task.frequency || "daily"
  const store = useHabitsStore.getState()
  if (frequency === "weekly") store.updateWeeklyHabitCompletion(task.id, anchor, completion)
  else if (frequency === "monthly") store.updateMonthlyHabitCompletion(task.id, anchor, completion)
  else if (frequency === "quarterly") store.updateQuarterlyHabitCompletion(task.id, anchor, completion)
  else store.updateCompletion(task.id, anchor, completion)
  void periodKey
}

function syncCoverageHabits(dateKeys: string[]): void {
  const tasks = useHabitsStore.getState().tasks.filter((task) => effectiveCoverageLink(task))
  if (!tasks.length || !dateKeys.length) return
  for (const task of tasks) {
    const link = effectiveCoverageLink(task)
    if (!link) continue
    const threshold = clampCoverageThreshold(link.threshold)
    for (const period of periodWindowsForFrequency(task.frequency, dateKeys)) {
      const window = activityWindow(period.keys)
      writeCoverage(task, period.periodKey, period.anchor, window.coverage, window.minutes, threshold)
    }
  }
}

/** Weeks to recompute. No date list means every week that already has cells. */
function weekKeysForDailyFloor(dateKeys: string[] | undefined): string[] {
  const habits = useHabitsStore.getState()
  if (!dateKeys) {
    const weekKeys = new Set<string>()
    for (const key of Object.keys(habits.weeklyData)) {
      const date = parseLocalDate(key)
      if (date) weekKeys.add(getWeekString(getWeekStartDate(date)))
    }
    for (const key of Object.keys(habits.weeklyHabitData)) weekKeys.add(key)
    return [...weekKeys]
  }
  const weekKeys = new Set<string>()
  for (const key of dateKeys) {
    const date = parseLocalDate(key)
    if (!date) continue
    weekKeys.add(getWeekString(getWeekStartDate(date)))
  }
  return [...weekKeys]
}

function syncDailyFloorHabits(dateKeys?: string[]): void {
  const habits = useHabitsStore.getState()
  const linked = habits.tasks.filter((task) => effectiveDailyFloorLink(task))
  if (!linked.length) return
  const dailyTasks = dailyHabits(habits.tasks)
  const ctx = currentExemptionContext()
  const weekKeys = weekKeysForDailyFloor(dateKeys)

  for (const task of linked) {
    const link = effectiveDailyFloorLink(task)
    if (!link) continue
    const floor = link.floorPercent ?? 0
    const allowAtZero = link.allowAtZero ?? 0
    for (const weekKey of weekKeys) {
      const dates = weekDatesForKey(weekKey)
      if (!dates) continue
      const met = dailyHabitsClearFloor(
        dailyTasks,
        habits.weeklyData,
        dates,
        floor,
        (daily, dateKey) => isExemptKind(exemptionKind(daily, dateKey, "daily", habits.habitExemptions, ctx)),
        allowAtZero,
      )
      const previous = habits.weeklyHabitData[weekKey]?.[task.id]
      const next = applyLinkedFlag(previous, "dailyFloorCompleted", met)
      if (!next) continue
      const monday = dates[0]
      habits.updateWeeklyHabitCompletion(task.id, monday, next)
    }
  }
}

let coverageSyncDepth = 0
let coverageSyncAgain = false

function runHabitCoverageSync(dateKeys?: string[]): void {
  const keys = dateKeys ?? everyDatedKey()
  if (keys.length) syncCoverageHabits(keys)
  syncDailyFloorHabits(dateKeys)
}

/**
 * Recompute coverage + daily-floor links.
 * Pass the dates a tracking edit touched. Omit them for a full rescan (boot,
 * habit edit, explicit invalidate). Store writes notify the habits subscriber,
 * which calls this again. Nested calls only mark a follow-up on the same
 * dates — widening that follow-up used to rescan the whole book after every
 * stroke. The follow-up is capped so a cell that cannot settle cannot recurse.
 */
export function syncHabitCoverageLinks(dateKeys?: string[]): void {
  withoutUndo(() => {
    if (coverageSyncDepth > 0) {
      coverageSyncAgain = true
      return
    }
    coverageSyncDepth += 1
    try {
      for (let pass = 0; pass < 3; pass++) {
        coverageSyncAgain = false
        runHabitCoverageSync(dateKeys)
        if (!coverageSyncAgain) break
      }
    } finally {
      coverageSyncDepth = 0
      coverageSyncAgain = false
    }
  })
}

const coverageSyncSlot: HydratedStoreSyncSlot = { stopper: null }

export function startHabitCoverageSync(): () => void {
  return startHydratedStoreSync({
    slot: coverageSyncSlot,
    persists: [useHabitsStore.persist, useTimeTrackingStore.persist],
    onReady: () => {
      const unTrack = useTimeTrackingStore.subscribe((state, prev) => {
        if (isRestoring()) return
        if (state.entries === prev.entries) return
        const changed = changedEntryDates(prev.entries ?? [], state.entries ?? [])
        if (changed.length) syncHabitCoverageLinks(changed)
      })
      const unHabits = useHabitsStore.subscribe((state, prev) => {
        if (isRestoring() || habitWriteIsQuiet()) return
        if (
          state.tasks !== prev.tasks ||
          state.weeklyData !== prev.weeklyData ||
          state.weeklyHabitData !== prev.weeklyHabitData
        ) {
          // A habit edit can change any period. Writes this module just made
          // re-enter the pass already running and stay on its dates.
          syncHabitCoverageLinks()
        }
      })
      syncHabitCoverageLinks()
      return () => {
        unTrack()
        unHabits()
      }
    },
  })
}

export function useHabitCoverageSync(): void {
  useEffect(() => {
    startHabitCoverageSync()
  }, [])
}
