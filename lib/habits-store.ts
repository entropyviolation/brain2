/**
 * lib/habits-store.ts — Shared daily-habits store
 *
 * Single source of truth for the weekly/daily habit tracker: habit definitions
 * (`WeeklyTask`), per-day completion data (`WeeklyData`, ISO-date keyed) and habit
 * categories. Previously this lived as local component state in
 * `habit-tracker.tsx` (localStorage keys `weekly-habits-*`); promoting it to a
 * Zustand store lets the dashboard Habit Tracker AND the Lists "Daily Habits"
 * view read/write the exact same data, so marking a habit done in one place
 * updates the other. Completing a habit awards points just like before.
 *
 * Legacy `weekly-habits-*` data is imported once on first load.
 *
 * Spec: §9 (Habit Tracker). Storage: localStorage today; target MongoDB
 * `habits` / `habitCompletions` collections (§3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { type WeeklyTask, TaskType, type TaskCompletion, type WeeklyData, type Category, type HabitFrequency } from "@/lib/types"
import { formatLocalDateKey, getWeekString } from "@/lib/date-utils"
import { format } from "date-fns"
import { usePointsStore } from "@/lib/points-store"
import { isHabitGoalMet, completionWithGoalFlag, normalizeTaskType } from "@/lib/habit-utils"

function migrateTaskTypes(tasks: WeeklyTask[]): WeeklyTask[] {
  return tasks.map((t) => ({
    ...t,
    type: normalizeTaskType(t.type),
    frequency: t.frequency || "daily",
  }))
}

export const getDefaultHabits = (): WeeklyTask[] => [
  { id: "task-1", name: "Work for at least 1 hour", type: TaskType.GOAL, goal: 60, unit: "minutes", rewardValue: 50, frequency: "daily" },
  { id: "task-2", name: "Exercise for at least 30 minutes", type: TaskType.GOAL, goal: 30, unit: "minutes", rewardValue: 30, frequency: "daily" },
  { id: "task-3", name: "Clean for at least 15 minutes", type: TaskType.GOAL, goal: 15, unit: "minutes", rewardValue: 15, frequency: "daily" },
  { id: "task-4", name: "Drink water", type: TaskType.BOOLEAN, rewardValue: 10 },
  { id: "task-5", name: "Practice language", type: TaskType.BOOLEAN, rewardValue: 20 },
  { id: "task-6", name: "Practice an instrument", type: TaskType.BOOLEAN, rewardValue: 25 },
  {
    id: "task-7",
    name: "Chess score + 10, puzzle score + 10",
    type: TaskType.INCREMENTAL,
    rewardValue: 40,
    incrementalData: { currentValues: { match: 265, puzzle: 850 }, weeklyIncrement: { match: 10, puzzle: 10 } },
  },
  { id: "task-8", name: "Write at least 3 pages per day (⅓)", type: TaskType.GOAL, goal: 3, unit: "pages", rewardValue: 30, frequency: "daily" },
  { id: "task-9", name: "Read at least 10 pages per day (+5/week)", type: TaskType.GOAL, goal: 10, unit: "pages", rewardValue: 20, frequency: "daily" },
  { id: "task-10", name: "Plan the day", type: TaskType.BOOLEAN, rewardValue: 15 },
  { id: "task-11", name: "Stretch", type: TaskType.BOOLEAN, rewardValue: 10 },
  {
    id: "task-12",
    name: "Meditate for 4 minutes (+1 minute per week)",
    type: TaskType.INCREMENTAL,
    rewardValue: 25,
    incrementalData: { currentValues: { meditation: 4 }, weeklyIncrement: { meditation: 1 } },
  },
  { id: "task-13", name: "Act of kindness", type: TaskType.BOOLEAN, rewardValue: 20 },
  { id: "task-14", name: "Do something artistic/creative", type: TaskType.TEXT, rewardValue: 30 },
]

export const getDefaultHabitCategories = (): Category[] => [
  { id: "category-1", name: "Health", color: "#8cd4a5" },
  { id: "category-2", name: "Work", color: "#8b7ecc" },
  { id: "category-3", name: "Learning", color: "#b89fbf" },
  { id: "category-4", name: "Personal", color: "#9fc2a5" },
]

interface HabitsState {
  tasks: WeeklyTask[]
  categories: Category[]
  weeklyData: WeeklyData
  /** Weekly-frequency habits keyed by week string */
  weeklyHabitData: WeeklyData
  /** Monthly-frequency habits keyed by YYYY-MM */
  monthlyHabitData: WeeklyData
  addTask: (task: WeeklyTask) => void
  updateTask: (task: WeeklyTask) => void
  deleteTask: (taskId: string) => void
  setTasks: (tasks: WeeklyTask[]) => void
  setCategories: (categories: Category[]) => void
  updateCompletion: (taskId: string, date: Date, completion: TaskCompletion) => void
  updateWeeklyHabitCompletion: (taskId: string, weekStart: Date, completion: TaskCompletion) => void
  updateMonthlyHabitCompletion: (taskId: string, monthDate: Date, completion: TaskCompletion) => void
  setWeeklyData: (data: WeeklyData) => void
  importData: (data: {
    tasks: WeeklyTask[]
    weeklyData: WeeklyData
    weeklyHabitData?: WeeklyData
    monthlyHabitData?: WeeklyData
    categories?: Category[]
  }) => void
  resetData: () => void
}

