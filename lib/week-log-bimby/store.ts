/**
 * lib/week-log-bimby/store.ts — Week Log records and amendments
 *
 * `brain2-week-logs`. One record per built week (keyed by its Monday: which doc,
 * which version, the hash of the body last written, the last prose) and every
 * amendment the person gave about a week, word for word. Record-guarded in
 * `lib/vault-guard.js` and in the backup.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import type { WeekAmendment, WeekLogRecord } from "./types"

export const WEEK_LOGS_KEY = persistKey("week-logs")

interface WeekLogState {
  logs: WeekLogRecord[]
  amendments: WeekAmendment[]
  putLog: (record: WeekLogRecord) => void
  addAmendment: (a: WeekAmendment) => void
  dropAmendment: (id: string) => void
}

export const useWeekLogStore = create<WeekLogState>()(
  persist(
    (set) => ({
      logs: [],
      amendments: [],
      putLog: (record) => set((s) => ({ logs: [...s.logs.filter((l) => l.id !== record.id), record].sort((a, b) => a.id.localeCompare(b.id)) })),
      addAmendment: (a) => set((s) => (s.amendments.some((x) => x.id === a.id) ? s : { amendments: [...s.amendments, a] })),
      dropAmendment: (id) => set((s) => ({ amendments: s.amendments.filter((a) => a.id !== id) })),
    }),
    {
      name: WEEK_LOGS_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      migrate: (persisted) => {
        const p = (persisted ?? {}) as { logs?: unknown; amendments?: unknown }
        return { logs: Array.isArray(p.logs) ? (p.logs as WeekLogRecord[]) : [], amendments: Array.isArray(p.amendments) ? (p.amendments as WeekAmendment[]) : [] }
      },
    },
  ),
)

export const weekLogRecord = (start: string): WeekLogRecord | undefined => useWeekLogStore.getState().logs.find((l) => l.id === start)

export const weekAmendmentsFor = (start: string): WeekAmendment[] =>
  useWeekLogStore
    .getState()
    .amendments.filter((a) => a.date === start)
    .sort((a, b) => a.at.localeCompare(b.at))
