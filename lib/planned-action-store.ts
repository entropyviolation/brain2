/**
 * lib/planned-action-store.ts — Persist hub for day-agenda planned actions
 *
 * Timed intentions (free blocks, To Do placements, habit placements). Not
 * calendar events. Storage: `brain2-planned-actions` (`cogs-planned-actions`
 * alias). Same guarded adapter as the rest of BRAIN2.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import {
  findPlacementForSource,
  makePlannedAction,
  type PlannedAction,
  type PlannedActionSource,
} from "@/lib/planned-actions"

interface PlannedActionState {
  actions: PlannedAction[]
  addAction: (action: PlannedAction) => void
  updateAction: (action: PlannedAction) => void
  deleteAction: (id: string) => void
  setActions: (actions: PlannedAction[]) => void
  /**
   * Drop a To Do or habit onto a day: move the existing placement for that
   * source+date, or create one. Free-form blocks always add.
   */
  upsertSourcePlacement: (action: PlannedAction) => PlannedAction
  deleteForSource: (date: string, source: Exclude<PlannedActionSource, "free">, sourceId: string) => void
}

function sanitizeAction(raw: unknown): PlannedAction | null {
  if (!raw || typeof raw !== "object") return null
  const row = raw as Partial<PlannedAction>
  if (typeof row.id !== "string" || !row.id) return null
  if (typeof row.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) return null
  const source: PlannedActionSource =
    row.source === "todo" || row.source === "habit" || row.source === "free" ? row.source : "free"
  return makePlannedAction({
    id: row.id,
    date: row.date,
    startTime: typeof row.startTime === "string" ? row.startTime : "09:00",
    endTime: typeof row.endTime === "string" ? row.endTime : "09:30",
    title: typeof row.title === "string" ? row.title : undefined,
    notes: typeof row.notes === "string" ? row.notes : "",
    source,
    sourceId: typeof row.sourceId === "string" ? row.sourceId : undefined,
  })
}

export const usePlannedActionStore = create<PlannedActionState>()(
  persist(
    (set, get) => ({
      actions: [],

      addAction: (action) =>
        set((state) => {
          if (state.actions.some((row) => row.id === action.id)) return state
          return { actions: [...state.actions, makePlannedAction(action)] }
        }),

      updateAction: (updated) =>
        set((state) => {
          const index = state.actions.findIndex((row) => row.id === updated.id)
          if (index === -1) return state
          const next = [...state.actions]
          next[index] = makePlannedAction(updated)
          return { actions: next }
        }),

      deleteAction: (id) => set((state) => ({ actions: state.actions.filter((row) => row.id !== id) })),

      setActions: (actions) => set({ actions: actions.map((row) => makePlannedAction(row)) }),

      upsertSourcePlacement: (action) => {
        if (action.source === "free" || !action.sourceId) {
          const created = makePlannedAction(action)
          set((state) => ({ actions: [...state.actions, created] }))
          return created
        }
        const existing = findPlacementForSource(get().actions, action.date, action.source, action.sourceId)
        if (existing) {
          const next = makePlannedAction({
            ...existing,
            startTime: action.startTime,
            endTime: action.endTime,
            title: action.title || existing.title,
            notes: action.notes || existing.notes,
          })
          get().updateAction(next)
          return next
        }
        const created = makePlannedAction(action)
        set((state) => ({ actions: [...state.actions, created] }))
        return created
      },

      deleteForSource: (date, source, sourceId) =>
        set((state) => ({
          actions: state.actions.filter(
            (row) => !(row.date === date && row.source === source && row.sourceId === sourceId),
          ),
        })),
    }),
    {
      name: persistKey("planned-actions"),
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ actions: state.actions }),
      merge: (persisted, current) => {
        const raw = (persisted ?? {}) as { actions?: unknown }
        const actions = Array.isArray(raw.actions)
          ? raw.actions.map(sanitizeAction).filter((row): row is PlannedAction => row !== null)
          : current.actions
        return { ...current, actions }
      },
    },
  ),
)
