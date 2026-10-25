/**
 * lib/unfinished-objectives-store.ts — Parked objectives for the next sitting
 *
 * One list. Each row names the task, subtask, pen, or operation it returns to.
 * Start/stop of a clock take and put rows; this file only holds them.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import {
  sameUnfinishedHome,
  type ParkedObjective,
  type UnfinishedHome,
} from "@/lib/unfinished-objectives"

interface UnfinishedObjectivesState {
  rows: ParkedObjective[]
  upsert: (rows: ParkedObjective[]) => void
  take: (homes: UnfinishedHome[]) => ParkedObjective[]
}

export const useUnfinishedObjectivesStore = create<UnfinishedObjectivesState>()(
  persist(
    (set, get) => ({
      rows: [],
      upsert: (incoming) =>
        set((state) => {
          const map = new Map(state.rows.map((row) => [row.id, row]))
          for (const row of incoming) map.set(row.id, row)
          return { rows: [...map.values()] }
        }),
      take: (homes) => {
        if (!homes.length) return []
        const rows = get().rows
        const taken = rows.filter((row) => homes.some((home) => sameUnfinishedHome(row.home, home)))
        if (!taken.length) return []
        const ids = new Set(taken.map((row) => row.id))
        set({ rows: rows.filter((row) => !ids.has(row.id)) })
        return taken
      },
    }),
    {
      name: persistKey("unfinished-objectives"),
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ rows: state.rows }),
    },
  ),
)
