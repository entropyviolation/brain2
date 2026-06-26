/**
 * lib/regret-store.ts — Regret ledger store (Feature 7, Worker G)
 *
 * Zustand store mirroring `lib/points-store.ts`, but for the *opposite* signal:
 * an append-only `RegretEntry[]` ledger that accrues the **cost of not having
 * done** important/overdue items. Where points reward completion, regret
 * accrues each day an important item slips past its due date. Persisted to
 * localStorage under `regret-store`.
 *
 * The accrual math is pure and exported (`regretCost`, `dailyRegretIncrement`,
 * `projectedRegret`, …) so it can be unit-tested without the store. Daily
 * accrual is idempotent per task per day: re-running `accrueOverdue` on the
 * same day never double-counts, and the cumulative ledger for a task equals its
 * `regretCost` (= daysOverdue × weight).
 *
 * Spec: §14 (Points, Rewards & Regret) — the regret-accrual half. Storage:
 * localStorage today; target MongoDB `regretLedger` collection (§3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { formatDateKey } from "./date-utils"
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"
import type { Task, BlockedReason } from "@/lib/types"

export interface RegretEntry {
  date: string // YYYY-MM-DD
  taskId: string
  regret: number
  taskDescription: string
  /** Optional structured "why blocked/skipped" reason (HM3). */
  reason?: BlockedReason
}

// ---------------------------------------------------------------------------
// Pure accrual helpers (no store dependency — unit-testable in isolation).
// ---------------------------------------------------------------------------

const MS_PER_DAY = 24 * 60 * 60 * 1000

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function toDate(value: Date | string | undefined | null): Date | null {
  if (!value) return null
  const d = typeof value === "string" ? new Date(value) : value
  return isNaN(d.getTime()) ? null : d
}

/**
 * The date an item was "due". Prefers an explicit `deadline`, then a
 * `mustBeDoneBefore` scheduling constraint, then the scheduled day. Returns
 * null when the item carries no due signal (and therefore accrues no regret).
 */
export function dueDateOf(task: Task): Date | null {
  return (
    toDate(task.deadline) ??
    toDate(task.schedulingConstraints?.mustBeDoneBefore) ??
    toDate(task.scheduledDate)
  )
}

/** Whole days the item is past due as of `asOf` (0 if not yet due / no due date). */
export function daysOverdue(task: Task, asOf: Date = new Date()): number {
  const due = dueDateOf(task)
  if (!due) return 0
  const diff = startOfDay(asOf).getTime() - startOfDay(due).getTime()
  if (diff <= 0) return 0
  return Math.floor(diff / MS_PER_DAY)
}

/**
 * How much regret a single overdue day costs for this item. The weight blends
 * importance + urgency (1-5 each); items with neither but a positive
 * `rewardValue` still count (forgone reward), and everything else gets a
 * minimum weight of 1 so any overdue item registers.
 */
export function dailyRegretIncrement(task: Task): number {
  const importance = task.importance ?? 0
  const urgency = task.urgency ?? 0
  const reward = task.rewardValue ?? 0
  const weight = importance + urgency + reward
  return weight > 0 ? weight : 1
}

/**
 * Total regret an item has accrued by `asOf`: completed items cost nothing,
 * otherwise daysOverdue × per-day weight. Equals the sum of the per-day
 * increments `accrueOverdue` records, so the ledger and this projection agree.
 */
export function regretCost(task: Task, asOf: Date = new Date()): number {
  if (task.completed) return 0
  const days = daysOverdue(task, asOf)
  if (days <= 0) return 0
  return days * dailyRegretIncrement(task)
}

/** Outstanding regret across a task snapshot as of `asOf`. */
export function projectedRegret(tasks: Task[], asOf: Date = new Date()): number {
  return tasks.reduce((total, t) => total + regretCost(t, asOf), 0)
}

