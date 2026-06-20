/**
 * lib/points-store.ts — Points ledger store
 *
 * Zustand store for the gamification layer: an append-only `PointsEntry[]` ledger
 * (date, taskId, points, description) persisted to localStorage under
 * `points-store`. Provides total/day/week/month sums of earned points and
 * "possible points" projections from not-yet-completed scheduled tasks (used by
 * the Home dashboard's Points Stats).
 *
 * Spec: §14 (Points, Rewards & Regret). Missing vs. spec: objective
 * point sources, configurable multipliers, and regret accrual — see
 * docs/SPEC_MAPPING.md §14. Storage: localStorage today; target MongoDB
 * `pointsLedger` collection (§3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { formatDateKey } from "./date-utils"
import { startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns"

interface PointsEntry {
  date: string // YYYY-MM-DD
  taskId: string
  points: number
  taskDescription: string
}

interface PointsStore {
  pointsHistory: PointsEntry[]
  addPoints: (taskId: string, points: number, taskDescription: string, date?: Date) => void
  getTotalPoints: () => number
  getDayPoints: (date: Date) => number
  getWeekPoints: (date: Date) => number
  getMonthPoints: (date: Date) => number
  getPossibleDayPoints: (date: Date, tasks: any[]) => number
  getPossibleWeekPoints: (date: Date, tasks: any[]) => number
  getPossibleMonthPoints: (date: Date, tasks: any[]) => number
}

export const usePointsStore = create<PointsStore>()(
  persist(
    (set, get) => ({
      pointsHistory: [],

      addPoints: (taskId: string, points: number, taskDescription: string, date = new Date()) => {
        const entry: PointsEntry = {
          date: formatDateKey(date),
          taskId,
          points,
          taskDescription,
        }

        set((state) => ({
          pointsHistory: [...state.pointsHistory, entry],
        }))
      },

      getTotalPoints: () => {
        return get().pointsHistory.reduce((total, entry) => total + entry.points, 0)
      },

      getDayPoints: (date: Date) => {
        const dateKey = formatDateKey(date)
        return get()
          .pointsHistory.filter((entry) => entry.date === dateKey)
          .reduce((total, entry) => total + entry.points, 0)
      },

      getWeekPoints: (date: Date) => {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 })

        return get()
          .pointsHistory.filter((entry) => {
            const entryDate = new Date(entry.date)
            return entryDate >= weekStart && entryDate <= weekEnd
          })
          .reduce((total, entry) => total + entry.points, 0)
      },

      getMonthPoints: (date: Date) => {
        const monthStart = startOfMonth(date)
        const monthEnd = endOfMonth(date)

        return get()
          .pointsHistory.filter((entry) => {
            const entryDate = new Date(entry.date)
            return entryDate >= monthStart && entryDate <= monthEnd
          })
          .reduce((total, entry) => total + entry.points, 0)
      },

      getPossibleDayPoints: (date: Date, tasks: any[]) => {
        const dateKey = formatDateKey(date)
        return tasks
          .filter(
            (task) => !task.completed && task.scheduledDate && formatDateKey(new Date(task.scheduledDate)) === dateKey,
          )
          .reduce((total, task) => total + (task.rewardValue || 0), 0)
      },

      getPossibleWeekPoints: (date: Date, tasks: any[]) => {
        const weekStart = startOfWeek(date, { weekStartsOn: 1 })
        const weekEnd = endOfWeek(date, { weekStartsOn: 1 })

        return tasks
          .filter((task) => {
            if (!task.scheduledDate || task.completed) return false
            const taskDate = new Date(task.scheduledDate)
            return taskDate >= weekStart && taskDate <= weekEnd
          })
          .reduce((total, task) => total + (task.rewardValue || 0), 0)
      },

      getPossibleMonthPoints: (date: Date, tasks: any[]) => {
        const monthStart = startOfMonth(date)
        const monthEnd = endOfMonth(date)

        return tasks
          .filter((task) => {
            if (!task.scheduledDate || task.completed) return false
            const taskDate = new Date(task.scheduledDate)
            return taskDate >= monthStart && taskDate <= monthEnd
          })
          .reduce((total, task) => total + (task.rewardValue || 0), 0)
      },
    }),
    {
      name: "points-store",
    },
  ),
)
