/**
 * lib/home-days-until-store.ts — Date and label for the Days Until tile
 *
 * One countdown. Storage: `brain2-home-days-until`. Included in the Settings
 * full backup.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export const HOME_DAYS_UNTIL_STORAGE_KEY = persistKey("home-days-until")

export type HomeDaysUntil = {
  label: string
  date: string
}

export const EMPTY_HOME_DAYS_UNTIL: HomeDaysUntil = { label: "", date: "" }

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function sanitizeHomeDaysUntil(value: unknown): HomeDaysUntil {
  const raw = value && typeof value === "object" ? (value as Partial<HomeDaysUntil>) : {}
  const label =
    typeof raw.label === "string" ? raw.label.replace(/[\r\n\t]/g, " ").replace(/ {2,}/g, " ").slice(0, 40) : ""
  const date = typeof raw.date === "string" && DATE.test(raw.date) ? raw.date : ""
  return { label, date }
}

interface HomeDaysUntilState extends HomeDaysUntil {
  setCountdown: (patch: Partial<HomeDaysUntil>) => void
}

export const useHomeDaysUntilStore = create<HomeDaysUntilState>()(
  persist(
    (set) => ({
      ...EMPTY_HOME_DAYS_UNTIL,
      setCountdown: (patch) =>
        set((state) =>
          sanitizeHomeDaysUntil({
            label: state.label,
            date: state.date,
            ...patch,
          }),
        ),
    }),
    {
      name: HOME_DAYS_UNTIL_STORAGE_KEY,
      version: 1,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({ label: state.label, date: state.date }),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeHomeDaysUntil(persisted),
      }),
    },
  ),
)
