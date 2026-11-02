/**
 * lib/period-summary-store.ts — What a period summary keeps beside its text
 *
 * The written summary stays in `brain2-tracking-day-notes`
 * (`lib/day-notes-persist.ts`). This map holds the rest, keyed by the same
 * summary key: the period's playlist (a pasted link and songs, each with a
 * note), a palette, symbols, and a cover photo. Data → Summary reads it; the
 * ritual summary step edits it. Storage: `brain2-period-summaries`.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"
import { registerPhoneWindowStore } from "@/lib/phone-window"
import {
  EMPTY_PERIOD_SUMMARY,
  isPeriodSummaryEmpty,
  MAX_PALETTE,
  type PeriodSummaryRecord,
} from "@/lib/period-summary"

export const PERIOD_SUMMARIES_STORAGE_KEY = persistKey("period-summaries")

interface PeriodSummaryState {
  byKey: Record<string, PeriodSummaryRecord>
  patch: (key: string, change: Partial<PeriodSummaryRecord>) => void
}

export const usePeriodSummaryStore = create<PeriodSummaryState>()(
  persist(
    (set) => ({
      byKey: {},
      patch: (key, change) =>
        set((s) => {
          const next: PeriodSummaryRecord = {
            ...EMPTY_PERIOD_SUMMARY,
            ...s.byKey[key],
            ...change,
            updatedAt: new Date().toISOString(),
          }
          next.palette = next.palette.slice(0, MAX_PALETTE)
          const byKey = { ...s.byKey }
          if (isPeriodSummaryEmpty(next)) delete byKey[key]
          else byKey[key] = next
          return { byKey }
        }),
    }),
    { name: PERIOD_SUMMARIES_STORAGE_KEY, version: 1, storage: createCogsJSONStorage() },
  ),
)

export function usePeriodSummary(key: string): PeriodSummaryRecord {
  return usePeriodSummaryStore((s) => s.byKey[key]) ?? EMPTY_PERIOD_SUMMARY
}

registerPhoneWindowStore(usePeriodSummaryStore)