interface RegretStore {
  regretHistory: RegretEntry[]
  /** Append a regret entry directly (e.g. a deliberately skipped item). */
  addRegret: (
    taskId: string,
    regret: number,
    taskDescription: string,
    date?: Date,
    reason?: BlockedReason,
  ) => void
  /**
   * Accrue one day's regret increment for every overdue, incomplete item in the
   * snapshot. Idempotent per task per day: skips any task that already has an
   * entry on `asOf`'s date key. Returns the task ids that accrued this call.
   */
  accrueOverdue: (tasks: Task[], asOf?: Date) => string[]
  removeTaskRegret: (taskId: string) => void
  clearRegret: () => void
  getTotalRegret: () => number
  getDayRegret: (date: Date) => number
  getWeekRegret: (date: Date) => number
  getMonthRegret: (date: Date) => number
  /** Outstanding (not-yet-accrued) regret projected from a task snapshot. */
  getProjectedRegret: (tasks: Task[], asOf?: Date) => number
  /** Per-task regret totals, highest first. */
  getTopRegretTasks: (limit?: number) => { taskId: string; taskDescription: string; regret: number }[]
  /** Regret totals grouped by structured blocked reason. */
  getRegretByReason: () => Record<string, number>
}

/** Parse a `YYYY-MM-DD` ledger key in local time (avoids UTC-shift edge cases). */
function parseDateKey(key: string): Date {
  return new Date(`${key}T00:00:00`)
}

function sumInRange(entries: RegretEntry[], start: Date, end: Date): number {
  return entries
    .filter((entry) => {
      const d = parseDateKey(entry.date)
      return d >= start && d <= end
    })
    .reduce((total, entry) => total + entry.regret, 0)
}

export const useRegretStore = create<RegretStore>()(
  persist(
    (set, get) => ({
      regretHistory: [],

      addRegret: (taskId, regret, taskDescription, date = new Date(), reason) => {
        const entry: RegretEntry = {
          date: formatDateKey(date),
          taskId,
          regret,
          taskDescription,
          ...(reason ? { reason } : {}),
        }
        set((state) => ({ regretHistory: [...state.regretHistory, entry] }))
      },

      accrueOverdue: (tasks, asOf = new Date()) => {
        const dateKey = formatDateKey(asOf)
        const existing = get().regretHistory
        const accruedTodayFor = new Set(
          existing.filter((e) => e.date === dateKey).map((e) => e.taskId),
        )

        const newEntries: RegretEntry[] = []
        for (const task of tasks) {
          if (task.completed) continue
          if (accruedTodayFor.has(task.id)) continue
          if (daysOverdue(task, asOf) <= 0) continue
          newEntries.push({
            date: dateKey,
            taskId: task.id,
            regret: dailyRegretIncrement(task),
            taskDescription: task.description,
          })
        }

        if (newEntries.length > 0) {
          set((state) => ({ regretHistory: [...state.regretHistory, ...newEntries] }))
        }
        return newEntries.map((e) => e.taskId)
      },

      removeTaskRegret: (taskId) =>
        set((state) => ({ regretHistory: state.regretHistory.filter((e) => e.taskId !== taskId) })),

      clearRegret: () => set({ regretHistory: [] }),

      getTotalRegret: () => get().regretHistory.reduce((total, e) => total + e.regret, 0),

      getDayRegret: (date) => {
        const dateKey = formatDateKey(date)
        return get()
          .regretHistory.filter((e) => e.date === dateKey)
          .reduce((total, e) => total + e.regret, 0)
      },

      getWeekRegret: (date) =>
        sumInRange(
          get().regretHistory,
          startOfWeek(date, { weekStartsOn: 1 }),
          endOfWeek(date, { weekStartsOn: 1 }),
        ),

      getMonthRegret: (date) => sumInRange(get().regretHistory, startOfMonth(date), endOfMonth(date)),

      getProjectedRegret: (tasks, asOf = new Date()) => projectedRegret(tasks, asOf),

      getTopRegretTasks: (limit = 10) => {
        const byTask = new Map<string, { taskId: string; taskDescription: string; regret: number }>()
        for (const e of get().regretHistory) {
          const prev = byTask.get(e.taskId)
          if (prev) {
            prev.regret += e.regret
            prev.taskDescription = e.taskDescription
          } else {
            byTask.set(e.taskId, { taskId: e.taskId, taskDescription: e.taskDescription, regret: e.regret })
          }
        }
        return [...byTask.values()].sort((a, b) => b.regret - a.regret).slice(0, limit)
      },

      getRegretByReason: () => {
        const out: Record<string, number> = {}
        for (const e of get().regretHistory) {
          const key = e.reason ?? "unspecified"
          out[key] = (out[key] ?? 0) + e.regret
        }
        return out
      },
    }),
    { name: "regret-store" },
  ),
)
