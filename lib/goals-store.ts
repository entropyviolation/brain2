/**
 * lib/goals-store.ts — Objectives & Goals store
 *
 * Objectives are all-time aspirational life directions that can be prioritized
 * per period (day/week/month/year) with a custom points multiplier. Goals are
 * quantifiable metrics over a period that serve one or more objectives.
 *
 * Storage: localStorage today; target MongoDB `goals`/`objectives` collections.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Goal, Objective, ObjectivePriority, PriorityPeriod } from "@/lib/types"
import { usePointsStore } from "@/lib/points-store"
import { periodKeyFor } from "@/lib/objectives"

/** Default points multiplier for actions serving any (non-prioritized) objective. */
export const DEFAULT_OBJECTIVE_MULTIPLIER = 1.5

interface GoalsState {
  objectives: Objective[]
  goals: Goal[]
  // ---- Objective CRUD ----
  addObjective: (objective: Pick<Objective, "title"> & Partial<Objective>) => string
  updateObjective: (objective: Objective) => void
  deleteObjective: (id: string) => void
  /** Set or update the priority (with multiplier) for an objective in a period. */
  setObjectivePriority: (id: string, priority: ObjectivePriority) => void
  /** Remove an objective's priority for a given period + periodKey. */
  clearObjectivePriority: (id: string, period: PriorityPeriod, periodKey: string) => void
  /** Save a written period review onto an objective (one per period/periodKey). */
  saveObjectiveReview: (id: string, period: PriorityPeriod, periodKey: string, summary: string) => void
  // ---- Goal CRUD ----
  addGoal: (goal: Omit<Goal, "id" | "createdAt" | "completed" | "current"> & { current?: number }) => string
  updateGoal: (goal: Goal) => void
  deleteGoal: (id: string) => void
  setGoalProgress: (id: string, current: number) => void
}

const OBJECTIVE_TITLES = [
  "Travel as much as possible",
  "Be a kind person",
  "Do good for the world",
  "Get really good at chess",
  "Be a polyglot",
  "Learn every day",
  "Be happy",
  "Be a good friend",
  "Host people more",
  "Create art",
  "Optimize my life / output",
  "Be healthy",
  "Look good",
  "Get really good at pool",
  "Read a lot",
  "Be knowledgable",
  "Be prepared for opportunities",
  "Be really good at surfing",
  "Have the house organized in the perfect way",
  "Make a lot of money for Elijah on the stock market",
  "Appreciate being alive",
  "Get things done",
  "Do paid international program(s) — especially art or prestigious",
  "Be a really good swimmer",
  "Swim more",
  "Get outside more",
]

const slug = (title: string) =>
  "obj-" +
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 40)

const defaultObjectives = (): Objective[] =>
  OBJECTIVE_TITLES.map((title) => ({
    id: slug(title),
    title,
    createdAt: new Date(),
    priorities: [],
    reviews: [],
  }))

const defaultGoals = (): Goal[] => [
  {
    id: "goal-read-20-books",
    title: "Read 20 books this year",
    type: "count",
    target: 20,
    current: 0,
    unit: "books",
    periodKind: "year",
    objectiveIds: ["obj-read-a-lot", "obj-be-knowledgable"],
    points: 50,
    completed: false,
    createdAt: new Date(),
  },
  {
    id: "goal-read-10-pages",
    title: "Read 10 pages per day",
    type: "count",
    target: 10,
    current: 0,
    unit: "pages",
    periodKind: "day",
    objectiveIds: ["obj-read-a-lot"],
    points: 5,
    completed: false,
    createdAt: new Date(),
  },
  {
    id: "goal-surf-weekly",
    title: "Surf once a week",
    type: "count",
    target: 1,
    current: 0,
    unit: "sessions",
    periodKind: "week",
    objectiveIds: ["obj-be-really-good-at-surfing", "obj-be-healthy", "obj-get-outside-more"],
    points: 20,
    completed: false,
    createdAt: new Date(),
  },
  {
    id: "goal-surf-11-year",
    title: "Surf 11 times this year",
    type: "count",
    target: 11,
    current: 0,
    unit: "sessions",
    periodKind: "year",
    objectiveIds: ["obj-be-really-good-at-surfing", "obj-be-healthy", "obj-get-outside-more"],
    points: 30,
    completed: false,
    createdAt: new Date(),
  },
]

const newId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

