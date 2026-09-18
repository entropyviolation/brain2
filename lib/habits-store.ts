/**
 * lib/habits-store.ts — Shared daily-habits store
 *
 * Single source of truth for the weekly/daily habit tracker: habit definitions
 * (`WeeklyTask`), per-day completion data (`WeeklyData`, ISO-date keyed) and habit
 * categories. Previously this lived as local component state in
 * `habit-tracker.tsx` (localStorage keys `weekly-habits-*`); promoting it to a
 * Zustand store lets the dashboard Habit Tracker AND the Lists "Daily Habits"
 * view read/write the exact same data, so marking a habit done in one place
 * updates the other. Daily habits award 50 pts × day completion (partial counts)
 * plus per-day grade bonuses (100 if either Week grade or Perfect output is 75%+,
 * 300 if both) and +50 when that day's raw column score is above 80%, via
 * `lib/habit-points.ts`. Completing a habit also writes a
 * Done-list `loggedAction` (`lib/habit-done-log.ts`).
 *
 * Persist version 5 adds `outputGradeTolerance` for Perfect Output (elapsed row %).
 * Persist version 4 adds `gradeTolerance` for the week-grade daily curve.
 * Version 3 migrates climb habits (`lib/incremental-habits.ts`): one metric per
 * habit, logs on `TaskCompletion.value`. Legacy `weekly-habits-*` data is
 * imported once on first load.
 *
 * Spec: §9 (Habit Tracker). Storage: localStorage today; target MongoDB
 * `habits` / `habitCompletions` collections (§3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { type WeeklyTask, TaskType, type TaskCompletion, type WeeklyData, type Category } from "@/lib/types"
import { formatLocalDateKey, getWeekString, getWeekStartDate, getWeekDates, parseLocalDate } from "@/lib/date-utils"
import { format } from "date-fns"
import { usePointsStore } from "@/lib/points-store"
import { isHabitGoalMet, completionWithGoalFlag, normalizeTaskType } from "@/lib/habit-utils"
import { migrateIncrementalHabits, migrateIncrementalTask } from "@/lib/incremental-habits"
import { syncHabitDoneLog } from "@/lib/habit-done-log"
import {
  calculateWeekToDateGrade,
  calculateWeekToDateOutputGrade,
  clampGradeTolerance,
  DEFAULT_GRADE_TOLERANCE,
  weekToDateDays,
} from "@/lib/calculations"
import {
  dailyHabitDayPoints,
  gradeBonusDescription,
  gradeBonusPoints,
  gradeBonusTaskId,
  habitDayPointTaskId,
  isDailyHabit,
  rawDayBonusDescription,
  rawDayBonusPoints,
  rawDayBonusTaskId,
} from "@/lib/habit-points"

function migrateTaskTypes(tasks: WeeklyTask[]): WeeklyTask[] {
  return tasks.map((t) => ({
    ...t,
    type: normalizeTaskType(t.type),
    frequency: t.frequency || "daily",
  }))
}

function migratePersistedHabits(state: HabitsState): HabitsState {
  const { tasks, weeklyData } = migrateIncrementalHabits(migrateTaskTypes(state.tasks || []), state.weeklyData || {})
  return {
    ...state,
    tasks,
    weeklyData,
    weeklyHabitData: state.weeklyHabitData ?? {},
    monthlyHabitData: state.monthlyHabitData ?? {},
  }
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
    name: "Chess match score (+10/day)",
    type: TaskType.INCREMENTAL,
    rewardValue: 20,
    unit: "rating",
    frequency: "daily",
    incrementalData: { cadence: "daily", startValue: 265, increment: 10, unit: "rating" },
  },
  {
    id: "task-7-puzzle",
    name: "Chess puzzle score (+10/day)",
    type: TaskType.INCREMENTAL,
    rewardValue: 20,
    unit: "rating",
    frequency: "daily",
    incrementalData: { cadence: "daily", startValue: 850, increment: 10, unit: "rating" },
  },
  { id: "task-8", name: "Write at least 3 pages per day (⅓)", type: TaskType.GOAL, goal: 3, unit: "pages", rewardValue: 30, frequency: "daily" },
  { id: "task-9", name: "Read at least 10 pages per day (+5/week)", type: TaskType.GOAL, goal: 10, unit: "pages", rewardValue: 20, frequency: "daily" },
  { id: "task-10", name: "Plan the day", type: TaskType.BOOLEAN, rewardValue: 15 },
  { id: "task-11", name: "Stretch", type: TaskType.BOOLEAN, rewardValue: 10 },
  {
    id: "task-12",
    name: "Meditate (+1 min/week after 4+ days)",
    type: TaskType.INCREMENTAL,
    rewardValue: 25,
    incrementalData: { cadence: "weekly", startValue: 4, increment: 1, unit: "minutes" },
    unit: "minutes",
    frequency: "daily",
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
  /** Raw daily % that counts as 100 on the week grade curve (1–100, default 100). */
  gradeTolerance: number
  setGradeTolerance: (tolerance: number) => void
  /** Raw elapsed row % that counts as 100 on the Perfect Output curve. */
  outputGradeTolerance: number
  setOutputGradeTolerance: (tolerance: number) => void
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
  weeklyData: WeeklyData,
) {
  const ctx = { date, weeklyData }
  const wasMet = previous ? isHabitGoalMet(task, previous, ctx) : false
  const nowMet = isHabitGoalMet(task, completion, ctx)
  if (nowMet && !wasMet) {
    usePointsStore.getState().addPoints(task.id, task.rewardValue || 0, task.name, date)
  }
}

