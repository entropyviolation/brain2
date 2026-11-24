/**
 * lib/day-log-bimby/store.ts — Day Log records and amendments
 *
 * `brain2-day-logs`. One record per built day (which doc, which version, the
 * hash of the body last written) and every amendment the person gave, word for
 * word. Amendments are the person's own record: nothing here removes one except
 * `dropAmendment`. Record-guarded in `lib/vault-guard.js` and in the backup.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import type { Amendment, DayLogRecord } from "./types"

export const DAY_LOGS_KEY = persistKey("day-logs")

interface DayLogState {
  logs: DayLogRecord[]
  amendments: Amendment[]
  putLog: (record: DayLogRecord) => void
  addAmendment: (a: Amendment) => void
  dropAmendment: (id: string) => void
}

export const useDayLogStore = create<DayLogState>()(
  persist(
    (set) => ({
      logs: [],
      amendments: [],
      putLog: (record) => set((s) => ({ logs: [...s.logs.filter((l) => l.id !== record.id), record].sort((a, b) => a.id.localeCompare(b.id)) })),
      addAmendment: (a) => set((s) => (s.amendments.some((x) => x.id === a.id) ? s : { amendments: [...s.amendments, a] })),
      dropAmendment: (id) => set((s) => ({ amendments: s.amendments.filter((a) => a.id !== id) })),
    }),
    {
      name: DAY_LOGS_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      migrate: (persisted) => {
        const p = (persisted ?? {}) as { logs?: unknown; amendments?: unknown }
        return { logs: Array.isArray(p.logs) ? (p.logs as DayLogRecord[]) : [], amendments: Array.isArray(p.amendments) ? (p.amendments as Amendment[]) : [] }
      },
    },
  ),
)

export const dayLogRecord = (date: string): DayLogRecord | undefined => useDayLogStore.getState().logs.find((l) => l.id === date)

export const amendmentsFor = (date: string): Amendment[] =>
  useDayLogStore
    .getState()
    .amendments.filter((a) => a.date === date)
    .sort((a, b) => a.at.localeCompare(b.at))
