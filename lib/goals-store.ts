/**
 * lib/goals-store.ts — Persisted goals with point rewards
 *
 * Storage: localStorage today; target MongoDB `goals` collection (§3).
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Goal } from "@/lib/types"
import { usePointsStore } from "@/lib/points-store"

interface GoalsState {
  goals: Goal[]
  addGoal: (goal: Omit<Goal, "id" | "createdAt" | "completed" | "current">) => void
  updateGoal: (goal: Goal) => void
  deleteGoal: (id: string) => void
  setProgress: (id: string, current: number) => void
}

const defaultGoals = (): Goal[] => [
  {
    id: "goal-read",
    title: "Read 7 books this month",
    description: "Finish at least 7 books",
    type: "count",
    target: 7,
    current: 0,
    period: "month",
    category: "Learning",
    points: 50,
    completed: false,
    createdAt: new Date(),
  },
  {
    id: "goal-surf",
    title: "Surf 10 sessions",
    description: "Get in the water 10 times",
    type: "count",
    target: 10,
    current: 0,
    period: "month",
    category: "Health",
    points: 40,
    completed: false,
    createdAt: new Date(),
  },
  {
    id: "goal-ship",
    title: "Ship Allieprime milestone",
    description: "Complete the current project milestone",
    type: "boolean",
    target: 1,
    current: 0,
    period: "week",
    category: "Work",
    points: 100,
    completed: false,
    createdAt: new Date(),
  },
]

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set, get) => ({
      goals: defaultGoals(),

      addGoal: (partial) =>
        set((state) => ({
          goals: [
            ...state.goals,
            {
              ...partial,
              id: `goal-${Date.now()}`,
              current: 0,
              completed: false,
              createdAt: new Date(),
            },
          ],
        })),

      updateGoal: (goal) =>
        set((state) => ({
          goals: state.goals.map((g) => (g.id === goal.id ? goal : g)),
        })),

      deleteGoal: (id) => set((state) => ({ goals: state.goals.filter((g) => g.id !== id) })),

      setProgress: (id, current) => {
        const goal = get().goals.find((g) => g.id === id)
        if (!goal) return
        const completed = goal.type === "boolean" ? current >= 1 : current >= goal.target
        const wasCompleted = goal.completed
        set((state) => ({
          goals: state.goals.map((g) =>
            g.id === id ? { ...g, current, completed } : g,
          ),
        }))
        if (completed && !wasCompleted && goal.points > 0) {
          usePointsStore.getState().addPoints(
            goal.id,
            goal.points,
            `Goal completed: ${goal.title}`,
            new Date(),
          )
        }
      },
    }),
    {
      name: "cogs-goals-store",
      version: 1,
      onRehydrateStorage: () => (state) => {
        if (state?.goals) {
          state.goals = state.goals.map((g) => ({
            ...g,
            createdAt: g.createdAt instanceof Date ? g.createdAt : new Date(g.createdAt),
            deadline: g.deadline
              ? g.deadline instanceof Date
                ? g.deadline
                : new Date(g.deadline)
              : undefined,
          }))
        }
      },
    },
  ),
)