function syncDailyHabitDayPoints(task: WeeklyTask, date: Date, weeklyData: WeeklyData) {
  const dateKey = formatLocalDateKey(date)
  const points = dailyHabitDayPoints(task, weeklyData[dateKey]?.[task.id], weeklyData, date)
  usePointsStore.getState().upsertPoints(habitDayPointTaskId(task.id, dateKey), points, task.name, date)
}

function syncGradeBonusesForWeek(anchor: Date, state: Pick<HabitsState, "tasks" | "weeklyData" | "gradeTolerance" | "outputGradeTolerance">) {
  const weekDates = getWeekDates(getWeekStartDate(anchor))
  const now = new Date()
  const asOf = now.getTime() > anchor.getTime() ? now : anchor
  const elapsed = weekToDateDays(weekDates, asOf)
  const daily = state.tasks.filter(isDailyHabit)
  const upsert = usePointsStore.getState().upsertPoints
  for (const day of elapsed) {
    const weekGrade = calculateWeekToDateGrade(daily, state.weeklyData, weekDates, day, state.gradeTolerance)
    const outputGrade = calculateWeekToDateOutputGrade(
      daily,
      state.weeklyData,
      weekDates,
      day,
      state.outputGradeTolerance,
    )
    const bonus = gradeBonusPoints(weekGrade.grade, outputGrade.grade)
    const dateKey = formatLocalDateKey(day)
    upsert(gradeBonusTaskId(dateKey), bonus, gradeBonusDescription(bonus), day)
    const rawDay = weekGrade.days.find((d) => d.dateKey === dateKey)?.raw ?? 0
    const rawBonus = rawDayBonusPoints(rawDay)
    upsert(rawDayBonusTaskId(dateKey), rawBonus, rawDayBonusDescription(rawBonus), day)
  }
}