function awardPointsIfNewlyMet(
  task: WeeklyTask,
  previous: TaskCompletion | undefined,
  completion: TaskCompletion,
  date: Date,
) {
  const wasMet = previous ? isHabitGoalMet(task, previous) : false
  const nowMet = isHabitGoalMet(task, completion)
  if (nowMet && !wasMet) {
    usePointsStore.getState().addPoints(task.id, task.rewardValue || 0, task.name, date)
  }
}

function stripCompletionFromData(data: WeeklyData, taskId: string): WeeklyData {
  const next = { ...data }
  Object.keys(next).forEach((key) => {
    if (next[key]?.[taskId]) {
      const day = { ...next[key] }
      delete day[taskId]
      next[key] = day
    }
  })
  return next
}

export const useHabitsStore = create<HabitsState>()(
  persist(
    (set) => ({
      tasks: getDefaultHabits(),
      categories: getDefaultHabitCategories(),
      weeklyData: {},
      weeklyHabitData: {},
      monthlyHabitData: {},

      addTask: (task) =>
        set((state) => ({
          tasks: [...state.tasks, { ...task, type: normalizeTaskType(task.type), frequency: task.frequency || "daily" }],
        })),
      updateTask: (task) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === task.id ? { ...task, type: normalizeTaskType(task.type), frequency: task.frequency || "daily" } : t,
          ),
        })),
      deleteTask: (taskId) =>
        set((state) => ({
          tasks: state.tasks.filter((t) => t.id !== taskId),
          weeklyData: stripCompletionFromData(state.weeklyData, taskId),
          weeklyHabitData: stripCompletionFromData(state.weeklyHabitData, taskId),
          monthlyHabitData: stripCompletionFromData(state.monthlyHabitData, taskId),
        })),
      setTasks: (tasks) => set({ tasks }),
      setCategories: (categories) => set({ categories }),

      updateCompletion: (taskId, date, completion) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId)
          if (!task || (task.frequency && task.frequency !== "daily")) return state

          const dateKey = formatLocalDateKey(date)
          const weeklyData = { ...state.weeklyData }
          const day = { ...(weeklyData[dateKey] || {}) }
          const previous = day[taskId]
          const finalCompletion = completionWithGoalFlag(task, completion)
          day[taskId] = finalCompletion
          weeklyData[dateKey] = day

          if (task) awardPointsIfNewlyMet(task, previous, finalCompletion, date)
          return { weeklyData }
        }),

      updateWeeklyHabitCompletion: (taskId, weekStart, completion) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId)
          if (!task) return state
          const weekKey = getWeekString(weekStart)
          const weeklyHabitData = { ...state.weeklyHabitData }
          const bucket = { ...(weeklyHabitData[weekKey] || {}) }
          const previous = bucket[taskId]
          const finalCompletion = completionWithGoalFlag(task, completion)
          bucket[taskId] = finalCompletion
          weeklyHabitData[weekKey] = bucket
          if (task) awardPointsIfNewlyMet(task, previous, finalCompletion, weekStart)
          return { weeklyHabitData }
        }),

      updateMonthlyHabitCompletion: (taskId, monthDate, completion) =>
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId)
          if (!task) return state
          const monthKey = format(monthDate, "yyyy-MM")
          const monthlyHabitData = { ...state.monthlyHabitData }
          const bucket = { ...(monthlyHabitData[monthKey] || {}) }
          const previous = bucket[taskId]
          const finalCompletion = completionWithGoalFlag(task, completion)
          bucket[taskId] = finalCompletion
          monthlyHabitData[monthKey] = bucket
          if (task) awardPointsIfNewlyMet(task, previous, finalCompletion, monthDate)
          return { monthlyHabitData }
        }),

      setWeeklyData: (weeklyData) => set({ weeklyData }),
      importData: (data) =>
        set({
          tasks: migrateTaskTypes(data.tasks),
          weeklyData: data.weeklyData,
          weeklyHabitData: data.weeklyHabitData ?? {},
          monthlyHabitData: data.monthlyHabitData ?? {},
          categories: data.categories ?? getDefaultHabitCategories(),
        }),
      resetData: () => set({ tasks: [], weeklyData: {}, weeklyHabitData: {}, monthlyHabitData: {}, categories: [] }),
    }),
    {
      name: "cogs-habits-store",
      version: 2,
      migrate: (persisted: unknown, version) => {
        const state = persisted as HabitsState
        if (version < 2 && state.tasks) {
          state.tasks = migrateTaskTypes(state.tasks)
          state.weeklyHabitData = state.weeklyHabitData ?? {}
          state.monthlyHabitData = state.monthlyHabitData ?? {}
        }
        return state as HabitsState
      },
    },
  ),
)

// One-time migration of legacy localStorage data into the store.
if (typeof window !== "undefined") {
  try {
    const alreadyMigrated = localStorage.getItem("cogs-habits-migrated")
    const hasStore = localStorage.getItem("cogs-habits-store")
    if (!alreadyMigrated && !hasStore) {
      const lt = localStorage.getItem("weekly-habits-tasks")
      const lw = localStorage.getItem("weekly-habits-weeklyData")
      const lc = localStorage.getItem("weekly-habits-categories")
      if (lt || lw || lc) {
        useHabitsStore.getState().importData({
          tasks: lt && lt !== "[]" ? JSON.parse(lt) : getDefaultHabits(),
          weeklyData: lw && lw !== "{}" ? JSON.parse(lw) : {},
          categories: lc && lc !== "[]" ? JSON.parse(lc) : getDefaultHabitCategories(),
        })
      }
    }
    localStorage.setItem("cogs-habits-migrated", "1")
  } catch {
    // ignore migration errors; defaults remain in place
  }
}
