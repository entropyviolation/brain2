/**
 * lib/habit-sort.ts — Habit row order (default / A–Z / created / priority / %)
 *
 * Extends `sortHabitsByPriority` with the sidebar sort plate. Default is the
 * store's existing array order (what you see with priority off). Completion %
 * is the same rightmost-column metric the grid already shows.
 */
import { stampedHabitCreatedMs } from "./habit-exemption"
import type { HabitFrequency, WeeklyData, WeeklyTask } from "./types"
import { sortHabitsByPriority } from "./habit-priority"

export const HABIT_SORT_MODES = [
  "default",
  "alphabetical",
  "created",
  "priority",
  "weeklyCompletion",
] as const

export type HabitSortMode = (typeof HABIT_SORT_MODES)[number]

export const HABIT_SORT_LABELS: Record<HabitSortMode, string> = {
  default: "Default",
  alphabetical: "Alphabetical",
  created: "Date created",
  priority: "Priority",
  weeklyCompletion: "Weekly completion %",
}

export function parseHabitSortMode(raw: unknown): HabitSortMode | null {
  return HABIT_SORT_MODES.includes(raw as HabitSortMode) ? (raw as HabitSortMode) : null
}

/** Persist v10: named mode. Older boolean flag: true → priority, false → default. */
export function migrateHabitSortMode(state: {
  habitSortMode?: unknown
  sortHabitsByPriorityFlag?: unknown
}): HabitSortMode {
  return parseHabitSortMode(state.habitSortMode) ?? (state.sortHabitsByPriorityFlag ? "priority" : "default")
}

/** ISO `createdAt`, else `task-{unixMs}` ids, else original index (seed order). */
export function habitCreatedAtMs(task: WeeklyTask, index: number): number {
  if (task.createdAt) {
    const t = new Date(task.createdAt).getTime()
    if (Number.isFinite(t)) return t
  }
  return stampedHabitCreatedMs(task.id) ?? index
}

/** Historical direction when the user has not picked one: newest, highest %, pin-first. */
export function naturalSortDescending(mode: HabitSortMode): boolean {
  return mode === "created" || mode === "weeklyCompletion" || mode === "priority"
}

export function effectiveSortDescending(mode: HabitSortMode, direction: "asc" | "desc" | null | undefined): boolean {
  if (direction === "asc") return false
  if (direction === "desc") return true
  return naturalSortDescending(mode)
}

export function sortHabits<T extends WeeklyTask>(
  tasks: T[],
  mode: HabitSortMode,
  opts: {
    data: WeeklyData
    asOf: Date
    frequency: HabitFrequency
    completionPercent: (taskId: string) => number
    /** Low → high when false. Omit to keep each mode's usual order. */
    descending?: boolean
  },
): T[] {
  const descending = opts.descending ?? naturalSortDescending(mode)
  if (mode === "default") return descending ? [...tasks].reverse() : tasks
  if (mode === "priority") {
    const sorted = sortHabitsByPriority(tasks, opts.data, opts.asOf, opts.frequency)
    return descending ? sorted : [...sorted].reverse()
  }
  const sorted = [...tasks]
    .map((task, index) => ({ task, index }))
    .sort((a, b) => {
      if (mode === "alphabetical") {
        return a.task.name.localeCompare(b.task.name, undefined, { sensitivity: "base" }) || a.index - b.index
      }
      if (mode === "created") {
        return habitCreatedAtMs(a.task, a.index) - habitCreatedAtMs(b.task, b.index) || a.index - b.index
      }
      return opts.completionPercent(a.task.id) - opts.completionPercent(b.task.id) || a.index - b.index
    })
    .map((row) => row.task)
  return descending ? [...sorted].reverse() : sorted
}
