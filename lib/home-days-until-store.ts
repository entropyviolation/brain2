/**
 * lib/home-days-until-store.ts — Date, optional time, label, and readout format
 *
 * One countdown. Storage: `brain2-home-days-until` (persist v2 adds optional
 * clock time + unit/decimal format). Included in the Settings full backup.
 */
"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import { createCogsJSONStorage } from "@/lib/persist-storage"
import { persistKey } from "@/lib/storage-keys"

export const HOME_DAYS_UNTIL_STORAGE_KEY = persistKey("home-days-until")

export type DaysUntilFormat = "unit" | "decimal"

export type HomeDaysUntil = {
  label: string
  date: string
  /** Optional local time `HH:MM`. Empty = date-only (midnight start of that day). */
  time: string
  format: DaysUntilFormat
}

export const EMPTY_HOME_DAYS_UNTIL: HomeDaysUntil = {
  label: "",
  date: "",
  time: "",
  format: "unit",
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/

export function sanitizeDaysUntilFormat(value: unknown): DaysUntilFormat {
  return value === "decimal" ? "decimal" : "unit"
}

export function sanitizeDaysUntilTime(value: unknown): string {
  if (typeof value !== "string" || !TIME.test(value)) return ""
  const [hh, mm] = value.split(":").map(Number)
  if (hh! < 0 || hh! > 23 || mm! < 0 || mm! > 59) return ""
  return value
}

export function sanitizeHomeDaysUntil(value: unknown): HomeDaysUntil {
  const raw = value && typeof value === "object" ? (value as Partial<HomeDaysUntil>) : {}
  const label =
    typeof raw.label === "string" ? raw.label.replace(/[\r\n\t]/g, " ").replace(/ {2,}/g, " ").slice(0, 40) : ""
  const date = typeof raw.date === "string" && DATE.test(raw.date) ? raw.date : ""
  return {
    label,
    date,
    time: sanitizeDaysUntilTime(raw.time),
    format: sanitizeDaysUntilFormat(raw.format),
  }
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
            time: state.time,
            format: state.format,
            ...patch,
          }),
        ),
    }),
    {
      name: HOME_DAYS_UNTIL_STORAGE_KEY,
      version: 2,
      storage: createCogsJSONStorage(),
      partialize: (state) => ({
        label: state.label,
        date: state.date,
        time: state.time,
        format: state.format,
      }),
      migrate: (persisted) => sanitizeHomeDaysUntil(persisted),
      merge: (persisted, current) => ({
        ...current,
        ...sanitizeHomeDaysUntil(persisted),
      }),
    },
  ),
)