export const useGoalsStore = create<GoalsState>()(
  persist(
    (set, get) => ({
      objectives: defaultObjectives(),
      goals: defaultGoals(),

      addObjective: (partial) => {
        const id = newId("obj")
        set((state) => ({
          objectives: [
            ...state.objectives,
            {
              priorities: [],
              reviews: [],
              ...partial,
              id,
              createdAt: new Date(),
            },
          ],
        }))
        return id
      },

      updateObjective: (objective) =>
        set((state) => ({
          objectives: state.objectives.map((o) => (o.id === objective.id ? objective : o)),
        })),

      deleteObjective: (id) =>
        set((state) => ({
          objectives: state.objectives.filter((o) => o.id !== id),
          // Drop the deleted objective from any goals that served it.
          goals: state.goals.map((g) =>
            g.objectiveIds.includes(id)
              ? { ...g, objectiveIds: g.objectiveIds.filter((oid) => oid !== id) }
              : g,
          ),
        })),

      setObjectivePriority: (id, priority) =>
        set((state) => ({
          objectives: state.objectives.map((o) => {
            if (o.id !== id) return o
            const others = (o.priorities ?? []).filter(
              (p) => !(p.period === priority.period && p.periodKey === priority.periodKey),
            )
            return { ...o, priorities: [...others, priority] }
          }),
        })),

      clearObjectivePriority: (id, period, periodKey) =>
        set((state) => ({
          objectives: state.objectives.map((o) =>
            o.id === id
              ? {
                  ...o,
                  priorities: (o.priorities ?? []).filter(
                    (p) => !(p.period === period && p.periodKey === periodKey),
                  ),
                }
              : o,
          ),
        })),

      saveObjectiveReview: (id, period, periodKey, summary) =>
        set((state) => ({
          objectives: state.objectives.map((o) => {
            if (o.id !== id) return o
            const reviewId = `${period}:${periodKey}`
            const others = (o.reviews ?? []).filter((r) => r.id !== reviewId)
            return {
              ...o,
              reviews: [
                ...others,
                { id: reviewId, period, periodKey, summary, completedAt: new Date() },
              ],
            }
          }),
        })),

      addGoal: (partial) => {
        const id = newId("goal")
        set((state) => ({
          goals: [
            ...state.goals,
            {
              current: 0,
              ...partial,
              id,
              completed: false,
              createdAt: new Date(),
            },
          ],
        }))
        return id
      },

      updateGoal: (goal) =>
        set((state) => ({
          goals: state.goals.map((g) => (g.id === goal.id ? goal : g)),
        })),

      deleteGoal: (id) => set((state) => ({ goals: state.goals.filter((g) => g.id !== id) })),

      setGoalProgress: (id, current) => {
        const goal = get().goals.find((g) => g.id === id)
        if (!goal) return
        const clamped = Math.max(0, current)
        const completed = goal.type === "boolean" ? clamped >= 1 : clamped >= goal.target
        const wasCompleted = goal.completed
        set((state) => ({
          goals: state.goals.map((g) => (g.id === id ? { ...g, current: clamped, completed } : g)),
        }))
        if (completed && !wasCompleted && goal.points > 0) {
          usePointsStore
            .getState()
            .addPoints(goal.id, goal.points, `Goal completed: ${goal.title}`, new Date())
        }
      },
    }),
    {
      name: "cogs-goals-store",
      version: 3,
      // v1/v2 used a different Objective/Goal shape (period/target/category on
      // objectives, category/period on goals). Those were experimental; reset to
      // the redesigned defaults so the new model is coherent.
      migrate: (persisted: unknown, version: number) => {
        if (version < 3 || !persisted || typeof persisted !== "object") {
          return { objectives: defaultObjectives(), goals: defaultGoals() }
        }
        return persisted as GoalsState
      },
      onRehydrateStorage: () => (state) => {
        if (!state) return
        const toDate = (v: unknown) => (v instanceof Date ? v : v ? new Date(v as string) : undefined)
        state.objectives = (state.objectives ?? []).map((o) => ({
          ...o,
          priorities: o.priorities ?? [],
          reviews: (o.reviews ?? []).map((r) => ({ ...r, completedAt: toDate(r.completedAt) as Date })),
          createdAt: toDate(o.createdAt) as Date,
        }))
        state.goals = (state.goals ?? []).map((g) => ({
          ...g,
          objectiveIds: g.objectiveIds ?? [],
          createdAt: toDate(g.createdAt) as Date,
          startDate: toDate(g.startDate),
          endDate: toDate(g.endDate),
          deadline: toDate(g.deadline),
        }))
      },
    },
  ),
)

/**
 * Effective points multiplier for actions serving `objectiveId` on `date`:
 * the highest active period priority multiplier, or the default 1.5 when the
 * objective is not prioritized for the current period.
 */
export function objectiveMultiplierFor(objective: Objective, date = new Date()): number {
  const active = (objective.priorities ?? []).filter((p) => p.periodKey === periodKeyFor(p.period, date))
  if (active.length === 0) return DEFAULT_OBJECTIVE_MULTIPLIER
  return Math.max(...active.map((p) => p.multiplier))
}

/**
 * Combined (stacking) multiplier for a task contributing to several objectives:
 * the product of each contributing objective's effective multiplier. Returns 1
 * when the task serves no objective.
 */
export function taskObjectiveMultiplier(
  objectives: Objective[],
  contributedObjectiveIds: string[] | undefined,
  date = new Date(),
): number {
  const ids = contributedObjectiveIds ?? []
  if (ids.length === 0) return 1
  let multiplier = 1
  for (const id of ids) {
    const objective = objectives.find((o) => o.id === id)
    if (objective) multiplier *= objectiveMultiplierFor(objective, date)
  }
  return multiplier
}