function syncGradeBonusesFromState(state: HabitsState, extraAnchor?: Date) {
  const seen = new Set<string>()
  const anchors: Date[] = [new Date()]
  if (extraAnchor) anchors.push(extraAnchor)
  for (const key of Object.keys(state.weeklyData || {})) {
    const parsed = parseLocalDate(key)
    if (parsed) anchors.push(parsed)
  }
  for (const anchor of anchors) {
    const weekKey = getWeekString(anchor)
    if (seen.has(weekKey)) continue
    seen.add(weekKey)
    syncGradeBonusesForWeek(anchor, state)
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
    (set, get) => ({
      tasks: getDefaultHabits(),
      categories: getDefaultHabitCategories(),
      weeklyData: {},
      weeklyHabitData: {},
      monthlyHabitData: {},
      gradeTolerance: DEFAULT_GRADE_TOLERANCE,
      setGradeTolerance: (tolerance) => {
        set({ gradeTolerance: clampGradeTolerance(tolerance) })
        syncGradeBonusesFromState(get())
      },
      outputGradeTolerance: DEFAULT_GRADE_TOLERANCE,
      setOutputGradeTolerance: (tolerance) => {
        set({ outputGradeTolerance: clampGradeTolerance(tolerance) })
        syncGradeBonusesFromState(get())
      },

      addTask: (task) =>
        set((state) => ({
          tasks: [...state.tasks, migrateIncrementalTask({ ...task, type: normalizeTaskType(task.type), frequency: task.frequency || "daily" })],
        })),
      updateTask: (task) =>
        set((state) => ({
          tasks: state.tasks.map((t) =>
            t.id === task.id
              ? migrateIncrementalTask({ ...task, type: normalizeTaskType(task.type), frequency: task.frequency || "daily" })
              : t,
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

      updateCompletion: (taskId, date, completion) => {
        let sync:
          | { task: WeeklyTask; previous: TaskCompletion | undefined; final: TaskCompletion; priorData: WeeklyData }
          | undefined
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId)
          if (!task || (task.frequency && task.frequency !== "daily")) return state

          const dateKey = formatLocalDateKey(date)
          const weeklyData = { ...state.weeklyData }
          const day = { ...(weeklyData[dateKey] || {}) }
          const previous = day[taskId]
          const finalCompletion = completionWithGoalFlag(task, completion, { date, weeklyData: state.weeklyData })
          day[taskId] = finalCompletion
          weeklyData[dateKey] = day
          sync = { task, previous, final: finalCompletion, priorData: state.weeklyData }
          return { weeklyData }
        })
        if (sync) {
          syncDailyHabitDayPoints(sync.task, date, get().weeklyData)
          syncGradeBonusesFromState(get(), date)
          syncHabitDoneLog(sync.task, date, sync.previous, sync.final, sync.priorData)
        }
      },

      updateWeeklyHabitCompletion: (taskId, weekStart, completion) => {
        let sync:
          | { task: WeeklyTask; previous: TaskCompletion | undefined; final: TaskCompletion; priorData: WeeklyData }
          | undefined
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId)
          if (!task) return state
          const weekKey = getWeekString(weekStart)
          const weeklyHabitData = { ...state.weeklyHabitData }
          const bucket = { ...(weeklyHabitData[weekKey] || {}) }
          const previous = bucket[taskId]
          const finalCompletion = completionWithGoalFlag(task, completion, { date: weekStart, weeklyData: state.weeklyHabitData })
          bucket[taskId] = finalCompletion
          weeklyHabitData[weekKey] = bucket
          sync = { task, previous, final: finalCompletion, priorData: state.weeklyHabitData }
          return { weeklyHabitData }
        })
        if (sync) {
          awardPointsIfNewlyMet(sync.task, sync.previous, sync.final, weekStart, sync.priorData)
          syncHabitDoneLog(sync.task, weekStart, sync.previous, sync.final, sync.priorData)
        }
      },

      updateMonthlyHabitCompletion: (taskId, monthDate, completion) => {
        let sync:
          | { task: WeeklyTask; previous: TaskCompletion | undefined; final: TaskCompletion; priorData: WeeklyData }
          | undefined
        set((state) => {
          const task = state.tasks.find((t) => t.id === taskId)
          if (!task) return state
          const monthKey = format(monthDate, "yyyy-MM")
          const monthlyHabitData = { ...state.monthlyHabitData }
          const bucket = { ...(monthlyHabitData[monthKey] || {}) }
          const previous = bucket[taskId]
          const finalCompletion = completionWithGoalFlag(task, completion, { date: monthDate, weeklyData: state.monthlyHabitData })
          bucket[taskId] = finalCompletion
          monthlyHabitData[monthKey] = bucket
          sync = { task, previous, final: finalCompletion, priorData: state.monthlyHabitData }
          return { monthlyHabitData }
        })
        if (sync) {
          awardPointsIfNewlyMet(sync.task, sync.previous, sync.final, monthDate, sync.priorData)
          syncHabitDoneLog(sync.task, monthDate, sync.previous, sync.final, sync.priorData)
        }
      },

      setWeeklyData: (weeklyData) => set({ weeklyData }),
      importData: (data) => {
        const migrated = migrateIncrementalHabits(migrateTaskTypes(data.tasks), data.weeklyData)
        set({
          tasks: migrated.tasks,
          weeklyData: migrated.weeklyData,
          weeklyHabitData: data.weeklyHabitData ?? {},
          monthlyHabitData: data.monthlyHabitData ?? {},
          categories: data.categories ?? getDefaultHabitCategories(),
        })
      },
      resetData: () =>
        set((state) => ({
          tasks: [],
          weeklyData: {},
          weeklyHabitData: {},
          monthlyHabitData: {},
          categories: [],
          gradeTolerance: state.gradeTolerance,
          outputGradeTolerance: state.outputGradeTolerance,
        })),
    }),
    {
      name: "cogs-habits-store",
      version: 5,
      storage: createCogsJSONStorage(),
      migrate: (persisted: unknown, version) => {
        let state = persisted as HabitsState
        if (version < 3) {
          state = migratePersistedHabits(state) as HabitsState
        }
        if (version < 2 && state.tasks) {
          state.tasks = migrateTaskTypes(state.tasks)
          state.weeklyHabitData = state.weeklyHabitData ?? {}
          state.monthlyHabitData = state.monthlyHabitData ?? {}
        }
        return {
          ...state,
          gradeTolerance: clampGradeTolerance(state.gradeTolerance ?? DEFAULT_GRADE_TOLERANCE),
          outputGradeTolerance: clampGradeTolerance(
            state.outputGradeTolerance ?? DEFAULT_GRADE_TOLERANCE,
          ),
        } as HabitsState
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
