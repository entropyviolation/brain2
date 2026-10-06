/**
 * lib/star-lord-store.ts — Saved Star Lord Reports
 *
 * One row per occasion (`new:YYYY-MM-DD`, `full:…`, `birth:…`). Close stores
 * a draft (`completed: false`). Submit sets `completed` and the points row
 * lives in `points-store`, not here.
 *
 * Storage: `brain2-star-lord-store` (legacy `cogs-` alias). Append-only for
 * the shrink guard: a new moon does not erase the last one.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import type { StarLordReport } from "@/lib/star-lord"

interface StarLordState {
  reports: StarLordReport[]
  saveReport: (report: StarLordReport) => void
}

export const useStarLordStore = create<StarLordState>()(
  persist(
    (set, get) => ({
      reports: [],
      saveReport: (report) => {
        const rest = get().reports.filter((row) => row.id !== report.id)
        set({ reports: [...rest, report] })
      },
    }),
    {
      name: persistKey("star-lord-store"),
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ reports: state.reports }),
    },
  ),
)
