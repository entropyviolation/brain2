/**
 * lib/habit-helper/accept.ts — Read the habits into a context, and write approved proposals
 *
 * `buildContext` reads daily habits from `useHabitsStore` (not paused today, 60 days of cells) and the
 * Tracking tag names that fill them. `briefOf` is the pure part, so tests and the lab build the same thing.
 * `applyProposals` is the only writer: a cell through `updateCompletion`, a shorthand through `updateTask`.
 * Nothing calls it until the person approves a row or presses Accept all.
 */
"use client"

import { formatLocalDateKey, parseLocalDate } from "@/lib/date-utils"
import { keywordPhrases } from "@/lib/habit-keyword-source"
import { activeTrackingLink } from "@/lib/habit-tracking"
import { isHabitGoalMet, isGoalType, normalizeTaskType } from "@/lib/habit-utils"
import { useHabitsStore } from "@/lib/habits-store"
import { useTimeTrackingStore } from "@/lib/time-tracking-store"
import { TaskType, type TaskCompletion, type WeeklyData, type WeeklyTask } from "@/lib/types"
import type { CellBrief, HabitBrief, HelperContext, Proposal } from "./types"
import { unitOf } from "./words"

export const HABIT_HELPER_SURFACE = "habit-helper"

/** A habit's unit as `[unit, per]`: its own unit field first, else the unit after a number in its name. */
export function unitOfHabit(task: Pick<WeeklyTask, "unit" | "name">): { unit?: string; per?: number } {
  const own = task.unit?.trim() ? unitOf(task.unit.trim().split(/\s+/)[0]!) : null
  const named = /\d+(?:\.\d+)?\s*([a-z]+)/i.exec(task.name)
  const u = own ?? (named ? unitOf(named[1]!) : null)
  if (!u) return {}
  return { unit: u[0], ...(u[1] !== 1 ? { per: u[1] } : {}) }
}

export function cellBrief(task: WeeklyTask, c: TaskCompletion): CellBrief {
  const notes = (c.changes ?? []).map((x) => x.note).filter((x): x is string => !!x?.trim())
  return {
    met: isHabitGoalMet(task, c),
    ...(c.completed !== undefined ? { completed: c.completed } : {}),
    ...(c.value !== undefined ? { value: c.value } : {}),
    ...(c.text ? { text: c.text } : {}),
    ...(c.missedOpportunity ? { missed: true } : {}),
    ...(c.missReason ? { reason: c.missReason } : {}),
    ...(notes.length ? { notes } : {}),
    ...(c.updatedAt ? { at: c.updatedAt } : {}),
  }
}

/** One daily habit as the helper sees it. `tagName` turns a Tracking tag id into its name. */
export function briefOf(task: WeeklyTask, data: WeeklyData, tagName: (id: string) => string | undefined, since?: string): HabitBrief {
  const type = normalizeTaskType(task.type)
  const days: Record<string, CellBrief> = {}
  for (const [day, row] of Object.entries(data)) {
    if (since && day < since) continue
    const c = row[task.id]
    if (c) days[day] = cellBrief(task, c)
  }
  const link = activeTrackingLink(task)
  const tagWords = (link?.tagIds ?? []).map(tagName).filter((x): x is string => !!x)
  return {
    id: task.id,
    name: task.name,
    ...(task.shorthandName?.trim() ? { shorthand: task.shorthandName.trim() } : {}),
    kind: type === TaskType.BOOLEAN ? "yesno" : type === TaskType.TEXT ? "text" : isGoalType(type) || type === TaskType.INCREMENTAL ? "goal" : "yesno",
    ...(task.goal ? { goal: task.goal } : {}),
    ...unitOfHabit(task),
    words: [...new Set([...keywordPhrases(task), ...tagWords])],
    ...(task.createdAt ? { since: task.createdAt.slice(0, 10) } : {}),
    ...(task.pauses?.length ? { pauses: task.pauses } : {}),
    days,
  }
}

export function buildContext(now = new Date(), lookback = 60): HelperContext {
  const { tasks, weeklyData } = useHabitsStore.getState()
  const tags = useTimeTrackingStore.getState().tags ?? []
  const tagName = (id: string) => tags.find((t) => t.id === id)?.name
  const since = formatLocalDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - lookback))
  const habits = tasks.filter((t) => (t.frequency || "daily") === "daily").map((t) => briefOf(t, weeklyData, tagName, since))
  return { now, habits }
}

export interface ApplyResult {
  wrote: string[]
  message: string
}

/** Write approved proposals. Each one is a store call the person could have made by hand. */
export function applyProposals(list: Proposal[]): ApplyResult {
  const store = useHabitsStore.getState()
  const wrote: string[] = []
  for (const p of list) {
    if (p.kind === "shorthand") {
      const task = store.tasks.find((t) => t.id === p.habitId)
      const name = p.shorthand?.trim()
      if (!task || !name) continue
      // TODO(A): pass `source: "llm-suggestion"` once session A's store takes a source.
      store.updateTask({ ...task, shorthandName: name })
      wrote.push(p.id)
      continue
    }
    const date = p.day ? parseLocalDate(p.day) : null
    if (!date || !p.write) continue
    // TODO(A): pass `source: "llm-suggestion"` (and the reason as the change's `note`) once session A's
    // `updateCompletion` takes a source and appends `HabitCellChange`s.
    store.updateCompletion(p.habitId, date, p.write)
    wrote.push(p.id)
  }
  return { wrote, message: wrote.length ? `Saved ${wrote.length} ${wrote.length === 1 ? "change" : "changes"}.` : "Nothing saved." }
}
